import * as PIXI from 'pixi.js';
import Spline from 'cubic-spline';
import { CurveInterpolator } from 'curve-interpolator';
import { Direction, Grid, Hex, rectangle } from 'honeycomb-grid';
import { Tile } from '../roots/Tile';
import { HexRenderer, HexRendererController } from './HexRenderer';
import { GameRenderer } from './GameRenderer';
import { Clustering } from '../roots/Clustering';


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
        goalTiles: [[0, 0], [2, 0]],
        unlockedTiles: [],
        activatedTiles: [[0, 0], [2, 0]],
        isSuccess: false,
    },
    {
        goalTiles: [[0, 0], [2, 0]],
        unlockedTiles: [[1, 0]],
        activatedTiles: [[0, 0], [2, 0]],
        isSuccess: true,
    },
    {
        goalTiles: [[0, 0], [2, 0]],
        unlockedTiles: [],
        activatedTiles: [[0, 0], [2, 0]],
        isSuccess: false,
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

    private activeHexes = [] as HexRenderer[];

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
            // console.log(index, row, column, x, y);
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

        let tiles = [] as Tile[];

        let grid = new Grid(Tile, rectangle({ width: 4, height: 4 }));
        let gridArray = grid.toArray();
        gridArray.forEach((tile, index) => {
            tile.id = index;
        });
        gridArray.forEach((tile, index) => {
            tile.grid = grid;

            let isGoal = isInList(tipLayout.goalTiles, tile);
            let isUnlocked = isInList(tipLayout.unlockedTiles, tile);
            let isActivated = isInList(tipLayout.activatedTiles, tile);

            let isTile = isGoal || isUnlocked || isActivated;

            if (isTile) {
                tile.unlocked = isUnlocked;
                if (!isUnlocked) {
                    tile.groupIndex = isGoal ? 1 : 2;
                    tile.groupCount = isGoal ? tipLayout.goalTiles.length : 6;
                }
                let hex = new HexRenderer(tile, this.renderer.gridRenderer, this, true);
                if (isGoal) {
                    this.activeHexes.push(hex);
                }
                container.addChild(hex);
                hex.backgroundColor = 0xe67B30;
                this.hexes.push(hex);
                tiles.push(hex.tile);
            }
        });

        let clustering = new Clustering();
        tiles.forEach(tile => {
            clustering.addTileAndConnectNeighbors(tile, tile => tile.groupIndex != null || tile.unlocked);
        });


        let outline = new PIXI.Graphics();
        clustering.clusters.forEach((clusterIDs, index) => {
            let cluster = clusterIDs.map(id => gridArray[id]);
            let outlinePoints = this.getOutlinePoints(cluster);

            outline.lineStyle({
                width: 2,
                color: 0x44ff44,
                cap: PIXI.LINE_CAP.ROUND,
                join: PIXI.LINE_JOIN.ROUND
            });

            let opArray = outlinePoints.map(point => [point.x, point.y]);
            opArray.push([outlinePoints[0].x, outlinePoints[0].y]);
            opArray.push([outlinePoints[1].x, outlinePoints[1].y]);
            const interp = new CurveInterpolator(opArray, { tension: 0.2, alpha: 0.5 });

            outline.beginFill(0x44ff44, 0.2);
            outline.moveTo(outlinePoints[0].x, outlinePoints[0].y);
            for (let i = 1; i <= 50; i++) {
                let point = interp.getPointAt(i / 50);
                outline.lineTo(point[0], point[1]);
            };
            outline.endFill();
        });
        container.addChild(outline);

        return container;
    }

    getOutlinePoints(tiles: Tile[]) {
        let order = [
            Direction.E,
            Direction.SE,
            Direction.SW,
            Direction.W,
            Direction.NW,
            Direction.NE,
        ]

        const padding = 15;
        const norm = (point: PIXI.Point) => {
            let mag = Math.sqrt(point.x * point.x + point.y * point.y);
            return new PIXI.Point(point.x / mag, point.y / mag);
        }

        let points = [] as PIXI.Point[];
        tiles.forEach(tile => {
            let center = new PIXI.Point(tile.x, tile.y);
            let extend = (point: PIXI.Point) => {
                let n = norm(new PIXI.Point(point.x - center.x, point.y - center.y));
                return new PIXI.Point(point.x + n.x * padding, point.y + n.y * padding);
            }

            let corners = tile.corners;
            let midpoints = [] as PIXI.Point[];
            for (let i = 0; i < corners.length; i++) {
                let corner = corners[i];
                let nextCorner = corners[(i + 1) % corners.length];
                let midpoint = new PIXI.Point((corner.x + nextCorner.x) / 2, (corner.y + nextCorner.y) / 2);
                midpoints.push(midpoint);
            }

            let index = 0;
            let neighbors = tile.getNeighbors(true);
            let openMidpointIndices = order.map((dir, index) => index)
            .filter(index => !tiles.includes(neighbors[order[index]]));

            for (let i = 0; i < midpoints.length; i++) {
                let midpoint = midpoints[i];
                let indexBefore = (i + midpoints.length - 1) % midpoints.length;
                let indexAfter = (i + 1) % midpoints.length;
                if (openMidpointIndices.includes(i)) {
                    if (!openMidpointIndices.includes(indexBefore) ||
                        !openMidpointIndices.includes(indexAfter)) {
                        points.push(extend(midpoint));
                    }
                }
            }
            for (let i = 0; i < corners.length; i++) {
                let midpointBefore = (i + midpoints.length - 1) % midpoints.length;
                let midpointAfter = i;
                let corner = corners[i];
                if (openMidpointIndices.includes(midpointBefore) && openMidpointIndices.includes(midpointAfter)) {
                    points.push(extend(new PIXI.Point(corner.x, corner.y)));
                }
            }
        });

        let pointCenter = new PIXI.Point(0, 0);
        points.forEach(point => {
            pointCenter.set(pointCenter.x + point.x, pointCenter.y + point.y)
        });
        pointCenter.x /= points.length;
        pointCenter.y /= points.length;

        const pointAngle = (point: PIXI.Point) => {
            return Math.atan2(point.y - pointCenter.y, point.x - pointCenter.x);
        }
        points.sort((a, b) => {
            return pointAngle(a) - pointAngle(b);
        });

        return points;
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
        return this.activeHexes.some(h => h.tile === tile);
    }
    isGroupHovering(groupIndex: number): boolean {
        return false;
    }
    shouldHideHexBackgrounds(): boolean {
        return false;
    }

}