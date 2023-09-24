import * as PIXI from 'pixi.js';
import { Roots } from '../roots/Roots';
import { GridRenderer } from './GridRender';
import { animalIcons, landscapeBackgrounds, portraitBackgrounds } from './Animals';
import { LevelGenerator } from '../roots/LevelGenerator';
import seedrandom from 'seedrandom'
import { Tile } from '../roots/Tile';
import { Multitouch } from './Multitouch';
import { TutorialController } from './TutorialRenderer';
import { Event } from '../util/Event';
import { Updater } from '../util/Updater';
import { lerp } from '../util/MathUtil';
import { Indicator } from './Indicator';
import { Button } from './Button';
import { HexRenderer } from './HexRenderer';
import { isMobileDevice } from '../util/MobileUtils';

export class GameRenderer {

    static clock: number = 0;

    readonly app: PIXI.Application<HTMLCanvasElement>;
    readonly game: Roots;
    readonly isTutorial: boolean;

    readonly onHoverChanged = new Event<number>();
    readonly onResized = new Event<void>();
    readonly onShare = new Event<void>();
    readonly onBackgroundLoaded = new Event<void>();

    multitouch: Multitouch;
    gridRenderer: GridRenderer;
    tutorialRenderer: TutorialController;

    groupAnimalPaths: string[];
    groupColors: PIXI.Color[];
    playerColors: PIXI.Color[];

    private stoneRenderers: PIXI.Graphics[];
    private stonePieceRenderers: PIXI.Graphics[];
    private stonePiecesOutline: PIXI.Graphics;
    stonesIndicator: Indicator;
    stonePiecesIndicator: Indicator;
    hintButtonIndicator: Indicator;
    private shareButton: Button;
    private hintButton: Button;
    private hexContainer: PIXI.Container;
    private mainContainer: PIXI.Container;

    private tutorialText: PIXI.Text;

    readonly backgroundImg: HTMLImageElement = new Image();

    readonly activatedTiles = new Set<Tile>();

    readonly invertAxes: boolean = false;
    autoSelectGroup = true;
    disableActivation = false;


    private readonly updater: Updater = new Updater();

    // 0-indexed, so 0 moves out is next
    readonly maxHintMovesOut = 2;
    private hintHex: HexRenderer;
    private hintMovesOut = this.maxHintMovesOut;


