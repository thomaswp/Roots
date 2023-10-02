import * as PIXI from "pixi.js";
import { Container } from "pixi.js";
import { Tile } from "../roots/Tile";
import { GridRenderer } from "./GridRender";
import { GameRenderer } from "./GameRenderer";
import { SpriteH } from "pixi-heaven";
import { lerp, lerpHexColor } from "../util/MathUtil";
import { Direction } from "honeycomb-grid";

export interface HexRendererController {
    invertAxes: boolean;
    colorForGroupIndex(index: number) : PIXI.Color;
    colorForPlayerIndex(index: number) : PIXI.Color;
    iconPathForGroupIndex(index: number) : string;
    isTileActive(tile: Tile) : boolean;
    isGroupHovering(groupIndex: number) : boolean;
    shouldHideHexBackgrounds(): boolean;
    shouldAnimateIcons(): boolean;
}

export class HexRenderer extends Container {
    readonly tile: Tile;
    readonly gridRenderer: GridRenderer;
    readonly displayOnly: boolean;
    
    hovering = false;
    backgroundColor: number;

    private icon: SpriteH;
    private hex: PIXI.Graphics;
    private border: PIXI.Container;
    private borderPieces: PIXI.Graphics[] = [];

    private hoveringPlayers = new Map<number, number>();
    private flipValue: number = 0;
    private targetBorderColor = 0x000000;
    private targetHexColor = 0xffffff;
    private targetIconColor = new PIXI.Color(0x000000);
    private targetScale = 1;
    private targetZIndex = 0;
    private hoveringTime = 0;
    private errorPerc = 0;

    private hidden = false;

    private _unlocked = false;
    get unlocked() {
        return this._unlocked;
    }

    private _controller: HexRendererController;
    get controller() : HexRendererController {
        if (this._controller != null) return this._controller;
        return this.gridRenderer.renderer;
    }

    set controller(controller: HexRendererController) {
        this._controller = controller;
    }

