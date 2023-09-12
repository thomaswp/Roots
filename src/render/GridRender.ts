import { Grid } from "honeycomb-grid";
import { Tile, tileSize } from "../roots/Tile";
import * as PIXI from "pixi.js";
import { Container } from "pixi.js";
import { GameRenderer } from "./GameRenderer";
import { HexRenderer } from "./HexRenderer";
import { Indicator } from "./Indicator";

export class GridRenderer {

    renderer: GameRenderer
    grid: Grid<Tile>;

    container: Container;
    hexes: HexRenderer[] = [];
    hoverGroupIndex: number = -1;

    width: number;
    height: number;

    private indicators: Map<HexRenderer, Indicator> = new Map();

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
    }

}