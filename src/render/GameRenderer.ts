import * as PIXI from 'pixi.js';
import { Roots } from '../roots/Roots';
import { GridRenderer } from './GridRender';
import { animalIcons } from './Animals';
import { LevelGenerator } from '../roots/LevelGenerator';
import seedrandom from 'seedrandom'
import { Tile } from '../roots/Tile';
import { Multitouch } from './Multitouch';
import { TutorialRenderer } from './TutorialRenderer';
import { SpriteH } from 'pixi-heaven';
import { Event } from '../util/Event';

export class GameRenderer {

    readonly app: PIXI.Application<HTMLCanvasElement>;
    readonly game: Roots;
    readonly isTutorial: boolean;

    readonly onHoverChanged = new Event<number>();

    multitouch: Multitouch;
    gridRenderer: GridRenderer;
    tutorialRenderer: TutorialRenderer;

    groupAnimalPaths: string[];
    groupColors: PIXI.Color[];
    playerColors: PIXI.Color[];

    stoneRenderers: PIXI.Graphics[];
    stonePieceRenderers: PIXI.Graphics[];
    shareIcon: SpriteH;
    hexContainer: PIXI.Container;
    mainContainer: PIXI.Container;

    activatedTiles = new Set<Tile>();

    invertAxes: boolean = false;
    autoSelectGroup: boolean = true;

    readonly onShare = new Event<void>();


    constructor(app: PIXI.Application<HTMLCanvasElement>, game: Roots, isTutorial: boolean) {
        this.app = app;
        this.invertAxes = app.view.width < app.view.height;
        this.game = game;
        this.isTutorial = isTutorial;
        this.hexContainer = new PIXI.Container();
        this.mainContainer = new PIXI.Container();

        app.stage.addChild(this.mainContainer);


        this.initGroups();
    }

    get activeTileCount() : number {
        return this.activatedTiles.size;
    }

    get nFreeStones() {
        return this.game.nStones - this.activeTileCount;
    }

    initGroups() {
        let rng: () => number = seedrandom(this.game.seed);

        let nBasicColors = 5;
        let basicColors = Array.from(new Array(nBasicColors).keys()).map(i => {
            return new PIXI.Color({h: i * 360 / nBasicColors, s: 85, v: 100});
        });
        // basicColors.forEach((c, i) => console.log(i, c.toRgbaString()))
        this.groupColors = basicColors;
        this.playerColors = Array.from(new Array(nBasicColors).keys()).map(i => {
            return new PIXI.Color({h: ((i + 0.5) * 360 / nBasicColors) % 360, s: 100, v: 100});
        });

        let nGroups = LevelGenerator.maxGroupIndex;

        let paths = animalIcons.split('\n').filter(s => s.length > 0).map(s => s.trim());
        // shuffle paths
        for (let i = paths.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [paths[i], paths[j]] = [paths[j], paths[i]];
        }
        this.groupAnimalPaths = Array.from(new Array(nGroups).keys())
        .map(i => paths[i % paths.length])
    }


    isTileActive(tile: Tile) : boolean {
        return this.activatedTiles.has(tile);
    }

    activateTile(tile: Tile, silently: boolean = false) {
        if (this.nFreeStones <= 0) {
            if (this.tutorialRenderer) {
                this.tutorialRenderer.step(true);
            }
            return false;
        }
        this.activatedTiles.add(tile);
        this.updateStones();
        if (!silently) this.sendActiveTiles();

        if (this.tutorialRenderer) {
            this.tutorialRenderer.step();
        }
        return true;
    }

    deactivateTile(tile: Tile) {
        this.activatedTiles.delete(tile);
        this.updateStones();
    }

    activateGroup(tile: Tile) {
        let unclickedTiles = this.game.groups[tile.groupIndex].filter(t => !this.isTileActive(t));
            // console.log('Considering ', unclickedTiles.length, unclickedTiles)
        if (this.nFreeStones >= unclickedTiles.length) {
            // console.log("go!!");
            unclickedTiles.forEach(t => this.activateTile(t, true));
            this.sendActiveTiles();
        }
        this.gridRenderer.refresh();
    }

    updatePlayerHover(playerIndex: number, tileID: number) {
        this.gridRenderer.hexes.forEach(hex=> {
            hex.updatePlayerHover(playerIndex, tileID);
        });
    }

