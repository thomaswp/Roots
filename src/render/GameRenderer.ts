import * as PIXI from 'pixi.js';
import { Roots } from '../roots/Roots';
import { GridRenderer } from './GridRender';
import { animalIcons } from './Animals';
import { LevelGenerator } from '../roots/LevelGenerator';
import seedrandom from 'seedrandom'
import { Tile } from '../roots/Tile';
import { Multitouch } from './Multitouch';
import { TutorialController } from './TutorialRenderer';
import { SpriteH } from 'pixi-heaven';
import { Event } from '../util/Event';
import { Action, Updater } from '../util/Updater';
import { lerp } from '../util/MathUtil';
import { Indicator } from './Indicator';

export class GameRenderer {

    static clock: number = 0;

    readonly app: PIXI.Application<HTMLCanvasElement>;
    readonly game: Roots;
    readonly isTutorial: boolean;

    readonly onHoverChanged = new Event<number>();

    multitouch: Multitouch;
    gridRenderer: GridRenderer;
    tutorialRenderer: TutorialController;

    groupAnimalPaths: string[];
    groupColors: PIXI.Color[];
    playerColors: PIXI.Color[];

    stoneRenderers: PIXI.Graphics[];
    stonePieceRenderers: PIXI.Graphics[];
    stonesIndicator: Indicator;
    stonePiecesIndicator: Indicator;
    shareIcon: SpriteH;
    hexContainer: PIXI.Container;
    mainContainer: PIXI.Container;

    tutorialText: PIXI.Text;

    activatedTiles = new Set<Tile>();

    invertAxes: boolean = false;
    autoSelectGroup: boolean = true;

    readonly onShare = new Event<void>();

    private readonly updater: Updater = new Updater();



