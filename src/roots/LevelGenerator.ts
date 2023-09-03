import { Grid, Traverser, rectangle, spiral } from "honeycomb-grid";
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
    stonePieces: number = 0;
    index: number;

    constructor(stones: number, index: number) {
        this.stones = stones;
        this.index = index;
    }

    get footprintRadius() {
        return this.stones - 1;
    }

    addMove(move: Tile[]) {
        this.moves.push(move);
        move.forEach(tile => tile.movesetIndex = this.index);
        move.forEach(tile => {
            this.tiles.add(tile);
            this.addFootprint(tile, this.footprint, this.footprintRadius);
        });
    }

    createFootprint(radius: number = 0) {
        let footprint = new Set<Tile>();
        this.tiles.forEach(tile => this.addFootprint(tile, footprint, radius));
        return footprint;
    }

    private addFootprint(tile: Tile, footprint: Set<Tile>, radius: number = 0) {
        const spiralTraverser = spiral({ start: tile, radius }) as Traverser<Tile>;
        tile.grid.traverse(spiralTraverser).forEach(neighbor => {
            footprint.add(neighbor);
        });
    }

    setStones(stones: number) {
        this.stones = stones;
        this.tiles.forEach(tile => this.addFootprint(tile, this.footprint, this.footprintRadius));
    }

    add(other: Moveset) {
        this.stonePieces += other.stonePieces;
        other.tiles.forEach(tile => this.tiles.add(tile));
        other.footprint.forEach(tile => this.footprint.add(tile));

        // One option: only keep the most recent move, which should be the one that joined them
        // This may cause the generator to stop, when that move isn't easy to build from
        // this.moves.splice(0, this.moves.length - 1);

        // Zipper in the other moves
        let offset = 0;
        for (let i = other.moves.length - 1; i >= 0; i--) {
            let index = Math.max(0, this.moves.length - offset - 1);
            offset++;
            this.moves.splice(index, 0, other.moves[i]);
        }
    }
}

type Cost = {id: number, cost: number};

export class LevelGenerator {

    width: number;
    height: number;
    grid: Grid<Tile>;
    tileMap: Map<number, Tile> = new Map();
    seed: string;
    stonePiecesPerStone: number = 3;
    random: () => number;

    static readonly maxStones = 6;

    static readonly maxGroupIndex = 200;

    constructor(seed: string, width: number, height: number) {
        console.log(findSubsetsThatSumTo);
        this.width = width;
        this.height = height;

        this.grid = new Grid(Tile, rectangle({ width: width, height: height }));

        let id = 0;
        this.grid.forEach(tile => {
            tile.id = id++;
            tile.grid = this.grid;
            this.tileMap.set(tile.id, tile);
        });

        this.seed = seed;
        this.random = seedrandom(seed);
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
        let stonePieces = 0;

        let findTilesMadeCloserWithGroup = (startTile: Tile, group: Tile[]) => {

            let possibleMoves = this.findUngroupedTilesWithinDistance(gridAdapter, startTile, stones - 1);
            gridAdapter.ignoreGroupingTiles = group;
            let possibleMovesWithoutGroup = this.findUngroupedTilesWithinDistance(gridAdapter, startTile, stones - 1);
            gridAdapter.ignoreGroupingTiles = [];

            let costMapWithout = new Map<number, number>();
            possibleMovesWithoutGroup.forEach(pair => costMapWithout.set(pair.id, pair.cost));

            let newlyPossiblePairs = possibleMoves
            .filter(pair => !costMapWithout.has(pair.id) || costMapWithout.get(pair.id) > pair.cost);

            // if (maximizeCostGain) {
            //     let costGain = (cost: Cost) => {
            //         let costBefore = costMap.get(cost.id);
            //         if (costBefore == null) costBefore = Number.POSITIVE_INFINITY;
            //         return costBefore - cost.cost;
            //     }

            //     // Sort from largest to smallest cost gain
            //     newlyPossiblePairs.sort((a, b) => {
            //         return costGain(b) - costGain(a);
            //     });
            //     toAdd = newlyPossiblePairs[0];
            // }

            return newlyPossiblePairs;

        }

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
                let newlyPossiblePairs = findTilesMadeCloserWithGroup(tile, dependentMove);

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

            // let totalCost = group.map(g => g.cost).reduce((a, b) => a + b, 0);

            let tileGroup = group
            .map(g => this.tileMap.get(g.id));
            tileGroup.push(tile);

            // console.log('grouping', tileGroup.map(tile => tile.id), 'for cost', totalCost, '=>', nextGroupIndex);

            tileGroup.forEach(groupTile => {
                ungroupedTiles.splice(ungroupedTiles.indexOf(groupTile), 1);
                if (groupTile.groupIndex != null) console.error("tile already has group index", groupTile.groupIndex);
                groupTile.groupIndex = nextGroupIndex;
                groupedTiles.push(groupTile);
                // if (addStone) groupTile.isStoneTile = true;
            });
            nextGroupIndex++;
            return tileGroup;
        }


