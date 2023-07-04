import { Grid, defineHex } from "honeycomb-grid";
import { Roots } from "./Roots";

export class Tile extends defineHex({ dimensions: 30, origin: "topLeft" }) {
  
    // this property is present in the instance
    id: number;
    grid: Grid<Tile>;
    unlocked: boolean = false;
    active: boolean = false;
    groupIndex: number;
    groupCount: number;
    game: Roots;
    isStoneTile: boolean = false;
  
    isPassable() {
        return this.active || this.unlocked;
    }

    clicked() {
        if (this.unlocked) return;
        this.game.tileClicked(this);
    }

    getNeighbors() {
        let neighbors = [];
        for (let i = 0; i < 8; i++) {
            let neighbor = this.grid.neighborOf(this, i, {allowOutside: false});
            if (neighbor) {
                neighbors.push(neighbor);
            }
        }
        return neighbors;
    }

    getPassableNeighbors() {
        return this.getNeighbors().filter(neighbor => neighbor.isPassable());
    }

}