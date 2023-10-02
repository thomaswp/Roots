import * as PIXI from 'pixi.js';
import { GridRenderer } from './GridRender';
import { Direction, Grid, Hex, rectangle } from 'honeycomb-grid';
import { Tile } from '../roots/Tile';
import { HexRenderer, HexRendererController } from './HexRenderer';
import { GameRenderer } from './GameRenderer';
import { Clustering } from '../roots/Clustering';
import { lerp } from '../util/MathUtil';


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
        unlockedTiles: [[1, -1], [1, 1]],
        activatedTiles: [[0, 0], [2, 0]],
        isSuccess: false,
    },
    {
        goalTiles: [[0, 0], [2, 0]],
        unlockedTiles: [],
        activatedTiles: [[0, 0], [2, 0], [1, 0]],
        isSuccess: true,
    },
    {
        goalTiles: [[0, 0], [1, 0], [0, 1]],
        unlockedTiles: [],
        activatedTiles: [[0, 0], [0, 1]],
        isSuccess: false,
    },
    {
        goalTiles: [[0, -1], [2, -1]],
        unlockedTiles: [[-1, 1], [1, 0]],
        activatedTiles: [[0, -1], [2, -1], [-1, 0], [0, 1]],
        isSuccess: true,
    },
];

function isInList(list: [number, number][], tile: Tile) {
    return list.some(([q, r]) => tile.q === q && tile.r === r);
}

const START_STAGE = -1;

export class TipsRenderer extends PIXI.Container {

    // TODO: handle resize
    private backgroundWidth: number = 700;
    private backgroundHeight: number = 800;
    private tipRenderers = [] as TipRenderer[];

    constructor(gameRenderer: GameRenderer) {
        super();

        this.createBackground();

        for (let layout of tipLayouts) {
            let tip = new TipRenderer(layout, gameRenderer);
            this.addChild(tip);
            this.tipRenderers.push(tip);
        }
        this.layout();
    }

