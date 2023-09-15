import { Grid, defineHex } from "honeycomb-grid";
import { Roots } from "./Roots";

export type TileData = {
    unlocked: boolean;
    groupIndex: number;
    isStoneTile: boolean;
    movesetIndex: number;
}

export const tileSize = 30;

export class Tile extends defineHex({ dimensions: tileSize, origin: "topLeft" }) {

    // serializable fields
    id: number;
    groupIndex: number;
    isStoneTile: boolean = false;
    unlocked: boolean = false;
    movesetIndex: number;

    grid: Grid<Tile>;
    // active: boolean = false;
    groupCount: number;
    game: Roots;

    serialize(): TileData {
        return {
            unlocked: this.unlocked,
            groupIndex: this.groupIndex,
            isStoneTile: this.isStoneTile,
            movesetIndex: this.movesetIndex,
        };
    }

    deserialize(id: number, data: TileData) {
        this.id = id;
        this.unlocked = data.unlocked;
        this.groupIndex = data.groupIndex;
        this.isStoneTile = data.isStoneTile;
        this.movesetIndex = data.movesetIndex;
    }

    // isPassable() {
    //     return this.active || this.unlocked;
    // }

    // clicked(doubleClick: boolean = false) {
    //     if (this.unlocked) return;
    //     this.game.tileClicked(this, doubleClick);
    // }

    getNeighbors(nullPlaceholders = false): Tile[] {
        let neighbors = [];
        for (let i = 0; i < 8; i++) {
            let neighbor = this.grid.neighborOf(this, i, {allowOutside: false});
            if (neighbor) {
                neighbors.push(neighbor);
            } else if (nullPlaceholders) {
                neighbors.push(null);
            }
        }
        return neighbors;
    }
}