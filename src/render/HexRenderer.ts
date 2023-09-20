import * as PIXI from "pixi.js";
import { Container } from "pixi.js";
import { Tile } from "../roots/Tile";
import { GridRenderer } from "./GridRender";
import { GameRenderer } from "./GameRenderer";
import { SpriteH } from "pixi-heaven";
import { lerp, lerpHexColor } from "../util/MathUtil";
import { Direction } from "honeycomb-grid";

export class HexRenderer extends Container {
    readonly tile: Tile;
    readonly gridRenderer: GridRenderer;
    
    hovering = false;

    private icon: SpriteH;
    private hex: PIXI.Graphics;
    private border: PIXI.Container;
    private borderPieces: PIXI.Graphics[] = [];

    private hoveringPlayers = new Map<number, number>();
    private flipValue: number = 0;
    private unlocked = false;
    private targetBorderColor = 0x000000;
    private targetHexColor = 0xffffff;
    private targetIconColor = new PIXI.Color(0x000000);
    private targetScale = 1;
    private targetZIndex = 0;
    private hoveringTime = 0;
    private errorPerc = 0;

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

    set showingIndicator(showing: boolean) {
        this.gridRenderer.setIndicatorShowing(this, showing);
    }

    get hasGroup() : boolean {
        return this.tile.hasGroup;
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

    isHidden() : boolean {
        return this.hidden;
    }

    setHidden(hidden: boolean) {
        // Fade in when unhiding
        if (!hidden && this.hidden) this.alpha = 0;
        this.hidden = hidden;
        this.icon.alpha = this.hex.alpha = this.hidden ? 0 : 1;
        this.refresh();
    }

    createIcon() {
        let texture = null;
        if (this.hasGroup) {
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
        const onDown = (e, whenGesturing = false) => {
            if (!whenGesturing && isGesturing()) return;
            if (this.tile.unlocked) return;
            this.hovering = true;
            // If hidden, act like a blank tile (index 0)
            this.gridRenderer.updateHover(this.hidden ? null : tile.groupIndex, true);
            this.gridRenderer.renderer.onHoverChanged.emit(tile.id);
            this.refresh();
        }
        const onUp = (e) => {
            this.hovering = false;
            this.gridRenderer.updateHover(tile.groupIndex, false);
            this.refresh();
        };
        graphics.onpointerenter = graphics.onmouseenter = onDown;
        graphics.onpointerleave = graphics.onmouseleave = onUp;

        // Pointer down should also start hover, even when "gesturing"
        graphics.onpointerdown = (e) => {
            onDown(e, true);
        }
        // When the pointer is raised, regardless of the tile, clear all hovering
        graphics.onpointerup = (e) => {
            this.gridRenderer.clearHover();
        }

        graphics.onrightclick = (e) => {
            this.renderer.clearActiveTiles();
        }
        let lastCliked = 0;
        const onClick = (e) => {
            console.log('clicked', tile.id);
            if (isGesturing()) return;
            if (this.tile.unlocked) return;
            let selectAll = Date.now() - lastCliked < 400;
            // console.log(Date.now(), lastCliked, Date.now() - lastCliked);
            lastCliked = Date.now();

            if (this.renderer.autoSelectGroup) {
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
            }

            // When hidden, act like a blank tile
            if (this.hidden) selectAll = false;

            // Tutorial disables double-click too
            if (this.renderer.autoSelectGroup && selectAll) {
                this.renderer.activateGroup(tile);
            } else if (!this.active) {
                if (!this.renderer.activateTile(tile)) {
                    this.showError();
                }
            } else {
                this.renderer.deactivateTile(tile);
            }
            this.refresh();
        }
        graphics.ontap = graphics.onclick = onClick;
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

        let border = this.border = new PIXI.Container();
        this.addChild(border);
        for (let i = 0; i < 6; i++) {
            let piece = new PIXI.Graphics();
            this.borderPieces.push(piece);
            let startCorner = translatedCorners[i % 6];
            let endCorner = translatedCorners[(i + 1) % 6];
            // if (this.tile.groupIndex == 0) {
            //     console.log(i, startCorner, endCorner);
            // }
            piece.moveTo(startCorner.x, startCorner.y);
            piece.lineTextureStyle({cap: PIXI.LINE_CAP.ROUND, join: PIXI.LINE_JOIN.ROUND, width: 3, color: 0xffffff})
            // piece.lineStyle(3, 0xffffff);
            piece.lineTo(endCorner.x, endCorner.y);
            piece.endFill();
            border.addChild(piece);
        }
    }

    showError() {
        this.errorPerc = 1;
    }

    updatePlayerHover(playerIndex: number, tileID: number) {
        if (!(this.tile.id === tileID || this.hoveringPlayers.has(playerIndex))) return;
        if (this.tile.id === tileID) {
            this.hoveringPlayers.set(playerIndex, 5 * 60);
        } else {
            this.hoveringPlayers.delete(playerIndex);
        }
        this.refresh();
    }

    update(delta: number) {

        for (let [playerIndex, time] of this.hoveringPlayers) {
            this.hoveringPlayers.set(playerIndex, time - delta);
            if (time <= 0) {
                this.hoveringPlayers.delete(playerIndex);
                this.refresh();
            }
        }

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
        let targetBorderColor = this.targetBorderColor;
        let targetZIndex = this.targetZIndex;

        // Adjust the target border color to show error red
        if (this.errorPerc > 0) {
            this.errorPerc = Math.max(0, this.errorPerc - delta * 0.1);
            // let perc = Math.cos(this.errorPerc * Math.PI) * -0.5 + 0.5;
            // targetBorderColor = lerpHexColor(targetBorderColor, 0xff0000, perc, 0.005);
            this.rotation = Math.sin(this.errorPerc * Math.PI) * 0.6;
            targetColor = targetBorderColor = 0xffffff;
            colorShiftSpeed = 1;
            targetZIndex = 5;
        }

        let targetIconRotation = 0;
        if (this.active) {
            let t = GameRenderer.clock * 0.1;
            targetIconRotation = Math.cos(t) * 0.25;
        }
        this.icon.rotation = lerp(this.icon.rotation, targetIconRotation, delta * 0.1, 0.005);

        this.hex.tint = lerpHexColor(this.hex.tint, targetColor, delta * colorShiftSpeed);
        
        for (let i = 0; i < this.borderPieces.length; i++) {
            let piece = this.borderPieces[i];
            let startTint = piece.tint;
            let pieceTarget = targetBorderColor;
            // if (this.active) {
            //     let t = GameRenderer.clock * 0.1 + i * Math.PI * 2 / this.borderPieces.length;
            //     let perc = Math.cos(t) * 0.15 + 0.85;
            //     pieceTarget = new PIXI.Color({h: 0, s: 0, v: perc * 100}).toNumber();
            // }
            piece.tint = lerpHexColor(startTint, pieceTarget, delta * colorShiftSpeed);
            if (piece.alpha < 1) {
                piece.alpha = lerp(piece.alpha, 0, delta * 0.1, 0.005);
            }
        }
        this.zIndex = targetZIndex;

        let targetIconColor = this.targetIconColor;
        this.icon.color.setDark(
            lerp(this.icon.color.darkR, targetIconColor.red, delta * colorShiftSpeed, 0.005),
            lerp(this.icon.color.darkR, targetIconColor.red, delta * colorShiftSpeed, 0.005),
            lerp(this.icon.color.darkR, targetIconColor.red, delta * colorShiftSpeed, 0.005)
        );
        this.icon.alpha = lerp(this.icon.alpha, targetIconColor.alpha, delta * colorShiftSpeed, 0.005);

        if (this.alpha < 1) {
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

        if (tile.unlocked && !this.unlocked) {
            this.unlock();
        }

        let active = tile.unlocked || this.active;
        let hovering = this.hovering;

        if (this.gridRenderer.hoverGroupIndex === tile.groupIndex && !this.hidden) {
            hovering = true;
        }

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
        } else if (this.hoveringPlayers.size > 0) {
            lineColor = this.gridRenderer.renderer.colorForPlayerIndex([...this.hoveringPlayers.keys()][0]);
            zIndex = 1.5;
        } else {
            lineColor = new PIXI.Color('00000000');
        }
        // Tie breaking for consistency
        zIndex += (tile.q + tile.r * 0.1) * 0.001;

        if (!this.hidden && tile.isStoneTile && !(tile.unlocked || this.hoveringPlayers.size > 0)) {
            lineColor = new PIXI.Color(groupCountColor);
            if (!active) lineColor.multiply(new PIXI.Color(0xbbbbbb)); //new PIXI.Color(0xffd700);
            zIndex += 0.5;
            // this.icon.color.setDark(groupCountColor.red * 0.7, groupCountColor.green * 0.7, groupCountColor.blue * 0.7);
        }
        this.targetZIndex = zIndex;

        this.targetBorderColor = lineColor;

        let targetIconColor;
        if (this.active) {
            targetIconColor = 0xffffff;
        } else if (this.unlocked) {
            targetIconColor = 0x000000;
        } else {
            targetIconColor = 0x000000;
        }
        this.targetIconColor.setValue(targetIconColor);
        this.targetIconColor.setAlpha(this.unlocked ? 0.85 : 1);
        this.targetScale = this.active ? 1.08 : 1;

        if (hovering) {
            this.targetHexColor = 0xeeeeee;
        } else if (this.unlocked) {
            this.targetHexColor = 0xeeeeee;
        } else if (this.active) {
            this.targetHexColor = 0xffffff;
        } else {
            this.targetHexColor = 0x888888;
        }

        this.updateBorder();
    }

    updateBorder() {
        if (!this.tile.unlocked) return;
        
        let index = 0;
        let order = [
            Direction.E,
            Direction.SE,
            Direction.SW,
            Direction.W,
            Direction.NW,
            Direction.NE,
        ]

        if (this.renderer.invertAxes) {
            order = [
                Direction.E,
                Direction.NE,
                Direction.NW,
                Direction.W,
                Direction.SW,
                Direction.SE,
            ]
        }

        let neighbors = this.tile.getNeighbors(true);
        for (let dir of order) {
            let piece = this.borderPieces[index];
            index++;
            let neighbor = neighbors[dir];
            if (neighbor == null || !neighbor.unlocked) {
                piece.alpha = 1;
            } else {
                piece.alpha -= 0.01;
            }
        }
    }
}