    clearActiveTiles() {
        this.activatedTiles.clear();
        this.refresh();
    }

    deactivateTiles(tiles: Tile[]) {
        tiles.forEach(t => this.activatedTiles.delete(t));
        this.refresh();
    }

    private sendActiveTiles() {
        if (this.game.tryActivating(this.activatedTiles)) {
            this.clearActiveTiles();
        }
    }

    refresh() {
        this.updateStones();
        this.gridRenderer.refresh();
        if (this.tutorialRenderer) {
            this.tutorialRenderer.step();
        }
    }

    updateStones() {
        this.stoneRenderers.forEach((sprite, i) => {
            sprite.visible = i < this.nFreeStones;
        });
        this.stonePieceRenderers.forEach((sprite, i) => {
            sprite.visible = i < this.game.nStonePieces
        });
    }

    colorForGroupIndex(index: number) : PIXI.Color {
        return this.groupColors[index];
    }

    colorForPlayerIndex(index: number) : PIXI.Color {
        return this.playerColors[index % this.playerColors.length];
    }

    iconPathForGroupIndex(index: number) : string {
        return `img/animals/${this.groupAnimalPaths[index]}`;
    }

    start() {
        this.app.ticker.add(delta => {
            this.update(delta);
        });
        this.gridRenderer = new GridRenderer(this, this.game.grid);

        this.multitouch = new Multitouch(this, this.mainContainer, this.gridRenderer.width, this.gridRenderer.height);
        this.hexContainer = this.multitouch.viewport;

        this.gridRenderer.init();
        this.hexContainer.addChild(this.gridRenderer.container);

        // this.gridRenderer.graphics.x = this.app.screen.width / 2;
        // this.gridRenderer.graphics.y = this.app.screen.height / 2;

        let radius = 10;
        let xPadding = 5 + radius;
        let height = this.app.screen.height - 10 * 2;
        this.stoneRenderers = Array.from(new Array(LevelGenerator.maxStones).keys()).map(i => {
            let sprite = new PIXI.Graphics();
            sprite.beginFill(0xffffff);
            sprite.drawCircle(0, 0, radius);
            sprite.endFill();
            sprite.x = xPadding + (i + 1) * 25;
            sprite.y = height;
            this.mainContainer.addChild(sprite);
            return sprite;
        });
        this.stonePieceRenderers = Array.from(new Array(this.game.nStonePiecesPerStone).keys()).map(i => {
            let sprite = new PIXI.Graphics();
            sprite.beginFill(0xffffff);
            let nPieces = this.game.nStonePiecesPerStone;
            sprite.arc(0, 0, radius, i * Math.PI * 2 / nPieces, (i + 1) * Math.PI * 2 / nPieces, false);
            sprite.lineTo(0, 0);
            // sprite.drawCircle(0, 0, radius);
            sprite.endFill();

            sprite.x = xPadding;
            sprite.y = height;
            this.mainContainer.addChild(sprite);
            return sprite;
        });
        let sprite = new PIXI.Graphics();
        sprite.lineStyle({width: 2, color: 0xffffff});
        sprite.moveTo(0, 0);
        sprite.drawCircle(0, 0, radius);
        sprite.x = xPadding;
        sprite.y = height;
        this.mainContainer.addChild(sprite);
        this.updateStones();

        if (this.isTutorial) {
            this.tutorialRenderer = new TutorialRenderer(this);
            this.tutorialRenderer.step();
        }

        this.shareIcon = new SpriteH(PIXI.Texture.from('img/share.png'));
        this.mainContainer.addChild(this.shareIcon);
        // Position in bottom-right corner

        this.shareIcon.color.setDark(1, 1, 1);
        this.shareIcon.anchor.set(1, 1);
        this.shareIcon.x = this.app.screen.width - 10;
        this.shareIcon.y = this.app.screen.height - 10;
        this.shareIcon.width = 25;
        this.shareIcon.height = 25;
        this.shareIcon.interactive = true;
        this.shareIcon.on('click', () => {
            this.onShare.emit();
        });
        this.shareIcon.on('mouseover', () => {
            this.shareIcon.color.setDark(1, 0.5, 1);
        });
        this.shareIcon.on('mouseout', () => {
            this.shareIcon.color.setDark(1, 1, 1);
        });
    }

    update(delta: number) {
        this.gridRenderer.update(delta);
        this.multitouch.update(delta);
    }
}