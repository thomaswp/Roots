import { Grid, Orientation, defineHex, rectangle } from "honeycomb-grid";
import { Tile, tileSize } from "../roots/Tile";
import * as PIXI from "pixi.js";
import { Container } from "pixi.js";
import { GameRenderer } from "./GameRenderer";
import { HexRenderer } from "./HexRenderer";
import { Indicator } from "./Indicator";
import { lerp } from "../util/MathUtil";

export class GridRenderer {

    renderer: GameRenderer
    grid: Grid<Tile>;

    container: Container;
    hexes: HexRenderer[] = [];
    hoverGroupIndex: number = -1;

    width: number;
    height: number;

    private indicators: Map<HexRenderer, Indicator> = new Map();

    private readonly backgrounds = [] as PIXI.Graphics[];

    constructor(renderer: GameRenderer, grid: Grid<Tile>) {
        this.grid = grid;
        this.renderer = renderer;
        this.container = new PIXI.Container();
        this.container.sortableChildren = true;

        this.width = (renderer.game.width + 1) * tileSize * Math.sqrt(3);
        this.height = (renderer.game.height + 0.5) * tileSize * 1.5;
        if (this.renderer.invertAxes) {
            [this.width, this.height] = [this.height, this.width];
        }
        this.container.x = -this.width / 2;
        this.container.y = -this.height / 2;

        let loaded = false;
        this.renderer.backgroundTexture.on('update', (e) => {
            if (loaded) return;
            loaded = true;
            this.setTileBackgroundColors();
            for (let i = 1; i <= 3; i++) {
                this.backgrounds.push(this.createMiniTileBackground(i));
            }
        });
    }

    createMiniTileBackground(power: number) {
        // Works best with power of 2
        let scale = Math.round(Math.pow(2, power));

        let hexScale = 2 / Math.sqrt(3) / scale;

        let gridWidth = Math.round(this.renderer.game.width * scale) + 1 * scale;
        let gridHeight = this.renderer.game.height * scale / 2 * 1.5 + 1 * scale; // - 1 * scale;

        const baseTile = this.hexes[0].tile;
        const CustomHex = defineHex({
            dimensions: baseTile.dimensions.xRadius * hexScale,
            orientation: Orientation.FLAT,
            // orientation: Orientation.POINTY,
            origin: baseTile.origin,
            offset: baseTile.offset
        });
        let grid = new Grid(CustomHex, rectangle({ width: gridWidth, height: gridHeight }));

        let graphics = new PIXI.Graphics();


        let colorArray = this.getScaledColorArray(gridWidth, gridHeight);
        let gridArray = grid.toArray();
        colorArray.forEach((color, index) => {
            let hex = gridArray[index];
            let points = hex.corners;
            // graphics.lineStyle(1, 0x888888);
            graphics.beginFill(color.toNumber());
            graphics.drawPolygon(points);
            graphics.endFill();
        });

        graphics.x -= baseTile.dimensions.xRadius * Math.sqrt(3) / 2;
        graphics.y -= baseTile.dimensions.xRadius * 1.5;

        graphics.zIndex = -100 - power;
        this.container.addChild(graphics);
        return graphics;
    }

    createBorder() {
        let grid = new Grid(Tile, rectangle({ width: this.renderer.game.width + 2, height: this.renderer.game.height + 3 }));


        let graphics = new PIXI.Graphics();

        const baseTile = this.hexes[0].tile;
        let radius = baseTile.dimensions.xRadius;
        let offX = -radius * Math.sqrt(3) * 0.5 * 2;
        let offY = -radius * 1.5 * 2;

        // TODO: Handle inverted axes
        grid.toArray().forEach(tile => {
            let points = tile.corners;
            let center = tile.center;
            let x = -center.x + offX;
            let y = -center.y + offY;
            if (x > -radius / 2 && x <= this.width - radius * 2) {
                if (y > -radius / 2 * 2 && y <= this.height - radius * 2) return;
            };
            graphics.beginFill(0x000000);
            graphics.drawPolygon(points);
            graphics.endFill();
        });

        graphics.zIndex = -100;
        graphics.x = offX;
        graphics.y = offY;

        this.container.addChild(graphics);
    }