    layout() {
        let [width, height] = [this.backgroundWidth, this.backgroundHeight];

        let columns = 2;
        let rows = Math.ceil(this.tipRenderers.length / columns);
        let padding = width * 0.05;

        // TODO: handle scale and position based on width and height in resize method
        this.tipRenderers.forEach((tip, index) => {
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

    update(delta: number) {
        this.tipRenderers.forEach(tip => tip.update(delta));
    }
}

class TipRenderer extends PIXI.Container implements HexRendererController {

    tipLayout: TipLayout;
    renderer: GameRenderer;
    activeHexes = [] as HexRenderer[];
    hexes = [] as HexRenderer[];
    hexesToActivate = [] as HexRenderer[];
    goalHexes = [] as HexRenderer[];
    backgrounds = [] as PIXI.Graphics[];
    stage: number;
    isAnimating = false;
    lastUpdate = 0;

    get lastStage() {
        return this.tipLayout.activatedTiles.length;
    }

    readonly invertAxes = false;

    constructor(tipLayout: TipLayout, renderer: GameRenderer) {
        super();
        this.tipLayout = tipLayout;
        this.renderer = renderer;
        this.sortableChildren = true;

        this.stage = tipLayout.activatedTiles.length - 1;
        this.init();
        this.hexes.forEach(hex => hex.refresh());
        this.setStage(this.stage);

        // Create a background with some padding to make hovering consistent
        let background = new PIXI.Graphics();
        background.beginFill(0x000000, 0.1);
        background.drawRect(0, 0, this.width * 1.2, this.height * 1.2);
        background.endFill();
        background.zIndex = -1;
        this.addChild(background);
        background.x = -background.width / 2;
        background.y = -background.height / 2;

        this.interactive = true;
        this.onpointerenter = this.onmouseenter = () => {
            this.isAnimating = true;
            this.setStage(START_STAGE);
            this.lastUpdate = 0;
            console.log("enter");
        };

        this.onpointerleave = this.onmouseleave = () => {
            this.isAnimating = false;
            this.setStage(this.lastStage - 1);
            console.log("exit");
        };
    }
    
    init() {
        let tipLayout = this.tipLayout;

        let grid = new Grid(Tile, rectangle({
            width: 6,
            height: 6,
            start: { q: -1, r: -2 }, 
        }));
        let gridArray = grid.toArray();
        gridArray.forEach((tile, index) => {
            tile.id = index;
        });
        let nonGoalGroupIndex = 2;
        gridArray.forEach((tile, index) => {
            tile.grid = grid;

            let isGoal = isInList(tipLayout.goalTiles, tile);
            let isUnlocked = isInList(tipLayout.unlockedTiles, tile);
            let isActivated = isInList(tipLayout.activatedTiles, tile);

            let isTile = isGoal || isUnlocked || isActivated;

            if (isTile) {
                tile.unlocked = isUnlocked;
                if (!isUnlocked) {
                    tile.groupIndex = isGoal ? 1 : nonGoalGroupIndex++;
                    tile.groupCount = isGoal ? tipLayout.goalTiles.length : 6;
                }
                let hex = new HexRenderer(tile, null, this, true);
                if (isGoal) {
                    this.activeHexes.push(hex);
                    this.goalHexes.push(hex);
                }
                this.addChild(hex);
                // TODO: Select from color pallete
                hex.backgroundColor = 0xe67B30;
                this.hexes.push(hex);
            }
        });
        this.hexesToActivate = tipLayout.activatedTiles.map(([q, r]) => {
            return this.hexes.find(hex => hex.tile.q === q && hex.tile.r === r); 
        });

        let backgrounds = new PIXI.Container();
        backgrounds.zIndex = 1;
        for (let i = START_STAGE; i <= tipLayout.activatedTiles.length; i++) {
            let background = this.createBackgroundForTip(grid, i);
            background.alpha = i == tipLayout.activatedTiles.length - 1 ? 1 : 0;
            backgrounds.addChild(background);
            this.backgrounds.push(background);
        }

        this.addChild(backgrounds);
    }

    createBackgroundForTip(grid: Grid<Tile>, stage: number) : PIXI.Graphics {
        let gridArray = grid.toArray();

        // Find the active or unlocked tiles at the current stage
        let tiles = gridArray.filter((tile, index) => {
            if (tile.unlocked) return true;
            let activatedOrder = this.hexesToActivate.findIndex(hex => hex.tile === tile);
            // If it's not activated at some point, don't include it
            if (activatedOrder === -1) return false;
            // Otherwise, include it if it's activated at or before the current stage
            return activatedOrder <= stage;
        });


        let clustering = new Clustering();
        tiles.forEach(tile => {
            clustering.addTileAndConnectNeighbors(tile, tile => tile.groupIndex != null || tile.unlocked);
        });


        let outline = new PIXI.Graphics();
        if (stage == this.lastStage && this.tipLayout.isSuccess) return outline;
        let lineColor = 0x4444ff;
        if (this.tipLayout.isSuccess && stage == this.lastStage - 1) lineColor = 0x44ff44;
        if (!this.tipLayout.isSuccess && stage == this.lastStage) lineColor = 0x777777;
        clustering.clusters.forEach((clusterIDs, index) => {
            console.log(clusterIDs);
            let cluster = clusterIDs.map(id => gridArray[id]);
            let outlinePoints = this.getOutlinePoints(cluster);

            outline.lineStyle({
                width: 2,
                color: lineColor,
                cap: PIXI.LINE_CAP.ROUND,
                join: PIXI.LINE_JOIN.ROUND
            });

            let lastPoint = outlinePoints[outlinePoints.length - 1];
            outline.moveTo(lastPoint.x, lastPoint.y);
            outlinePoints.forEach(point => {
                outline.lineTo(point.x, point.y);
            });
            outline.endFill();
        });

        return outline;
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

        const padding = 10;
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

    setStage(stage: number) {
        if (stage > this.lastStage) stage = START_STAGE;
        this.stage = stage;
        this.activeHexes = this.hexesToActivate.filter((_, index) => index <= this.stage);
        if (this.stage == this.lastStage && this.tipLayout.isSuccess) this.activeHexes = [];
        this.goalHexes.forEach(hex => {
            if (this.stage == this.lastStage) {
                if (this.tipLayout.isSuccess) {
                    hex.unlock();
                    hex.tile.unlocked = true;
                } else {
                    // hex.showError();
                }
            } else if (hex.unlocked) {
                hex.lock();
                hex.tile.unlocked = false;
            }
        });
        this.hexes.forEach(hex => {
            hex.refresh()
        });
        // console.log("setting stage", this.stage, this.activeHexes.length);

    }

    update(delta: number) {
        if (this.isAnimating) {
            this.lastUpdate += delta;
            let threshold = 75;
            if (this.stage == this.lastStage) threshold *= 2;
            if (this.stage == START_STAGE) threshold *= 0.5;
            if (this.lastUpdate > threshold) {
                this.lastUpdate = 0;
                this.setStage(this.stage + 1);
            }
        }

        this.hexes.forEach(hex => hex.update(delta));
        this.backgrounds.forEach((background, index) => {
            // -1 because the first background is for stage -1
            background.alpha = lerp(background.alpha, index - 1 === this.stage ? 1 : 0, 0.05, 0.001);
        });
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

    shouldAnimateIcons(): boolean {
        return this.isAnimating;
    }

}