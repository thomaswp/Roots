import * as PIXI from "pixi.js";
import { Container } from "pixi.js";
import { Tile } from "../roots/Tile";
import { GridRenderer } from "./GridRender";

export class HexRenderer extends Container {
    tile: Tile;
    icon: PIXI.Sprite;
    hex: PIXI.Graphics;
    hovered: boolean = false;
    gridRenderer: GridRenderer;

    constructor(tile: Tile, gridRenderer: GridRenderer) {
        super();
        this.gridRenderer = gridRenderer;
        this.tile = tile;

        let icon = this.icon = new PIXI.Sprite();
        if (tile.groupIndex !== undefined) {
            icon.texture = PIXI.Texture.from(this.gridRenderer.renderer.iconPathForGroupIndex(tile.groupIndex));
        }
        icon.anchor.set(0.5);
        let iconRatio = 0.6;
        icon.width = tile.width * iconRatio;
        icon.height = tile.height * iconRatio;
        icon.x = tile.width / 2;
        icon.y = tile.height / 2;
        
        let graphics = this.hex = new PIXI.Graphics();
        
        this.addChild(graphics);
        this.addChild(icon);

        this.x = -tile.center.x;
        this.y = -tile.center.y;

        this.redraw();

        graphics.interactive = true;

        graphics.onmouseenter = () => {
            if (this.tile.unlocked || this.tile.groupIndex === undefined) return;
            this.hovered = true;
            this.gridRenderer.updateHover(tile.groupIndex, true);
        }
        graphics.onmouseleave = () => {
            this.hovered = false;
            this.gridRenderer.updateHover(tile.groupIndex, false);
        }
        graphics.onrightclick = (e) => {
            console.log('right clicked', tile.id);
            this.gridRenderer.renderer.game.clearSelection();
        }
        let lastCliked = 0;
        graphics.onclick = (e) => {
            console.log('clicked', tile.id);
            let doubleClick = Date.now() - lastCliked < 400;
            // console.log(Date.now(), lastCliked, Date.now() - lastCliked);
            lastCliked = Date.now();
            tile.clicked(doubleClick);
            // this.hovered = false;
            // this.gridRenderer.updateHover(tile.groupIndex, false);
            this.redraw();
            this.gridRenderer.renderer.updateStones();
        }
    }

    

    redraw() {
        
        let tile = this.tile;
        let hex = this.hex;

        let active = tile.unlocked || tile.active;

        let color = this.gridRenderer.renderer.colorForGroupIndex(tile.groupCount - 2);
        if (tile.isStoneTile) color = new PIXI.Color(0x888888);
        let lineColor;
        let lineColorAlpha = 1;
        let zIndex = 0;
        if (tile.unlocked) {
            lineColor = 0xeeeeee;
            hex.zIndex = active ? 1 : 0;
            zIndex = 1;
        } else if (tile.active) {
            lineColor = 0xff00ff;
            zIndex = 2;
        } else if (this.gridRenderer.hoverGroupIndex === tile.groupIndex) {
            lineColor = 0xeeaaee;
            zIndex = 1;
        } else {
            lineColor = 0x000000;
        }
        this.zIndex = zIndex;

        hex.clear();
        hex.beginFill(color);
        hex.lineStyle(3, lineColor, lineColorAlpha);
        let translatedCorners = tile.corners.map(c => {
            return {x: c.x + tile.center.x, y: c.y + tile.center.y};
        });
        hex.drawPolygon(translatedCorners);
        hex.endFill();


        if (this.gridRenderer.hoverGroupIndex === tile.groupIndex) {
            hex.tint = active ? 0xeeeeee : 0xeeeeee;
        } else {
            hex.tint = active ? 0xffffff : 0x888888;
        }
    }
}