    constructor(app: PIXI.Application<HTMLCanvasElement>, game: Roots, isTutorial: boolean) {
        this.app = app;
        // TODO: support vertical orientation
        this.invertAxes = app.view.width < app.view.height;
        this.game = game;
        this.isTutorial = isTutorial;
        this.hexContainer = new PIXI.Container();
        this.mainContainer = new PIXI.Container();

        app.stage.addChild(this.mainContainer);

        this.initGroups();

        window.addEventListener('resize', () => {
            setTimeout(() => {
                this.resizeTutorialText();
                this.positionStones();
                this.onResized.emit();
            });
        });

        document.oncontextmenu = document.body.oncontextmenu = (e) => {
            // Prevent a context menu, and clear active tiles
            e.preventDefault();
            this.clearActiveTiles();
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
        .map(i => paths[i % paths.length]);

        
        let lastGroup = this.game.grid.toArray().map(t => t.groupIndex).sort((a, b) => b - a)[0];
        let lastAnimalIcon = this.groupAnimalPaths[lastGroup];
        let backgroundsString = this.invertAxes ? portraitBackgrounds : landscapeBackgrounds;
        let backgrounds = backgroundsString.split('\n').filter(s => s.length > 0).map(s => s.trim());
        let backgroundIndex = backgrounds.findIndex(s => s.replace(".jpg",".png") === lastAnimalIcon);
        // If the seed is an animal, use that
        let seedBackground = this.game.seed + ".jpg";
        if (backgrounds.includes(seedBackground)) {
            backgroundIndex = backgrounds.indexOf(seedBackground);
        }
        if (backgroundIndex === -1) backgroundIndex = Math.floor(rng() * backgrounds.length);
        // backgroundIndex = Math.floor(Math.random() * backgrounds.length); // For testing
        let background = backgrounds[backgroundIndex];
        if (this.isTutorial || this.game.seed === 'pick') background = "butterfly.jpg";
        let subfolder = this.invertAxes ? 'portrait' : 'landscape';

        let source = `img/backgrounds/${subfolder}/${background}`;
        this.backgroundImg.src = source;
        this.backgroundImg.onload = () => {
            this.onBackgroundLoaded.emit();
        };
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
            this.clearHints();
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

    private readonly stoneRadius = isMobileDevice() ? 20 : 15;
    positionStones() {
        let radius = this.stoneRadius;
        let xPadding = radius * 1.5;
        let height = this.app.screen.height - this.stoneRadius * 1.5;
        this.stoneRenderers.forEach((sprite, i) => {
            sprite.x = xPadding + (i + 1) * this.stoneRadius * 2.5;
            sprite.y = height;
        });
        this.stonesIndicator.x = (this.stoneRenderers[0].x + this.stoneRenderers[1].x) / 2;
        this.stonesIndicator.y = height;
        this.stonesIndicator.zIndex = 100;

        this.stonePieceRenderers.forEach((sprite, i) => {
            sprite.x = xPadding;
            sprite.y = height;
        });
        this.stonePiecesIndicator.x = xPadding;
        this.stonePiecesIndicator.y = height;
        this.stonePiecesIndicator.zIndex = 100;

        this.stonePiecesOutline.x = xPadding;
        this.stonePiecesOutline.y = height;
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

        let radius = this.stoneRadius;
        this.stoneRenderers = Array.from(new Array(LevelGenerator.maxStones).keys()).map(i => {
            let sprite = new PIXI.Graphics();
            sprite.beginFill(0xffffff);
            sprite.drawCircle(0, 0, radius);
            sprite.endFill();
            this.mainContainer.addChild(sprite);
            return sprite;
        });
        this.stonesIndicator = new Indicator(radius * 2 * 2 * 1.5, 4);
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

            this.mainContainer.addChild(sprite);
            return sprite;
        });
        this.stonePiecesIndicator = new Indicator(radius * 2 * 1.5, 4);
        this.stonePiecesIndicator.showing = false;
        this.mainContainer.addChild(this.stonePiecesIndicator);

        let sprite = this.stonePiecesOutline = new PIXI.Graphics();
        sprite.lineStyle({width: 2, color: 0xffffff});
        sprite.moveTo(0, 0);
        sprite.drawCircle(0, 0, radius);
        this.mainContainer.addChild(sprite);

        this.positionStones();
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

        const iconSize = isMobileDevice() ? 60 : 35;
        const padding = iconSize / 2;

        // TODO: Need some sort of indicator of how far out the hint is
        let hintButton = this.hintButton = new Button('img/hint.png', this.updater);
        this.mainContainer.addChild(hintButton);
        hintButton.x = padding;
        hintButton.y = padding;
        hintButton.icon.width = iconSize;
        hintButton.icon.height = iconSize;
        hintButton.onClicked.addHandler((e) => {
            this.showHint(e.shiftKey && e.ctrlKey);
            if (this.isTutorial) this.tutorialRenderer.step(false, true);
        });
        this.hintButtonIndicator = new Indicator(iconSize * 1.5, 4);
        this.hintButtonIndicator.x = hintButton.x + iconSize / 2;
        this.hintButtonIndicator.y = hintButton.y + iconSize / 2;
        this.hintButtonIndicator.showing = false;
        this.hintButtonIndicator.zIndex = 100;
        this.mainContainer.addChild(this.hintButtonIndicator);

        this.shareButton = new Button('img/share.png', this.updater);
        this.mainContainer.addChild(this.shareButton);
        this.shareButton.x = padding;
        this.shareButton.y = padding * 2 + iconSize;
        this.shareButton.icon.width = iconSize;
        this.shareButton.icon.height = iconSize;
        this.shareButton.visible = !this.isTutorial;
        this.shareButton.onClicked.addHandler(() => {
            this.onShare.emit();
        });
    }

    showHint(cheat = false) {
        if (this.hintMovesOut < 0) return;

        // Find all hexes that can show a hint, sorted by ideal order
        let hintable = this.gridRenderer.hexes
        .filter(h => !h.tile.unlocked && !h.isHidden() && h.hasGroup)
        .sort((a, b) => {
            return a.tile.groupIndex - b.tile.groupIndex;
        });
        if (hintable.length === 0) return;
        // Get their group indexes
        let hintableGroups = hintable.map(h => h.tile.groupIndex)
            .filter((value, index, self) => self.indexOf(value) === index);
        if (hintableGroups.length === 0) return;

        // In case we're near the end of the game, make sure we can hint as far out as desired
        while (this.hintMovesOut >= hintableGroups.length) this.hintMovesOut--;
        let hintGroupIndex = hintableGroups[this.hintMovesOut];

        if (cheat) {
            hintGroupIndex = hintableGroups[0];
            let toUnlock = hintable
            .filter(h => h.tile.groupIndex === hintGroupIndex)
            .map(h => h.tile);
            toUnlock = this.game.unlockTiles(toUnlock);
            this.refresh();
            this.game.onTilesUnlocked.emit(toUnlock);
            return;
        }

        let priorHintHex = this.hintHex;
        // Hint the first hex in the hint group
        this.hintHex = hintable.filter(h => h.tile.groupIndex === hintGroupIndex)[0];
        this.hintMovesOut--;
        if (!this.hintHex) return; // This should never happen, but just in case

        // Remove the prior hint and show the new one
        if (priorHintHex) priorHintHex.showingIndicator = false;
        this.hintHex.showingIndicator = true;
    }

    clearHints() {
        if (this.hintHex) this.hintHex.showingIndicator = false;
        this.hintMovesOut = this.maxHintMovesOut;
    }

    update(delta: number) {
        GameRenderer.clock += delta;
        this.gridRenderer.update(delta);
        this.multitouch.update(delta);
        this.updater.update();
        this.stonePiecesIndicator.update(delta);
        this.stonesIndicator.update(delta);
        this.hintButtonIndicator.update(delta);
    }
}