    constructor(app: PIXI.Application<HTMLCanvasElement>, game: Roots, isTutorial: boolean) {
        this.app = app;
        this.invertAxes = app.view.width < app.view.height;
        this.game = game;
        this.isTutorial = isTutorial;
        this.hexContainer = new PIXI.Container();
        this.mainContainer = new PIXI.Container();

        app.stage.addChild(this.mainContainer);

        this.initGroups();

        window.addEventListener('resize', () => {
            setTimeout(() => {
                if (this.isTutorial) {
                    this.multitouch.resetTransform();
                    this.tutorialRenderer.updateShowing([]);
                    this.resizeTutorialText();
                } else {
                    this.multitouch.resetTransform();
                }
            });
        });

        document.oncontextmenu = document.body.oncontextmenu = (e) => {
            // Prevent a context menu, and clear active tiles
            this.clearActiveTiles();
            e.preventDefault();
        }
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
            this.stepTutorial(true);
            return false;
        }
        this.activatedTiles.add(tile);
        this.updateStones();
        if (!silently) this.sendActiveTiles();

        
        this.stepTutorial();
        return true;
    }

    deactivateTile(tile: Tile) {
        this.activatedTiles.delete(tile);
        this.updateStones();
        this.stepTutorial();
    }

    activateGroup(tile: Tile) {
        let unclickedTiles = this.game.groups[tile.groupIndex]
            .filter(t => !this.isTileActive(t))
            // Don't include hidden tiles during the tutorial!
            .filter(t => !this.gridRenderer.getHexForTile(t).isHidden());
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
        this.stepTutorial();
    }

    stepTutorial(isError = false) {
        if (this.tutorialRenderer) {
            this.tutorialRenderer.step(isError);
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

    showTutorialText(text: string) {
        this.tutorialText.visible = true;
        this.tutorialText.alpha = 0;
        let p = 0.03;
        this.updater.run(() => {
            this.tutorialText.alpha = lerp(this.tutorialText.alpha, 0, p, 0.01);
            console.log(this.tutorialText.alpha);
            return this.tutorialText.alpha > 0;
        }).then(() => {
            this.tutorialText.text = text;
        }).then(() => {
            this.tutorialText.alpha = lerp(this.tutorialText.alpha, 1, p, 0.01);
            return this.tutorialText.alpha < 1;
        }).unique('tutorialText', true);
    }

    hideTutorialText() {
        this.tutorialText.visible = false;
    }

    resizeTutorialText() {
        this.tutorialText.x = this.app.screen.width / 2;
        this.tutorialText.y = this.app.screen.height * 0.03;
        this.tutorialText.style.wordWrapWidth = this.app.screen.width * 0.55;
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
        this.stonesIndicator = new Indicator(radius * 2 * 2 * 1.5, 4);
        this.stonesIndicator.x = (this.stoneRenderers[0].x + this.stoneRenderers[1].x) / 2;
        this.stonesIndicator.y = height;
        this.stonesIndicator.zIndex = 100;
        this.stonesIndicator.showing = false;
        this.mainContainer.addChild(this.stonesIndicator);

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
        this.stonePiecesIndicator = new Indicator(radius * 2 * 1.5, 4);
        this.stonePiecesIndicator.x = xPadding;
        this.stonePiecesIndicator.y = height;
        this.stonePiecesIndicator.zIndex = 100;
        this.stonePiecesIndicator.showing = false;
        this.mainContainer.addChild(this.stonePiecesIndicator);

        let sprite = new PIXI.Graphics();
        sprite.lineStyle({width: 2, color: 0xffffff});
        sprite.moveTo(0, 0);
        sprite.drawCircle(0, 0, radius);
        sprite.x = xPadding;
        sprite.y = height;
        this.mainContainer.addChild(sprite);
        this.updateStones();

        if (this.isTutorial) {
            this.tutorialRenderer = new TutorialController(this);
        }

        this.tutorialText = new PIXI.Text('', {
            fontFamily: 'Arial',
            fontSize: 36,
            fill: 0xeeeeee,
            align: 'center',
        });
        this.resizeTutorialText();
        this.tutorialText.zIndex = 100;
        this.tutorialText.anchor.set(0.5, 0);
        this.tutorialText.style.wordWrap = true;
        this.tutorialText.style.dropShadow = true;
        this.tutorialText.style.dropShadowColor = 0x000000;
        this.tutorialText.style.dropShadowDistance = 0;
        this.tutorialText.style.dropShadowBlur = 3;
        this.tutorialText.style.dropShadowAlpha = 0.8;
        this.mainContainer.addChild(this.tutorialText);

        this.stepTutorial();

        this.shareIcon = new SpriteH(PIXI.Texture.from('img/share.png'));
        this.mainContainer.addChild(this.shareIcon);
        // Position in bottom-right corner

        this.shareIcon.color.setDark(0.7, 0.7, 0.7);
        this.shareIcon.anchor.set(0, 0);
        this.shareIcon.x = 10;
        this.shareIcon.y = 10;
        this.shareIcon.width = 25;
        this.shareIcon.height = 25;
        this.shareIcon.interactive = true;
        this.shareIcon.on('click', () => {
            this.onShare.emit();
        });
        this.shareIcon.on('mouseover', () => {
            this.updater.run(() => {
                let dark = this.shareIcon.color.dark[0];
                dark = lerp(dark, 1, 0.2, 0.01);
                this.shareIcon.color.setDark(dark, dark, dark);
                return dark < 1;
            }).unique('shareIconHover', true);
        });
        this.shareIcon.on('mouseout', () => {
            this.updater.run(() => {
                let dark = this.shareIcon.color.dark[0];
                dark = lerp(dark, 0.7, 0.2, 0.01);
                this.shareIcon.color.setDark(dark, dark, dark);
                return dark > 0.7;
            }).unique('shareIconHover', true);
        });
        this.shareIcon.visible = !this.isTutorial;
    }

    update(delta: number) {
        GameRenderer.clock += delta;
        this.gridRenderer.update(delta);
        this.multitouch.update(delta);
        this.updater.update();
        this.stonePiecesIndicator.update(delta);
        this.stonesIndicator.update(delta);
    }
}