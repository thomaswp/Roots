import { Grid } from "honeycomb-grid";
import { Tile } from "../roots/Tile";
import * as PIXI from "pixi.js";
import { Container } from "pixi.js";
import { GameRenderer } from "./GameRenderer";
import { HexRenderer } from "./HexRenderer";

export class GridRenderer {

    renderer: GameRenderer
    grid: Grid<Tile>;

    container: Container;
    children: HexRenderer[] = [];
    hoverGroupIndex: number = -1;

    constructor(renderer: GameRenderer, grid: Grid<Tile>) {
        this.grid = grid;
        this.renderer = renderer;
        this.container = new PIXI.Container();
        this.container.sortableChildren = true;
    }

    init() {
        this.grid.forEach(tile => {
            let hexRenderer = new HexRenderer(tile, this);
            this.children.push(hexRenderer);
            this.container.addChild(hexRenderer);
        });
    }

    refresh() {
        this.children.forEach(hexRenderer => {
            hexRenderer.redraw();
        });
    }

    updateHover(index: number, hover: boolean) {
        let oldIndex = this.hoverGroupIndex;
        this.hoverGroupIndex = hover ? index : -1;
        this.children
        .filter(hexRenderer => {
            return hexRenderer.tile.groupIndex === oldIndex || 
                hexRenderer.tile.groupIndex === index
        })
        .forEach(hexRenderer => {
            hexRenderer.redraw();
        });
    }

    update(delta: number) {
    }

}