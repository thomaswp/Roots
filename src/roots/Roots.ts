import { defineHex, Grid, rectangle } from "honeycomb-grid";
import * as PIXI from "pixi.js";
import { Tile } from "./Tile";

export class Roots {

    grid: Grid<Tile>;
    maxGroupIndex;

    constructor() {

        // 2. Create a grid by passing the class and a "traverser" for a rectangular-shaped grid:
        this.grid = new Grid(Tile, rectangle({ width: 20, height: 15 }))

        this.maxGroupIndex = 50;
        let indexes = Array.from(Array(this.maxGroupIndex).keys());
        this.grid.forEach(tile => {
            tile.game = this;
            tile.groupIndex = indexes[Math.floor(Math.random() * indexes.length)]
        });
        this.grid.getHex([5, 8]).active = true;

        // 3. Iterate over the grid to log each hex:
        // grid.forEach(tile => tile.)
    }

    tileClicked(tile: Tile) {
        tile.tempActive = !tile.tempActive;
    }
}