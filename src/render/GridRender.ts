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
    hexes: HexRenderer[] = [];
    hoverGroupIndex: number = -1;

    width: number;
    height: number;

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
        if (index === undefined) return;
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

    update(delta: number) {
        this.hexes.forEach(hexRenderer => {
            hexRenderer.update(delta);
        });
    }

}