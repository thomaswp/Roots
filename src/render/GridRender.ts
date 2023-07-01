import { Grid } from "honeycomb-grid";
import { Tile } from "../roots/Tile";
import * as PIXI from "pixi.js";
import { Container } from "pixi.js";
import { GameRenderer } from "./GameRenderer";

export class GridRenderer {

    renderer: GameRenderer
    grid: Grid<Tile>;

    container: Container;

    constructor(renderer: GameRenderer, grid: Grid<Tile>) {
        this.grid = grid;
        this.renderer = renderer;
        this.container = new PIXI.Container();
        this.container.sortableChildren = true;
    }

    init() {
        this.grid.forEach(tile => {

            let icon = new PIXI.Sprite(PIXI.Texture.from(this.renderer.iconPathForGroupIndex(tile.groupIndex)));
            icon.anchor.set(0.5);
            let iconRatio = 0.6;
            icon.width = tile.width * iconRatio;
            icon.height = tile.height * iconRatio;
            icon.x = tile.width / 2;
            icon.y = tile.height / 2;
            
            let graphics = new PIXI.Graphics();
            
            let container = new PIXI.Container();
            container.addChild(graphics);
            container.addChild(icon);

            container.x = -tile.center.x;
            container.y = -tile.center.y;
            console.log(tile.center.x, tile.center.y);
            this.container.addChild(container);
            // console.log(container, icon);

            this.updateHex(graphics, tile, false);

            graphics.interactive = true;

            graphics.onmouseenter = () => {
                this.updateHex(graphics, tile, true);
            }
            graphics.onmouseleave = () => {
                this.updateHex(graphics, tile, false);
            }
            graphics.onclick = () => {
                tile.clicked();
                // TODO: Should be handled via events...
                this.updateHex(graphics, tile, false);
            }
        });
    }

    updateHex(graphics: PIXI.Graphics, tile: Tile, highlight: boolean) {
        
        let active = tile.active || tile.tempActive;

        let color = this.renderer.colorForGroupIndex(tile.groupIndex);
        let lineColor;
        let lineColorAlpha = 1;
        let zIndex = 0;
        if (tile.active) {
            lineColor = 0xeeeeee;
            graphics.zIndex = active ? 1 : 0;
            zIndex = 1;
        } else if (tile.tempActive) {
            lineColor = 0xbbbbbb;
            zIndex = 2;
        } else {
            lineColor = 0x000000;
        }
        graphics.parent.zIndex = zIndex;

        graphics.clear();
        graphics.beginFill(color);
        graphics.lineStyle(3, lineColor, lineColorAlpha);
        let translatedCorners = tile.corners.map(c => {
            return {x: c.x + tile.center.x, y: c.y + tile.center.y};
        });
        graphics.drawPolygon(translatedCorners);
        graphics.endFill();


        if (highlight) {
            graphics.tint = active ? 0xeeeeee : 0x999999;
        } else {
            graphics.tint = active ? 0xffffff : 0xaaaaaa;
        }
    }

    update(delta: number) {
    }

}