        let addMoveset = () => {
            let allFootprints = new Set(movesets.flatMap(moveset => [...moveset.footprint.keys()]));

            let available = new Set<Tile>();
            ungroupedTiles.forEach(tile => available.add(tile));
            allFootprints.forEach(tile => available.delete(tile));

            if (available.size == 0) return null;

            let preferredTiles = Array.from(available).filter(tile => {
                let neighbors = tile.getNeighbors();
                return neighbors.every(neighbor => available.has(neighbor));
            });

            if (preferredTiles.length == 0) preferredTiles = Array.from(available);
            let baseTile = preferredTiles[Math.floor(this.random() * preferredTiles.length)];

            let move = createMove(baseTile, null, allFootprints);
            if (move == null) return null;

            let moveset = new Moveset(stones, movesets.length);
            moveset.addMove(move);
            return moveset;
        };

        let createNewMovesets = () => {
            let createdMovesets = 0;
            // TODO: Might be fun to add some extra, non-required movesets at some point
            let extraMovesets = 0; // Math.floor(this.random() * 3);
            let targetMovesets = this.stonePiecesPerStone + extraMovesets;
            for (let i = 0; i < 20 && movesets.length < targetMovesets; i++) {
                let moveset = addMoveset();
                if (moveset != null) {
                    movesets.push(moveset);
                    createdMovesets++;
                }
            }
            console.log('created', createdMovesets, 'new movesets');
            return createdMovesets > 0;
        };

        let selectNextBaseTile = (moveset: Moveset, disallowedTiles: Set<Tile>, useMostRecentMove = false) => {
            let moves = moveset.moves;
            let index = moves.length - 1;
            if (!useMostRecentMove) {
                while (index > 0 && this.random() > 0.4) index--;
            }

            let dependentMove = moves[index];
            // console.log('dependent move', dependentMove);
            let possibleStartingTiles = new Set<Tile>();
            dependentMove.forEach(tile => {
                this.findUngroupedTilesWithinDistance(gridAdapter, tile, stones - 1)
                .forEach(pair => possibleStartingTiles.add(this.tileMap.get(pair.id)));
            });
            let originalStartingTiles = new Set(possibleStartingTiles);
            removeAllFrom(possibleStartingTiles, disallowedTiles);
            dependentMove.forEach(tile => possibleStartingTiles.delete(tile));
            if (possibleStartingTiles.size == 0) {
                console.log('no possible starting tiles for dependent move', dependentMove, disallowedTiles, originalStartingTiles);
                return null;
            }
            let tile = Array.from(possibleStartingTiles)[Math.floor(this.random() * possibleStartingTiles.size)];
            // console.log('tadm', tile, ...dependentMove);
            return {tile, dependentMove};
        };