    get active() : boolean {
        return this.controller.isTileActive(this.tile);
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

    // TODO: Get rid of gridRenderer altogether: it's only needed for interaction
    constructor(tile: Tile, gridRenderer: GridRenderer, controller: HexRendererController = null, displayOnly = false) {
        super();
        this.gridRenderer = gridRenderer;
        this.tile = tile;
        this.displayOnly = displayOnly;
        this.controller = controller;

        this.createHexAndBorder();
        this.createIcon();
        this.addInteraction();

        this.x = this.controller.invertAxes ? this.tileCenterY : this.tileCenterX;
        this.y = this.controller.invertAxes ? this.tileCenterX : this.tileCenterY;
        if (this.controller.invertAxes) {
            this.hex.rotation = this.border.rotation = Math.PI / 2;
        }

        this.refresh();
    }

    isHidden() : boolean {
        return this.hidden;
    }

    setHidden(hidden: boolean) {
        if (hidden == this.hidden) return;
        // Fade in when unhiding
        // if (!hidden && this.hidden) this.alpha = 0;
        this.hidden = hidden;
        this.icon.visible = !hidden;
        if (!hidden) this.icon.alpha = 0;
        // this.icon.alpha = this.hidden ? 0 : 1;
        this.refresh();
    }

    createIcon() {
        let texture = null;
        if (this.hasGroup) {
            let path = this.controller.iconPathForGroupIndex(this.tile.groupIndex);
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
        if (this.displayOnly) return;
        let graphics = this.hex;
        let tile = this.tile;

        graphics.interactive = true;
        const renderer = this.gridRenderer.renderer;

        let isGesturing = () => renderer.multitouch.isGesturing;
        const onDown = (e, whenGesturing = false) => {
            if (!whenGesturing && isGesturing()) return;
            if (this.tile.unlocked) return;
            this.hovering = true;
            // If hidden, act like a blank tile (index 0)
            this.gridRenderer.updateHover(this.hidden ? null : tile.groupIndex, true);
            renderer.onHoverChanged.emit(tile.id);
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
            renderer.clearActiveTiles();
        }
        let lastCliked = 0;
        const onClick = (e) => {
            console.log('clicked', tile.id);
            if (isGesturing()) return;
            if (this.tile.unlocked) return;
            if (renderer.disableActivation) return;
            let selectAll = Date.now() - lastCliked < 400;
            // console.log(Date.now(), lastCliked, Date.now() - lastCliked);
            lastCliked = Date.now();

            if (renderer.autoSelectGroup) {
                let activatedTiles = renderer.activatedTiles;
                // If a tile is clicked and all the tiles in that group are selected, we probably
                // just activated them all with a click, so we should also deactivate them
                if (activatedTiles.size == tile.groupCount &&
                    [...activatedTiles.keys()].every(t => t.groupIndex === tile.groupIndex)
                ) {
                    renderer.clearActiveTiles();
                    return;
                }

                // Select all if this is the first click and we can (why not...)
                if (activatedTiles.size == 0 && renderer.nFreeStones >= tile.groupCount) {
                    selectAll = true;
                }
            }

            // When hidden, act like a blank tile
            if (this.hidden) selectAll = false;

            // Tutorial disables double-click too
            if (renderer.autoSelectGroup && selectAll) {
                renderer.activateGroup(tile);
            } else if (!this.active) {
                if (!renderer.activateTile(tile)) {
                    this.showError();
                }
            } else {
                renderer.deactivateTile(tile);
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

        let hex = this.hex = new PIXI.Graphics();
        hex.clear();
        hex.beginFill(0xffffff);
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
            let hovering = this.hovering || this.controller.isGroupHovering(this.tile.groupIndex);
            if (hovering && targetScale == 1) {
                this.hoveringTime += delta;
                // targetColor = lerpHexColor(targetColor, 0x777777, -Math.cos(this.hoveringTime * 0.06) * 0.5 + 0.5);
                targetScale = lerp(targetScale, 1.08, -Math.cos(this.hoveringTime * 0.08) * 0.5 + 0.5, 0.005);
            } else {
                this.hoveringTime = 0;
            }
            this.scale.x = this.scale.y = lerp(this.scale.x, targetScale, 0.3, 0.005);
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
            let groupColor = this.getGroupColor().toNumber(); 
            targetBorderColor = this.tile.isStoneTile ? groupColor : 0xffffff;
            targetColor = this.getHexColor().toNumber();
            colorShiftSpeed = 1;
            targetZIndex = 5;
        }

        let targetIconRotation = 0;
        if (this.active && this.controller.shouldAnimateIcons()) {
            let t = GameRenderer.clock * 0.1;
            targetIconRotation = Math.cos(t) * 0.25;
        }
        this.icon.rotation = lerp(this.icon.rotation, targetIconRotation, 0.1, 0.005);

        this.hex.tint = lerpHexColor(this.hex.tint, targetColor, colorShiftSpeed);
        
        for (let i = 0; i < this.borderPieces.length; i++) {
            let piece = this.borderPieces[i];
            let startTint = piece.tint;
            let pieceTarget = targetBorderColor;
            // if (this.active) {
            //     let t = GameRenderer.clock * 0.1 + i * Math.PI * 2 / this.borderPieces.length;
            //     let perc = Math.cos(t) * 0.15 + 0.85;
            //     pieceTarget = new PIXI.Color({h: 0, s: 0, v: perc * 100}).toNumber();
            // }
            piece.tint = lerpHexColor(startTint, pieceTarget, colorShiftSpeed);
            if (piece.alpha < 1) {
                piece.alpha = lerp(piece.alpha, 0, 0.1, 0.005);
            }
        }
        this.zIndex = targetZIndex;

        let targetIconColor = this.targetIconColor;
        this.icon.color.setDark(
            lerp(this.icon.color.darkR, targetIconColor.red, colorShiftSpeed, 0.005),
            lerp(this.icon.color.darkR, targetIconColor.red, colorShiftSpeed, 0.005),
            lerp(this.icon.color.darkR, targetIconColor.red, colorShiftSpeed, 0.005)
        );
        this.icon.alpha = lerp(this.icon.alpha, targetIconColor.alpha, colorShiftSpeed, 0.005);

        if (this.hidden) {
            this.hex.alpha = 1;
        } else {
            let hideHex = this._unlocked && this.controller.shouldHideHexBackgrounds() && this.flipValue <= 0;
            this.hex.alpha = lerp(this.hex.alpha, hideHex ? 0 : 1, 0.1, 0.005);
        }

        if (this.alpha < 1) {
            this.alpha = lerp(this.alpha, 1, 0.1, 0.005);
        }
    }

    unlock() {
        this.flipValue = 1;
        this._unlocked = true;
    }

    lock() {
        this._unlocked = false;
        this.flipValue = 1;
        this.borderPieces.forEach(piece => piece.alpha = 1);
    }

    getGroupColor() : PIXI.Color {
        return this.controller.colorForGroupIndex(this.tile.groupCount - 2) || new PIXI.Color(0x000000);
    }

    getHexColor() : PIXI.Color {
        let color = new PIXI.Color(this.getGroupColor());
        if (this.tile.isStoneTile) {
            color.setValue(0xaaaaaa);
        }
        return color;
    }


    refresh() {
        let tile = this.tile;
        let hex = this.hex;

        if (tile.unlocked && !this._unlocked) {
            this.unlock();
        }

        let active = tile.unlocked || this.active;
        let hovering = this.hovering;

        if (this.controller.isGroupHovering(tile.groupIndex) && !this.hidden) {
            hovering = true;
        }

        let groupCountColor = this.getGroupColor();

        let lineColor;
        let zIndex = 0;
        if (this._unlocked) {
            // lineColor = new PIXI.Color(groupCountColor).multiply(0xbbbbbb);
            // lineColor = 0xeeeeee;
            lineColor = 0x965B00;
            zIndex = 0.25;
        } else if (this.active) {
            lineColor = 0xffffff;
            zIndex = 2;
        } else if (hovering) {
            lineColor = 0xffffff;
            zIndex = 1.5;
        } else if (this.hoveringPlayers.size > 0) {
            lineColor = this.controller.colorForPlayerIndex([...this.hoveringPlayers.keys()][0]);
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
        } else if (this._unlocked) {
            targetIconColor = 0x000000;
        } else {
            targetIconColor = 0x000000;
        }
        this.targetIconColor.setValue(this._unlocked ? 0x555555 : targetIconColor);
        this.targetIconColor.setAlpha(this._unlocked ? 0 : 1);
        this.targetScale = this.active ? 1.08 : 1;

        let hexColor = this.getHexColor();
        if (this.hidden) {
            hexColor.setValue(0x000000);
        } else if (this._unlocked) {
            if (this.backgroundColor != null) {
                hexColor.setValue(this.backgroundColor);
            } else {
                hexColor.setValue(0x000000);
            }
        } else if (hovering || active) {
            hexColor.multiply(0xeeeeee);
        } else {
            hexColor.multiply(0x888888);
        }
        this.targetHexColor = hexColor.toNumber();

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

        if (this.controller.invertAxes) {
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