import { Grid, defineHex } from "honeycomb-grid";
import { Roots } from "./Roots";

export type TileData = {
    unlocked: boolean;
    groupIndex: number;
    isStoneTile: boolean;
    movesetIndex: number;
}

export const tileSize = 30;

export function defineTileHex() {
    return defineHex({ dimensions: tileSize, origin: {x: 0, y: 0}});
}

export class Tile extends defineTileHex() {

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
    borderingGroupTiles: Set<Tile>;

    get hasGroup() {
        return this.groupIndex != undefined;
    }

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

    getBorderingGroupTiles() {
        if (this.hasGroup) return null;
        if (this.borderingGroupTiles) return this.borderingGroupTiles;
        let checked = new Set<Tile>();
        let bordering = new Set<Tile>();
        Tile.addBorderingGroupTiles(this, checked, bordering);
        this.borderingGroupTiles = bordering;
        return bordering;
    }

    private static addBorderingGroupTiles(tile: Tile, checked: Set<Tile>, bordering: Set<Tile>) {
        if (checked.has(tile)) return;
        checked.add(tile);
        if (tile.hasGroup) {
            bordering.add(tile);
            return;
        }
        tile.getNeighbors().forEach(neighbor => {
            this.addBorderingGroupTiles(neighbor, checked, bordering);
        });
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