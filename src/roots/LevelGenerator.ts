import { Grid, rectangle } from "honeycomb-grid";
import { Tile } from "./Tile";
import { Edge, dijkstra, IGraphAdapter } from "../util/Dijkstra";
import seedrandom from 'seedrandom'

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

class Moveset {
    readonly tiles: Set<Tile> = new Set();
    readonly footprint: Set<Tile> = new Set();
    readonly moves: Tile[][] = [];
    stones: number;

    constructor(stones: number) {
        this.stones = stones;
    }

    addMove(move: Tile[]) {
        this.moves.push(move);
        move.forEach(tile => {
            this.tiles.add(tile);
            this.addFootprint(tile, this.footprint, this.stones);
        });
    }

    private addFootprint(tile: Tile, footprint: Set<Tile>, recurse: number = 0) {
        if (recurse < 0) return;
        footprint.add(tile);
        if (recurse > 0) {
            tile.getNeighbors().forEach(neighbor => this.addFootprint(neighbor, footprint, recurse - 1));
        }
    }

    setStones(stones: number) {
        this.stones = stones;
        this.tiles.forEach(tile => this.addFootprint(tile, this.footprint, this.stones));
    }

    add(other: Moveset) {
        other.tiles.forEach(tile => this.tiles.add(tile));
        other.footprint.forEach(tile => this.footprint.add(tile));
        // TODO: need to preserve some sense of order when merging
        other.moves.forEach(move => this.moves.push(move));
        // Join the moves of the two movesets, such that the last moves are zippered together
    }
}

type Cost = {id: number, cost: number};

export class LevelGenerator {

    width: number;
    height: number;
    grid: Grid<Tile>;
    groups: Tile[][];
    tileMap: Map<number, Tile> = new Map();
    random: () => number;

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

        this.random = seedrandom("1231");
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

        let movesets: Moveset[] = [];

        let nextGroupIndex = 0;

        let stones = 2;

        let createMove = (tile: Tile, dependentMove: Tile[] = null, disallowedTiles: Set<Tile> = new Set()) => {

            // console.log('attempting to group with tile', tile.id, tile);

            let maxPathCost = stones - 1;
            let possiblePairs = this.findUngroupedTilesWithinDistance(gridAdapter, tile, maxPathCost);
            possiblePairs = possiblePairs.filter(pair => !disallowedTiles.has(this.tileMap.get(pair.id)));
            // console.log('found possible pairs', possiblePairs.slice());
            if (possiblePairs.length == 0) return null;

            let remainingStones = stones - 1;
            let group: ({id: number, cost: number})[];
            group = [];

            let addPair = (added: Cost) => {
                group.push(added);
                remainingStones -= added.cost;
                possiblePairs = possiblePairs.filter(pair => pair.id != added.id && pair.cost <= remainingStones);
            }

            if (dependentMove != null) {
                gridAdapter.ignoreGroupingTiles = dependentMove;
                let possiblePairsBeforeDependentMove = this.findUngroupedTilesWithinDistance(gridAdapter, tile, maxPathCost);
                gridAdapter.ignoreGroupingTiles = [];

                let costMap = new Map<number, number>();
                possiblePairsBeforeDependentMove.forEach(pair => costMap.set(pair.id, pair.cost));

                let newlyPossiblePairs = possiblePairs
                .filter(pair => !costMap.has(pair.id) || costMap.get(pair.id) > pair.cost);

                // Wouldn't normally need to break, but for testing
                if (newlyPossiblePairs.length == 0) {
                    console.log('no newly possible pairs');
                    // TODO: Need a more robust solution: this can get pretty expensive
                    return null;
                }
                let toAdd = newlyPossiblePairs[Math.floor(this.random() * newlyPossiblePairs.length)];
                addPair(toAdd);
            }

            // Greedy approach: choose a random tile (which can be reached with the remaining stones)
            // and add it to the group; then adjust possible pairs based on the remaining stones
            // Note: this may result in a group that is below the target cost, but it's
            // possible that no group exists that is exactly the target cost, and even if it exists
            // finding it is very computationally expensive
            while (possiblePairs.length > 0 && remainingStones > 0) {
                let addedIndex = Math.floor(this.random() * possiblePairs.length); 
                let added = possiblePairs[addedIndex];
                addPair(added);
            }
            // console.log('costgroup', group)

            let totalCost = group.map(g => g.cost).reduce((a, b) => a + b, 0);
            
            let tileGroup = group
            .map(g => this.tileMap.get(g.id));
            tileGroup.push(tile);
            this.groups.push(tileGroup);
            
            // console.log('grouping', tileGroup.map(tile => tile.id), 'for cost', totalCost, '=>', nextGroupIndex);

            tileGroup.forEach(groupTile => {
                ungroupedTiles.splice(ungroupedTiles.indexOf(groupTile), 1);
                if (groupTile.groupIndex != null) console.error("tile already has group index", groupTile.groupIndex);
                groupTile.groupIndex = nextGroupIndex;
                groupTile.groupCount = tileGroup.length;
                groupedTiles.push(groupTile);
                // if (addStone) groupTile.isStoneTile = true;
            });
            nextGroupIndex++;
            return tileGroup;
        }


