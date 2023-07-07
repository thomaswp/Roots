import * as PIXI from 'pixi.js';
import { Roots } from '../roots/Roots';
import { GridRenderer } from './GridRender';
import { animalIcons } from './Animals';
import { LevelGenerator } from '../roots/LevelGenerator';
import seedrandom from 'seedrandom'
import { Tile } from '../roots/Tile';

export class GameRenderer {
    
    app: PIXI.Application;
    game: Roots;
    gridRenderer: GridRenderer;

    groupAnimalPaths: string[];
    groupColors: PIXI.Color[];

    stoneRenderers: PIXI.Graphics[];
    container: PIXI.Container;

    activatedTiles = new Set<Tile>();


    constructor(app: PIXI.Application, game: Roots) {
        this.app = app;
        this.game = game;
        this.container = new PIXI.Container();
        app.stage.addChild(this.container);

        this.initGroups();
        
        this.game.onNeedRefresh = () => {
            this.refresh();
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
        
        let nGroups = LevelGenerator.maxGroupIndex;
        
        let paths = animalIcons.split('\n').filter(s => s.length > 0).map(s => s.trim());
        // shuffle paths
        for (let i = paths.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [paths[i], paths[j]] = [paths[j], paths[i]];
        }
        this.groupAnimalPaths = Array.from(new Array(nGroups).keys())
        .map(i => paths[i % paths.length]);
    }
    

    isTileActive(tile: Tile) : boolean {
        return this.activatedTiles.has(tile);
    }

    activateTile(tile: Tile, silently: boolean = false) {
        if (this.nFreeStones <= 0) {
            return false;
        }
        this.activatedTiles.add(tile);
        this.updateStones();
        if (!silently) this.sendActiveTiles();
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

    clearActiveTiles() {
        this.activatedTiles.clear();
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
    }

    updateStones() {
        this.stoneRenderers.forEach((sprite, i) => {
            sprite.visible = i < this.nFreeStones;
        });
    }

    colorForGroupIndex(index: number) : PIXI.Color {
        return this.groupColors[index];
    }

    iconPathForGroupIndex(index: number) : string {
        return `img/animals/${this.groupAnimalPaths[index]}`;
    }

    start() {
        this.app.ticker.add(delta => {
            this.update(delta);  
        });
        this.gridRenderer = new GridRenderer(this, this.game.grid);
        this.gridRenderer.init();
        this.container.addChild(this.gridRenderer.container);

        // this.gridRenderer.graphics.x = this.app.screen.width / 2;
        // this.gridRenderer.graphics.y = this.app.screen.height / 2;

        this.stoneRenderers = Array.from(new Array(LevelGenerator.maxStones).keys()).map(i => {
            let sprite = new PIXI.Graphics();
            sprite.beginFill(0xffffff);
            sprite.drawCircle(0, 0, 10);
            sprite.endFill();
            sprite.x = i * 25 + 10;
            sprite.y = this.app.screen.height - 20;
            this.container.addChild(sprite);
            return sprite;
        });
        this.updateStones();
    }

    update(delta: number) {
        
    }
}