import * as PIXI from "pixi.js";
import { Container } from "pixi.js";
import { Tile } from "../roots/Tile";
import { GridRenderer } from "./GridRender";
import { GameRenderer } from "./GameRenderer";
import { SpriteH } from "pixi-heaven";
import { lerp, lerpHexColor } from "../util/MathUtil";

export class HexRenderer extends Container {
    tile: Tile;
    icon: SpriteH;
    hex: PIXI.Graphics;
    border: PIXI.Graphics;
    gridRenderer: GridRenderer;

    private flipValue: number = 0;
    private unlocked = false;
    private targetBorderColor = 0x000000;
    private targetHexColor = 0xffffff;
    private targetIconColor = new PIXI.Color(0x000000);
    private targetScale = 1;
    private hovering = false;
    private hoveringTime = 0;

    private hidden = false;

    get renderer() : GameRenderer {
        return this.gridRenderer.renderer;
    }

    get active() : boolean {
        return this.renderer.isTileActive(this.tile);
    }

    get tileCenterX() : number {
        return -this.tile.center.x + this.tile.width / 2;
    }

    get tileCenterY() : number {
        return -this.tile.center.y + this.tile.height / 2;
    }

    constructor(tile: Tile, gridRenderer: GridRenderer) {
        super();
        this.gridRenderer = gridRenderer;
        this.tile = tile;

        this.createHexAndBorder();
        this.createIcon();
        this.addInteraction();

        this.x = this.renderer.invertAxes ? this.tileCenterY : this.tileCenterX;
        this.y = this.renderer.invertAxes ? this.tileCenterX : this.tileCenterY;
        if (this.renderer.invertAxes) {
            this.hex.rotation = this.border.rotation = Math.PI / 2;
        }

        this.refresh();
    }

    setHidden(hidden: boolean) {
        this.hidden = hidden;
        this.refresh();
    }

    createIcon() {
        let texture = null;
        if (this.tile.groupIndex !== undefined) {
            let path = this.renderer.iconPathForGroupIndex(this.tile.groupIndex);
            texture = PIXI.Texture.from(path);
        }
        let icon = this.icon = new SpriteH(texture);
        // icon.color.setDark(0.5, 0, 0);
        icon.anchor.set(0.5);
        let iconRatio = 0.6;
        icon.width = this.tile.width * iconRatio;
        icon.height = this.tile.height * iconRatio;
        icon.x = 0;
        icon.y = 0;
        this.addChild(icon);
    }

    addInteraction() {
        let graphics = this.hex;
        let tile = this.tile;

        graphics.interactive = true;

        let isGesturing = () => this.renderer.multitouch.isGesturing;
        graphics.onpointerenter = graphics.onmouseenter = () => {
            if (this.hidden) return;
            if (isGesturing()) return;
            if (this.tile.unlocked) return;
            this.hovering = true;
            this.gridRenderer.updateHover(tile.groupIndex, true);
            this.refresh();
        }
        graphics.onpointerleave = graphics.onmouseleave =
        graphics.onpointerup = graphics.onmouseup = () => {
            if (this.hidden) return;
            this.hovering = false;
            this.gridRenderer.updateHover(tile.groupIndex, false);
            this.refresh();
        }
        graphics.onrightclick = (e) => {
            if (this.hidden) return;
            this.renderer.clearActiveTiles();
        }
        let lastCliked = 0;
        graphics.ontap = graphics.onclick = (e) => {
            if (this.hidden) return;
            console.log('clicked', tile.id);
            if (isGesturing()) return;
            if (this.tile.unlocked) return;
            let selectAll = Date.now() - lastCliked < 400;
            // console.log(Date.now(), lastCliked, Date.now() - lastCliked);
            lastCliked = Date.now();

            let activatedTiles = this.renderer.activatedTiles;
            // If a tile is clicked and all the tiles in that group are selected, we probably
            // just activated them all with a click, so we should also deactivate them
            if (activatedTiles.size == tile.groupCount &&
                [...activatedTiles.keys()].every(t => t.groupIndex === tile.groupIndex)
            ) {
                this.renderer.clearActiveTiles();
                return;
            }

            // Select all if this is the first click and we can (why not...)
            if (activatedTiles.size == 0 && this.renderer.nFreeStones >= tile.groupCount) {
                selectAll = true;
            }

            if (selectAll) {
                this.renderer.activateGroup(tile);
            } else if (!this.active) {
                this.renderer.activateTile(tile);
            } else {
                this.renderer.deactivateTile(tile);
            }
            this.refresh();
        }
    }