        let tryJoinMovesets = (joiner: Moveset, receiver: Moveset, encroachingTile: Tile) => {
            // Find tiles that are accessible from the last move's encroaching tile,
            // but only when the receiver is present. These are valid start tiles.
            let requiredTiles = [...receiver.tiles.keys()];
            // TODO: Is it sufficient to just be closer or must it be only reachable with the receiver moveset present?
            let startTileOptions = findTilesMadeCloserWithGroup(encroachingTile, requiredTiles);
            if (startTileOptions.length == 0) return null;
            let startTile = startTileOptions[Math.floor(this.random() * startTileOptions.length)];

            let otherMovesets = movesets.filter(moveset => moveset != joiner && moveset != receiver);
            let otherFootprints = new Set(otherMovesets.flatMap(moveset => [...moveset.footprint.keys()]));
            // If the move requires both the receiver and the encroaching tile, it should join the movesets
            let move = createMove(this.tileMap.get(startTile.id), [encroachingTile], otherFootprints, );

            return move;
        }

        // TODO: Still some black tiles - could bail out early with a fix
        let maxAttempts = 50;
        let attemptsSinceLastProgress = 0;
        let allowNonMinMovesets = false;

        // seed with initial movesets
        createNewMovesets();
        console.log('initial movesets', movesets);

        while (ungroupedTiles.length >= stones && nextGroupIndex < LevelGenerator.maxGroupIndex) {
            attemptsSinceLastProgress++;
            if (attemptsSinceLastProgress > maxAttempts) {
                // If we've tried enough with unions allowed, we're really stuck, so bail out
                if (allowNonMinMovesets) {
                    break;
                }
                // If not, allow unions and keep trying
                allowNonMinMovesets = true;
                attemptsSinceLastProgress = 0;
            }

            // Prioritize movesets that are at the minimum number of stone pieces
            let minStonePieces = movesets.reduce((min, moveset) => Math.min(min, moveset.stonePieces), Number.POSITIVE_INFINITY);
            let targetMovesets = movesets;
            if (!allowNonMinMovesets) {
                targetMovesets = targetMovesets.filter(moveset => moveset.stonePieces == minStonePieces);
            }
            // Select a random one
            let moveset = targetMovesets[Math.floor(this.random() * targetMovesets.length)];

            // Probably don't need this anymore - joining movesets is always allowed currently
            // let disallowedTiles = new Set<Tile>();
            // movesets.forEach(ms => {
            //     if (ms == moveset) return;
            //     ms.footprint.forEach(tile => disallowedTiles.add(tile));
            // });

            let createStoneMove = (stones < LevelGenerator.maxStones) &&
                (this.random() * moveset.tiles.size > (stones - 1) * 5);

            let next = selectNextBaseTile(moveset, new Set(), createStoneMove);
            if (next == null) continue;
            let {tile, dependentMove} = next;
            let move = createMove(tile, dependentMove);
            if (move == null) continue;
            moveset.addMove(move);

            // We've made progress, so reset the attempts counter
            attemptsSinceLastProgress = 0;
            allowNonMinMovesets = false;

            // If this move created stone tiles, increase the moveset's
            // stone piece count, as well as the total number of stone pieces
            if (createStoneMove) {
                move.forEach(tile => tile.isStoneTile = true);
                moveset.stonePieces++;
                stonePieces++;
            }

            // If we've created enough stone pieces to add a stone, do so
            if (stonePieces == this.stonePiecesPerStone) {
                stonePieces = 0;
                stones++;
                movesets.forEach(ms => ms.setStones(stones));
                createNewMovesets();
            }


            // If this move allows to movesets to interfere with each other,
            // create a move that joins them
            for (let i = 0; i < movesets.length; i++) {
                let ms = movesets[i];
                if (ms == moveset) continue;

                let encroachingTiles = move.filter(t => ms.footprint.has(t))
                if (encroachingTiles.length > 0) {

                    console.log('joining movesets', moveset, ms);
                    moveset.add(ms);
                    movesets.splice(i, 1);
                    i--;

                    for (let encroachingTile of encroachingTiles) {
                        let joiningMove = tryJoinMovesets(moveset, ms, encroachingTile);
                        if (joiningMove == null) continue;
                        moveset.addMove(joiningMove);
                        // Take the first move that works, ignore the rest
                        break;
                    }
                }
            };
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