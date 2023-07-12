import { Grid, defineHex } from "honeycomb-grid";
import { Roots } from "./Roots";

export type TileData = {
    unlocked: boolean;
    groupIndex: number;
    isStoneTile: boolean;
}

export const tileSize = 30;

export class Tile extends defineHex({ dimensions: tileSize, origin: "topLeft" }) {
  
    // serializable fields
    id: number;
    groupIndex: number;
    isStoneTile: boolean = false;
    unlocked: boolean = false;

    grid: Grid<Tile>;
    // active: boolean = false;
    groupCount: number;
    game: Roots;

    serialize(): TileData {
        return {
            unlocked: this.unlocked,
            groupIndex: this.groupIndex,
            isStoneTile: this.isStoneTile,
        };
    }

    deserialize(id: number, data: TileData) {
        this.id = id;
        this.unlocked = data.unlocked;
        this.groupIndex = data.groupIndex;
        this.isStoneTile = data.isStoneTile;
    }
  
    // isPassable() {
    //     return this.active || this.unlocked;
    // }

    // clicked(doubleClick: boolean = false) {
    //     if (this.unlocked) return;
    //     this.game.tileClicked(this, doubleClick);
    // }

    getNeighbors(): Tile[] {
        let neighbors = [];
        for (let i = 0; i < 8; i++) {
            let neighbor = this.grid.neighborOf(this, i, {allowOutside: false});
            if (neighbor) {
                neighbors.push(neighbor);
            }
        }
        return neighbors;
    }
}