    createHexAndBorder() {
        let tile = this.tile;
        let translatedCorners = tile.corners.map(c => {
            // TODO: Draw inset so borders don't overlap
            return {x: c.x + tile.center.x - tile.width / 2, y: c.y + tile.center.y - tile.height / 2};
        });
        // let inset = 1;
        // translatedCorners = translatedCorners.map(c => {
        //     return {x: c.x * inset, y: c.y * inset};
        // });

        let color = this.getGroupColor();
        if (this.tile.isStoneTile) {
            color = new PIXI.Color(0xaaaaaa);
        }

        let hex = this.hex = new PIXI.Graphics();
        hex.clear();
        hex.beginFill(color);
        hex.drawPolygon(translatedCorners);
        hex.endFill();
        this.addChild(hex);

        let border = this.border = new PIXI.Graphics();
        border.clear();
        border.lineStyle(3, 0xffffff);
        border.drawPolygon(translatedCorners);
        border.endFill();
        this.addChild(border);
    }

    update(delta: number) {
        if (this.flipValue > 0) {
            this.scale.x = Math.abs(Math.cos(this.flipValue * Math.PI));
            this.flipValue = Math.max(0, this.flipValue - delta * 0.07);
        } else {
            let targetScale = this.targetScale;
            let hovering = this.hovering || this.gridRenderer.hoverGroupIndex === this.tile.groupIndex;
            if (hovering && targetScale == 1) {
                this.hoveringTime += delta;
                // targetColor = lerpHexColor(targetColor, 0x777777, -Math.cos(this.hoveringTime * 0.06) * 0.5 + 0.5);
                targetScale = lerp(targetScale, 1.08, -Math.cos(this.hoveringTime * 0.08) * 0.5 + 0.5, 0.005);
            } else {
                this.hoveringTime = 0;
            }
            this.scale.x = this.scale.y = lerp(this.scale.x, targetScale, delta * 0.1, 0.005);
        }

        let colorShiftSpeed = 0.25;
        let targetColor = this.targetHexColor;
        this.hex.tint = lerpHexColor(this.hex.tint, targetColor, delta * colorShiftSpeed);
        // console.log(this.targetHexColor, this.hex.tint);
        this.border.tint = lerpHexColor(this.border.tint, this.targetBorderColor, delta * colorShiftSpeed);

        this.icon.color.setDark(
            lerp(this.icon.color.darkR, this.targetIconColor.red, delta * colorShiftSpeed, 0.005),
            lerp(this.icon.color.darkR, this.targetIconColor.red, delta * colorShiftSpeed, 0.005),
            lerp(this.icon.color.darkR, this.targetIconColor.red, delta * colorShiftSpeed, 0.005)
        );

        if (!this.hidden && this.alpha < 1) {
            this.alpha = lerp(this.alpha, 1, delta * 0.1, 0.005);
        }
    }

    unlock() {
        this.flipValue = 1;
        this.unlocked = true;
    }

    getGroupColor() : PIXI.Color {
        return this.gridRenderer.renderer.colorForGroupIndex(this.tile.groupCount - 2) || new PIXI.Color(0x000000);
    }


    refresh() {
        let tile = this.tile;
        let hex = this.hex;

        if (this.hidden) {
            this.alpha = 0;
        }

        if (tile.unlocked && !this.unlocked) {
            this.unlock();
        }

        let active = tile.unlocked || this.active;
        let hovering = this.hovering || this.gridRenderer.hoverGroupIndex === tile.groupIndex;

        let groupCountColor = this.getGroupColor();

        let lineColor;
        let zIndex = 0;
        if (tile.unlocked) {
            // lineColor = new PIXI.Color(groupCountColor).multiply(0xbbbbbb);
            lineColor = 0xeeeeee;
            hex.zIndex = active ? 1 : 0;
            zIndex = 1;
        } else if (this.active) {
            lineColor = 0xffffff;
            zIndex = 2;
        } else if (hovering) {
            lineColor = 0xffffff;
            zIndex = 1.5;
        } else {
            lineColor = new PIXI.Color('00000000');
        }
        // Tie breaking for consistency
        zIndex += (tile.q + tile.r * 0.1) * 0.001;

        if (tile.isStoneTile && !tile.unlocked) {
            lineColor = new PIXI.Color(groupCountColor);
            if (!active) lineColor.multiply(new PIXI.Color(0xbbbbbb)); //new PIXI.Color(0xffd700);
            zIndex += 0.5;
            // this.icon.color.setDark(groupCountColor.red * 0.7, groupCountColor.green * 0.7, groupCountColor.blue * 0.7);
        }
        this.zIndex = zIndex;

        this.targetBorderColor = lineColor;
        this.targetIconColor.setValue(this.active ? 0xffffff : 0x000000);
        this.targetScale = this.active ? 1.08 : 1;

        if (hovering) {
            this.targetHexColor = 0xeeeeee;
        } else {
            this.targetHexColor = active ? 0xffffff : 0x888888;
        }
    }
}