    getScaledColorArray(width: number, height: number) {
        let resource = this.renderer.backgroundTexture.baseTexture.resource;
        let image = resource["source"] as HTMLImageElement;

        let canvas = document.createElement('canvas');
        // TODO: handle reversed axes
        canvas.width = width;
        canvas.height = height;
        let ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0, width, height);
        let imageData = ctx.getImageData(0, 0, width, height);
        let data = imageData.data;

        let colors = [] as PIXI.Color[];
        for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];
            // let a = data[i + 3];
            let hex = this.hexes[i / 4];
            let color = new PIXI.Color({r: r, g: g, b: b});
            colors.push(color);
        }
        return colors;
    }

    setTileBackgroundColors() {
        let resource = this.renderer.backgroundTexture.baseTexture.resource;
        let image = resource["source"] as HTMLImageElement;

        let gridWidth = this.renderer.game.width;
        let gridHeight = this.renderer.game.height;
        
        // Attempt at triangles... unsuccessfull because width/height
        // would be different scales
        // for (let i = 0; i < gridWidth; i++) {
        //     for (let j = 0; j < gridHeight; j++) {
        //         let index = i + j * gridWidth;

        //         let offset = j % 2 == 0 ? 0 : 1;
        //         let col1 = offset + i * 2;
        //         let col2 = col1 + 1;
        //     }
        // }

        let colorArray = this.getScaledColorArray(gridWidth, gridHeight);
        colorArray.forEach((color, index) => {
            let hex = this.hexes[index];
            hex.backgroundColor = color;
            hex.refresh();
        });
    }

    getHexForTile(tile: Tile) {
        return this.hexes.filter(t => t.tile == tile)[0];
    }

    setIndicatorShowing(hex: HexRenderer, showing: boolean) {

        let indicator = this.indicators.get(hex);
        if (!indicator && !showing) return;
        if (!indicator) {
            indicator = new Indicator(hex.width * 1.3);
            indicator.x = hex.x;
            indicator.y = hex.y;
            indicator.zIndex = 100;
            this.indicators.set(hex, indicator);
            this.container.addChild(indicator);
        }

        indicator.showing = showing;
    }

    init() {
        this.grid.forEach(tile => {
            let hexRenderer = new HexRenderer(tile, this);
            this.hexes.push(hexRenderer);
            this.container.addChild(hexRenderer);
        });
        this.createBorder();
    }

    refresh() {
        this.hexes.forEach(hexRenderer => {
            hexRenderer.refresh();
        });
    }

    updateHover(index: number, hover: boolean) {
        if (index == undefined || index == -1) return;
        let oldIndex = this.hoverGroupIndex;
        this.hoverGroupIndex = hover ? index : -1;
        this.hexes
        .filter(hexRenderer => {
            return hexRenderer.tile.groupIndex === oldIndex ||
                hexRenderer.tile.groupIndex === index
        })
        .forEach(hexRenderer => {
            hexRenderer.refresh();
        });
    }

    clearHover() {
        this.updateHover(this.hoverGroupIndex, false);
        this.hexes
        .filter(hexRenderer => {
            return hexRenderer.hovering
        })
        .forEach(hexRenderer => {
            // Set false manually blank tiles
            hexRenderer.hovering = false;
            hexRenderer.refresh();
        });
    }

    update(delta: number) {
        this.hexes.forEach(hexRenderer => {
            hexRenderer.update(delta);
        });
        this.indicators.forEach(indicator => {
            indicator.update(delta);
        });
        let showingBGIndex = this.renderer.game.nStones - 3;
        for (let i = 0; i < this.backgrounds.length - 1; i++) {
            let background = this.backgrounds[i];
            let hide = i < showingBGIndex;
            background.alpha = lerp(background.alpha, hide ? 0 : 1, 0.01, 0.01);
        }

    }

}