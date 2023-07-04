import { Grid, rectangle } from "honeycomb-grid";
import { Tile } from "./Tile";
import { Edge, dijkstra, IGraphAdapter } from "../util/Dijkstra";

class GridAdapter implements IGraphAdapter<Tile> {
    grid: Grid<Tile>;

    constructor(grid: Grid<Tile>) {
        this.grid = grid;
    }

    getKey(node: Tile) {
        return node.id;
    }

    getEdges(node: Tile) {
        let baseWeight = node.groupIndex == null ? 0.5 : 0;
        return node.getNeighbors().map(neighbor => {
            let weight = baseWeight + (neighbor.groupIndex == null ? 0.5 : 0);
            return {
                node: neighbor,
                weight,
            } as Edge<Tile>;
        });
    }
}

export class LevelGenerator {

    width: number;
    height: number;
    grid: Grid<Tile>;
    groups: Tile[][];
    tileMap: Map<number, Tile> = new Map();

    maxStones = 6;

    static readonly maxGroupIndex = 200;

    constructor(width: number, height: number) {
        console.log(findSubsetsThatSumTo);
        this.width = width;
        this.height = height;

        this.grid = new Grid(Tile, rectangle({ width: 20, height: 15 }));
        this.groups = [];

        let id = 0;
        this.grid.forEach(tile => {
            tile.id = id++;
            tile.grid = this.grid;
            this.tileMap.set(tile.id, tile);
        });
    }

    generate() {
        let gridAdapter = new GridAdapter(this.grid);

        let groupedTiles = [];
        let ungroupedTiles = this.grid.toArray();

        let nextGroupIndex = 0;

        let stones = 2;
        // TODO: Still some black tiles - could bail out early with a fix
        let attempts = 500;
        while (attempts > 0 && ungroupedTiles.length >= stones && nextGroupIndex < LevelGenerator.maxGroupIndex) {
            attempts--;

            let addingAdjacent = false;
            let tile: Tile = null;
            // There's some chance we create a new group, not (intentionally) adjacent to any other group
            if (groupedTiles.length == 0 || Math.random() > 2 / (stones + 3)) {
                tile = ungroupedTiles[Math.floor(Math.random() * ungroupedTiles.length)];
            } else {
                // // Otherwise, we want to find a tile that is adjacent to a group
                let tries = 5;
                while (tile == null && tries > 0) {
                    // TODO: This assumes that more recently added tiles are more "interesting" or necessary, but that's
                    // not necessarily the case
                    let neighbor = groupedTiles[Math.floor(Math.random() * Math.min(stones * 2, groupedTiles.length))];
                    let possibleTiles = neighbor.getNeighbors().filter(neighbor => neighbor.groupIndex == null);
                    if (possibleTiles.length > 0) {
                        tile = possibleTiles[Math.floor(Math.random() * possibleTiles.length)];
                        addingAdjacent = true;
                        break;
                    }
                    tries--;
                }

                // If we failed to find a base tile near a group, choose randomly
                if (tries == 0) {
                    tile = ungroupedTiles[Math.floor(Math.random() * ungroupedTiles.length)];
                }
            }
            console.log('attempting to group with tile', tile.id, tile);

            let maxPathCost = stones - 1;
            let paths = dijkstra(gridAdapter, tile, null, maxPathCost);
            let possiblePairs = Object.entries(paths.costs).map(([key, value]) => {
                return { id: parseInt(key), cost: value };
            }).filter(pair => 
                pair.cost >= 1 && 
                pair.id != tile.id && 
                this.tileMap.get(pair.id).groupIndex == null
            );
            console.log('found possible pairs', possiblePairs.slice());
            if (possiblePairs.length == 0) continue;


            // Greedy approach: choose a random tile (which can be reached with the remaining stones)
            // and add it to the group; then adjust possible pairs based on the remaining stones
            // Note: this may result in a group that is below the target cost, but it's
            // possible that no group exists that is exactly the target cost, and even if it exists
            // finding it is very computationally expensive
            let remainingStones = stones - 1;
            let group: ({id: number, cost: number})[];
            group = [];
            while (possiblePairs.length > 0 && remainingStones > 0) {
                let addedIndex = Math.floor(Math.random() * possiblePairs.length); 
                let added = possiblePairs[addedIndex] 
                group.push(added);
                remainingStones -= added.cost;
                possiblePairs.splice(addedIndex, 1);
                possiblePairs = possiblePairs.filter(pair => pair.cost <= remainingStones);
            }
            console.log('costgroup', group)

            // Alternative, exact approach: seems to be too computationally expensive
            // let possibleGroups = findSubsetsThatSumTo(remainingStones, possiblePairs.map(pair => pair.cost));
            // console.log('found possible groups summing to ' + remainingStones, possibleGroups);
            // if (possibleGroups.length == 0) continue;
            // let group = possibleGroups[Math.floor(Math.random() * possibleGroups.length)];
            // let group = [Math.floor(Math.random() * possiblePairs.length)];


            let totalCost = group.map(g => g.cost).reduce((a, b) => a + b, 0);
            
            let tileGroup = group
            .map(g => this.tileMap.get(g.id));
            tileGroup.push(tile);
            this.groups.push(tileGroup);
            
            console.log('grouping', tileGroup.map(tile => tile.id), 'for cost', totalCost, '=>', nextGroupIndex);

            // TODO: May need some special logic to make these, which requires that they
            // maximize use of existing tiles (e.g. maximize grid distance)
            // That could also just be a baseline heuristic
            let addStone = stones < this.maxStones && addingAdjacent && groupedTiles.length * Math.random() > Math.pow(stones, 2.5) * 3;
            if (addStone) stones++;

            tileGroup.forEach(groupTile => {
                ungroupedTiles.splice(ungroupedTiles.indexOf(groupTile), 1);
                if (groupTile.groupIndex != null) console.error("tile already has group index", groupTile.groupIndex);
                groupTile.groupIndex = nextGroupIndex;
                groupTile.groupCount = tileGroup.length;
                groupedTiles.push(groupTile);
                if (addStone) groupTile.isStoneTile = true;
            });

            console.log('remaining ungrouped tiles', ungroupedTiles.length);

            nextGroupIndex++;
        }
        return this.grid;
    }
}

function findSubsetsThatSumTo(target: number, numbers: number[]) {
    let wheel = [0];
    let resultsCount = 0;
    let sum = 0;

    let sumIndices = [];

    do {
        sum = incrementWheel(0, sum, numbers, wheel);
        //Use subtraction comparison due to javascript float imprecision
        if (sum != null && Math.abs(target - sum) < 0.000001) {
            //Found a subset. Add the result.
            sumIndices.push([...wheel.keys()].filter(i => wheel[i] === 1));
            resultsCount++;
        }
    } while (sum != null);
    return sumIndices;
}

function incrementWheel(position, sum, numbers, wheel) {
    if (position === numbers.length || sum === null) {
        return null;
    }
    wheel[position]++;
    if (wheel[position] === 2) {
        wheel[position] = 0;
        sum -= numbers[position];
        if (wheel.length < position + 2) {
            wheel.push(0);
        }
        sum = incrementWheel(position + 1, sum, numbers, wheel);
    }
    else {
        sum += numbers[position];
    }
    return sum;
}