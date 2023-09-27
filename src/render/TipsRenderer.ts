import * as PIXI from 'pixi.js';
import { GridRenderer } from './GridRender';
import { Grid, rectangle } from 'honeycomb-grid';
import { Tile } from '../roots/Tile';
import { HexRenderer, HexRendererController } from './HexRenderer';
import { GameRenderer } from './GameRenderer';


interface TipLayout {
    goalTiles: [number, number][];
    unlockedTiles: [number, number][];
    activatedTiles: [number, number][];
    isSuccess: boolean;
    description?: string;
}

const tipLayouts: TipLayout[] = [
    {
        goalTiles: [[0, 0], [1, 0]],
        unlockedTiles: [],
        activatedTiles: [[0, 0], [1, 0]],
        isSuccess: true,
    },
    {
        goalTiles: [[0, 0], [1, 0]],
        unlockedTiles: [],
        activatedTiles: [[0, 0], [1, 0]],
        isSuccess: true,
    },
    {
        goalTiles: [[0, 0], [1, 0]],
        unlockedTiles: [],
        activatedTiles: [[0, 0], [1, 0]],
        isSuccess: true,
    },
    {
        goalTiles: [[0, 0], [1, 0]],
        unlockedTiles: [],
        activatedTiles: [[0, 0], [1, 0]],
        isSuccess: true,
    },
    {
        goalTiles: [[0, 0], [1, 0]],
        unlockedTiles: [],
        activatedTiles: [[0, 0], [1, 0]],
        isSuccess: true,
    },
];

function isInList(list: [number, number][], tile: Tile) {
    return list.some(([q, r]) => tile.q === q && tile.r === r);
}

export class TipsRenderer extends PIXI.Container implements HexRendererController {

    private renderer: GameRenderer;

    // TODO: handle resize
    private backgroundWidth: number = 800;
    private backgroundHeight: number = 600;

    private tips: PIXI.Container[] = [];
    private hexes: HexRenderer[] = [];

    readonly invertAxes = false;

    constructor(gameRenderer: GameRenderer) {
        super();
        this.renderer = gameRenderer;

        this.createBackground();

        for (let layout of tipLayouts) {   
            let tip = this.createTip(layout);
            this.addChild(tip);
            this.tips.push(tip);
        }
        this.layout();
        this.hexes.forEach(hex => hex.refresh());
    }

    layout() {
        let [width, height] = [this.backgroundWidth, this.backgroundHeight];

        let columns = 2;
        let rows = Math.ceil(this.tips.length / columns);
        let padding = width * 0.05;

        // TODO: handle scale and position based on width and height in resize method
        this.tips.forEach((tip, index) => {
            let column = index % columns;
            let row = Math.floor(index / columns);
            
            let x = (width - padding * 2) / (columns * 2) * (column * 2 + 1) + padding;
            let y = (height - padding * 2) / (rows * 2) * (row * 2 + 1) + padding;
            console.log(index, row, column, x, y);
            tip.x = x - this.backgroundWidth / 2;
            tip.y = y - this.backgroundHeight / 2;
        });
    }

    createBackground() {

        let [width, height] = [this.backgroundWidth, this.backgroundHeight];

        let background = new PIXI.Graphics();
        background.beginFill(0x000000, 0.8);
        background.lineStyle(2, 0xffffff, 1);
        background.drawRect(0, 0, width, height);
        background.endFill();
        background.zIndex = -1;

        background.x = -width / 2;
        background.y = -height / 2;
        background.interactive = true;

        this.addChild(background);
    }

    createTip(tipLayout: TipLayout) : PIXI.Container {
        let container = new PIXI.Container();

        let grid = new Grid(Tile, rectangle({ width: 4, height: 4 }));
        grid.toArray().forEach((tile, index) => {
            tile.grid = grid;

            let isGoal = isInList(tipLayout.goalTiles, tile);
            let isUnlocked = isInList(tipLayout.unlockedTiles, tile);
            let isActivated = isInList(tipLayout.activatedTiles, tile);

            let isTile = isGoal || isUnlocked || isActivated;

            if (isTile) {
                tile.unlocked = isUnlocked || isGoal;
                if (!isUnlocked) {
                    tile.groupIndex = isGoal ? 1 : 2;
                    tile.groupCount = isGoal ? tipLayout.goalTiles.length : 6;
                }
                let hex = new HexRenderer(tile, this.renderer.gridRenderer, this, true);
                container.addChild(hex);
                hex.backgroundColor = 0xe67B30;
                this.hexes.push(hex);
            }
        });

        return container;
    }

    update(delta: number) {
        this.hexes.forEach(hex => hex.update(delta));
    }

    
    colorForGroupIndex(index: number): PIXI.Color {
        return this.renderer.colorForGroupIndex(index);
    }
    colorForPlayerIndex(index: number): PIXI.Color {
        return this.renderer.colorForPlayerIndex(index);
    }
    iconPathForGroupIndex(index: number): string {
        return this.renderer.iconPathForGroupIndex(index);
    }
    isTileActive(tile: Tile): boolean {
        return false;
    }
    isGroupHovering(groupIndex: number): boolean {
        return false;
    }
    shouldHideHexBackgrounds(): boolean {
        return false;
    }

}