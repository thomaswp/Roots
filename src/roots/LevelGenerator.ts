import { Grid, rectangle } from "honeycomb-grid";
import { Tile } from "./Tile";
import { Edge, dijkstra, IGraphAdapter } from "../util/Dijkstra";

class GridAdapter implements IGraphAdapter<Tile> {
    grid: Grid<Tile>;
    ignoreGroupingTiles: Tile[] = [];

    constructor(grid: Grid<Tile>) {
        this.grid = grid;
    }

    getKey(node: Tile) {
        return node.id;
    }

    getEdges(node: Tile) {
        let baseWeight = this.getWeight(node);
        return node.getNeighbors().map(neighbor => {
            let weight = baseWeight + this.getWeight(neighbor);
            return {
                node: neighbor,
                weight,
            } as Edge<Tile>;
        });
    }

    getWeight(tile: Tile) {
        return (tile.groupIndex == null || 
            this.ignoreGroupingTiles.includes(tile)) ? 
            0.5 : 0;
    }
}

type Cost = {id: number, cost: number};

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

    private findUngroupedTilesWithinDistance(adapter: GridAdapter, tile: Tile, distance: number): Cost[] {
        let paths = dijkstra(adapter, tile, null, distance);
        return Object.entries(paths.costs).map(([key, value]) => {
            return { id: parseInt(key), cost: value };
        }).filter(pair => 
            // shouldn't be necessary, since all ungrouped will be at least 1 away
            // pair.cost >= 1 &&
            pair.id != tile.id && 
            this.tileMap.get(pair.id).groupIndex == null
        );
    }

    generate() {
        let gridAdapter = new GridAdapter(this.grid);

        let groupedTiles = [];
        let ungroupedTiles = this.grid.toArray();

        let moves: Tile[][] = [];

        let nextGroupIndex = 0;

        let stones = 2;
        // TODO: Still some black tiles - could bail out early with a fix
        let attempts = 500;
        while (attempts > 0 && ungroupedTiles.length >= stones && nextGroupIndex < LevelGenerator.maxGroupIndex) {
            attempts--;

            let tile: Tile = null;
            let dependentMove: Tile[] = [];

            // There's some chance we create a new group, not (intentionally) adjacent to any other group
            if (groupedTiles.length == 0) { // || Math.random() > 2 / (stones + 3)) {
                tile = ungroupedTiles[Math.floor(Math.random() * ungroupedTiles.length)];
            } else {
                // // // Otherwise, we want to find a tile that is adjacent to a group
                // let tries = 5;
                // while (tile == null && tries > 0) {
                //     // TODO: This assumes that more recently added tiles are more "interesting" or necessary, but that's
                //     // not necessarily the case
                //     let neighbor = groupedTiles[Math.floor(Math.random() * Math.min(stones * 2, groupedTiles.length))];
                //     let possibleTiles = neighbor.getNeighbors().filter(neighbor => neighbor.groupIndex == null);
                //     if (possibleTiles.length > 0) {
                //         tile = possibleTiles[Math.floor(Math.random() * possibleTiles.length)];
                //         addingAdjacent = true;
                //         break;
                //     }
                //     tries--;
                // }

                // // If we failed to find a base tile near a group, choose randomly
                // if (tries == 0) {
                //     tile = ungroupedTiles[Math.floor(Math.random() * ungroupedTiles.length)];
                // }

                dependentMove = moves[moves.length - 1];
                console.log('dependent move', dependentMove);
                let possibleStartingTiles = new Set<Tile>();
                dependentMove.forEach(tile => {
                    this.findUngroupedTilesWithinDistance(gridAdapter, tile, stones - 1)
                    .forEach(pair => possibleStartingTiles.add(this.tileMap.get(pair.id)));
                });
                if (possibleStartingTiles.size == 0) {
                    console.log('no possible starting tiles for dependent move', dependentMove);
                    break; // TODO: Look for move(s) that will actually work, not always last
                }
                tile = Array.from(possibleStartingTiles)[Math.floor(Math.random() * possibleStartingTiles.size)];
            }
            console.log('attempting to group with tile', tile.id, tile);

            let maxPathCost = stones - 1;
            let possiblePairs = this.findUngroupedTilesWithinDistance(gridAdapter, tile, maxPathCost);
            console.log('found possible pairs', possiblePairs.slice());
            if (possiblePairs.length == 0) continue;

            let remainingStones = stones - 1;
            let group: ({id: number, cost: number})[];
            group = [];

            let addPair = (added: Cost) => {
                group.push(added);
                remainingStones -= added.cost;
                possiblePairs = possiblePairs.filter(pair => pair.id != added.id && pair.cost <= remainingStones);
            }

            if (dependentMove.length > 0) {
                gridAdapter.ignoreGroupingTiles = dependentMove;
                let possibleIDsBeforeDependentMove = this.findUngroupedTilesWithinDistance(gridAdapter, tile, maxPathCost)
                .map(pair => pair.id);
                gridAdapter.ignoreGroupingTiles = [];

                let newlyPossiblePairs = possiblePairs
                .filter(pair => !possibleIDsBeforeDependentMove.includes(pair.id));

                // Wouldn't normally need to break, but for testing
                if (newlyPossiblePairs.length == 0) {
                    console.log('no newly possible pairs');
                    break;
                }
                let toAdd = newlyPossiblePairs[Math.floor(Math.random() * newlyPossiblePairs.length)];
                addPair(toAdd);
            }

            // Greedy approach: choose a random tile (which can be reached with the remaining stones)
            // and add it to the group; then adjust possible pairs based on the remaining stones
            // Note: this may result in a group that is below the target cost, but it's
            // possible that no group exists that is exactly the target cost, and even if it exists
            // finding it is very computationally expensive
            while (possiblePairs.length > 0 && remainingStones > 0) {
                let addedIndex = Math.floor(Math.random() * possiblePairs.length); 
                let added = possiblePairs[addedIndex];
                addPair(added);
            }
            console.log('costgroup', group)

            let totalCost = group.map(g => g.cost).reduce((a, b) => a + b, 0);
            
            let tileGroup = group
            .map(g => this.tileMap.get(g.id));
            tileGroup.push(tile);
            this.groups.push(tileGroup);
            
            console.log('grouping', tileGroup.map(tile => tile.id), 'for cost', totalCost, '=>', nextGroupIndex);

            // TODO: May need some special logic to make these, which requires that they
            // maximize use of existing tiles (e.g. maximize grid distance)
            // That could also just be a baseline heuristic
            let addStone = stones < this.maxStones && groupedTiles.length * Math.random() > Math.pow(stones, 2.5) * 3;
            if (addStone) stones++;

            tileGroup.forEach(groupTile => {
                ungroupedTiles.splice(ungroupedTiles.indexOf(groupTile), 1);
                if (groupTile.groupIndex != null) console.error("tile already has group index", groupTile.groupIndex);
                groupTile.groupIndex = nextGroupIndex;
                groupTile.groupCount = tileGroup.length;
                groupedTiles.push(groupTile);
                if (addStone) groupTile.isStoneTile = true;
            });
            moves.push(tileGroup);

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