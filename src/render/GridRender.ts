import { Grid } from "honeycomb-grid";
import { Tile, tileSize } from "../roots/Tile";
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

        let width = (renderer.game.width + 1) * tileSize * Math.sqrt(3);
        let height = renderer.game.height * tileSize * 1.5;
        this.container.x = -width / 2;
        this.container.y = -height / 2;
        console.log(width);
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
            hexRenderer.refresh();
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
            hexRenderer.refresh();
        });
    }

    update(delta: number) {
        this.children.forEach(hexRenderer => {
            hexRenderer.update(delta);
        });
    }

}