        let addMoveset = () => {
            let available = new Set<Tile>();
            ungroupedTiles.forEach(tile => available.add(tile));
            movesets.forEach(moveset => moveset.footprint.forEach(tile => available.delete(tile)));

            if (available.size == 0) return null;

            let preferredTiles = Array.from(available).filter(tile => {
                let neighbors = tile.getNeighbors();
                return neighbors.every(neighbor => available.has(neighbor));
            });

            if (preferredTiles.length == 0) preferredTiles = Array.from(available);
            let baseTile = preferredTiles[Math.floor(this.random() * preferredTiles.length)];

            let move = createMove(baseTile);
            if (move == null) return null;

            let moveset = new Moveset(stones);
            moveset.addMove(move);
            return moveset;
        };

        let createNewMovesets = () => {
            let reduction = Math.ceil((stones - 2) / 2);
            let maxMovesets = 4 - reduction, minMovesets = Math.max(0, 1 - reduction);
            let nMovesets= Math.floor(this.random() * (maxMovesets - minMovesets + 1)) + minMovesets;
            let createdMovesets = 0;
            for (let i = 0; i < nMovesets; i++) {
                let moveset = addMoveset();
                if (moveset != null) {
                    movesets.push(moveset);
                    createdMovesets++;
                }
            }
            console.log('created', createdMovesets, 'new movesets');
            return createdMovesets > 0;
        };

        let selectNextBaseTile = (moveset: Moveset, disallowedTiles: Set<Tile>) => {
            let moves = moveset.moves;
            let index = moves.length - 1;
            while (index > 0 && this.random() > 0.4) index--;
            let dependentMove = moves[index];
            // console.log('dependent move', dependentMove);
            let possibleStartingTiles = new Set<Tile>();
            dependentMove.forEach(tile => {
                this.findUngroupedTilesWithinDistance(gridAdapter, tile, stones - 1)
                .forEach(pair => possibleStartingTiles.add(this.tileMap.get(pair.id)));
            });
            removeAllFrom(possibleStartingTiles, disallowedTiles);
            // console.log('possible starting tiles', [...possibleStartingTiles.keys()].map(tile => tile.id));
            dependentMove.forEach(tile => possibleStartingTiles.delete(tile));
            if (possibleStartingTiles.size == 0) {
                console.log('no possible starting tiles for dependent move', dependentMove);
                return null;
            }
            let tile = Array.from(possibleStartingTiles)[Math.floor(this.random() * possibleStartingTiles.size)];
            // console.log('tadm', tile, ...dependentMove);
            return {tile, dependentMove};
        };

        let allowUnions = () => {
            // TODO: May need some special logic to make these, which requires that they
            // maximize use of existing tiles (e.g. maximize grid distance)
            // That could also just be a baseline heuristic
            return groupedTiles.length * this.random() > Math.pow(stones, 2.5) * 2.5;
        }

        // seed with initial movesets
        createNewMovesets();
        console.log('initial movesets', movesets);

        // TODO: Still some black tiles - could bail out early with a fix
        let attempts = 500;
        while (attempts > 0 && ungroupedTiles.length >= stones && nextGroupIndex < LevelGenerator.maxGroupIndex) {
            attempts--;
            
            let moveset = movesets[Math.floor(this.random() * movesets.length)];
            let priorFootprint = new Set(moveset.footprint);

            let disallowedTiles = new Set<Tile>();
            movesets.forEach(ms => {
                if (ms == moveset) return;
                ms.footprint.forEach(tile => disallowedTiles.add(tile));
            });

            let next = selectNextBaseTile(moveset, disallowedTiles);
            if (next == null) continue;
            let {tile, dependentMove} = next;
            if (disallowedTiles.has(tile)) console.error('disallowed tile', tile);
            let move = createMove(tile, dependentMove, allowUnions() ? new Set() : disallowedTiles);
            if (move == null) continue;
            moveset.addMove(move);

            // If a tile was places outside of the footprint of the moveset (before this move)
            // then it must have been connecting with another moveset
            if (move.some(tile => !priorFootprint.has(tile))) {
                for (let i = 0; i < movesets.length; i++) {
                    let ms = movesets[i];
                    if (ms == moveset) continue;
                    if (ms.footprint.has(tile)) {
                        moveset.add(ms);
                        movesets.splice(i, 1);
                        i--;
                        break;
                    }
                };
                if (stones < this.maxStones) {
                    move.forEach(tile => {
                        tile.isStoneTile  = true;
                    });
                    stones++;
                    movesets.forEach(ms => ms.setStones(stones));
                }
                createNewMovesets();
            }
            
            // TODO: Join movesets, incremenet stones and create new movesets
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

function removeAllFrom(set: Set<any>, toRemove: Set<any>) {
    toRemove.forEach(item => set.delete(item));
}

function intersect<T>(a: Set<T>, b: Set<T>): Set<T> {
    let result = new Set<T>();
    a.forEach(item => {
        if (b.has(item)) result.add(item);
    });
    return result;
}