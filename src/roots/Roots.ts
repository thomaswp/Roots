import { defineHex, Direction, Grid, rectangle } from "honeycomb-grid";
import { Tile, TileData } from "./Tile";
import { Clustering } from "./Clustering";
import { LevelGenerator } from "./LevelGenerator";
import { v4 as uuidv4 } from 'uuid';
import { Event } from "../util/Event";

export type GameData = {
    guid: string;
    seed: string;
    width: number;
    height: number;
    tiles: TileData[];
    nStones: number;
    nStonePieces: number;
    nStonePiecesPerStone: number;
}

export class Roots {

    // serializable fields
    guid: string;
    width = 20;
    height = 15;
    seed: string;
    grid: Grid<Tile>;
    nStones = 2;
    nStonePieces = 0;
    nStonePiecesPerStone;
    
    // derived fields
    groups: Tile[][] = [];
    clustering: Clustering = new Clustering();
    // backupClustering: Clustering;

    // client-only fields
    // TODO: Consider just passing this from the renderer
    // activeTiles: Tile[] = [];

    readonly onNeedSave = new Event<GameData>();
    readonly onTilesActivated = new Event<Tile[]>();


    constructor(seed: string) {
        this.seed = seed;
        this.guid = uuidv4();
    }

    createNewLevel() {
        let generator = new LevelGenerator(this.seed, this.width, this.height);
        this.grid = generator.generate();
        this.nStonePiecesPerStone = generator.stonePiecesPerStone;
        this.initializeGrid();
        this.save();
    }

    private initializeGrid() {
        this.grid.forEach(tile => {
            tile.game = this;
            tile.grid = this.grid;
            if (!this.groups[tile.groupIndex]) {
                this.groups[tile.groupIndex] = [];
            }
            this.groups[tile.groupIndex].push(tile);
            if (tile.unlocked) {
                this.clustering.addTileAndConnectNeighbors(tile);
            }
        });
        this.grid.forEach(tile => {
            tile.groupCount = this.groups[tile.groupIndex].length;
        });
        console.log('created starting clustering', this.clustering);
    }

    save() {
        let data = this.serialize();
        // console.log('saving...', data);
        this.onNeedSave.emit(data);
    }

    serialize() : GameData {
        return {
            guid: this.guid,
            seed: this.seed,
            width: this.width,
            height: this.height,
            tiles: this.grid.toArray().map(tile => tile.serialize()),
            nStones: this.nStones,
            nStonePieces: this.nStonePieces,
            nStonePiecesPerStone: this.nStonePiecesPerStone,
        };
    }

    deserialize(data: GameData) {
        console.log('loading...', data);
        this.guid = data.guid;
        this.seed = data.seed;
        this.nStones = data.nStones;
        this.nStonePieces = data.nStonePieces || 0;
         // If it's an old map, should just be one piece per stone
        this.nStonePiecesPerStone = data.nStonePiecesPerStone || 1;
        this.width = data.width;
        this.height = data.height;
        this.grid = new Grid(Tile, rectangle({ width: data.width, height: data.height }));
        let i = 0;
        this.grid.forEach(tile => {
            tile.deserialize(i, data.tiles[i++]);
        });
        this.initializeGrid();
        console.log('finished loading', this);
    }

    tryActivating(activeTiles: Set<Tile>) : boolean {
        let testClustering = this.clustering.copy();
        activeTiles.forEach(tile => testClustering.addTileAndConnectNeighbors(tile, t => {
            return t.unlocked || activeTiles.has(t);
        }));

        let activeGroupIndices = [...activeTiles.keys()].map(tile => tile.groupIndex);
        activeGroupIndices = activeGroupIndices.filter(groupIndex => groupIndex !== undefined);
        // remove duplicates
        activeGroupIndices = activeGroupIndices.filter((value, index, self) => self.indexOf(value) === index);
        if (activeGroupIndices.length === 0) return;

        // console.log('checking connections', activeGroupIndices);
        for (let i = 0; i < activeGroupIndices.length; i++) {
            let groupIndex = activeGroupIndices[i];
            let group = this.groups[groupIndex];
            // First check if the whole group is active
            if (!group.every(tile => activeTiles.has(tile))) continue;
            let clusterIndex = testClustering.getClusterIndex(group[0].id);
            // console.log(group, group.map(tile => testClustering.getClusterIndex(tile.id)));
            if (clusterIndex === undefined) {
                console.error('clusterIndex is undefined for group', groupIndex, group, activeTiles);
                continue;
            }
            // Then check if the whole group is in the same cluster (i.e. connected)
            if (!group.every(tile => {
                return clusterIndex === testClustering.getClusterIndex(tile.id);
            })) continue;
            
            this.activateTiles(group);
            // console.log('unlocked group ' + groupIndex);

            this.onTilesActivated.emit(group);
            return true;
        }
        return false;
    }

    activateTiles(group: Tile[]) {
        // First mark all as unlocked
        group.forEach(tile => {
            tile.unlocked = true;
        });
        // Then add to the permenant clustering
        group.forEach(tile => {
            this.clustering.addTileAndConnectNeighbors(tile);
        });
        if (group[0].isStoneTile) {
            this.nStonePieces++;
            if (this.nStonePieces >= this.nStonePiecesPerStone) {
                this.nStonePieces -= this.nStonePiecesPerStone;
                this.nStones++;
            }
        }
        this.save();
    }

    // clearActive(restoreActive: boolean) {
    //     if (this.backupClustering != null) {
    //         this.clustering = this.backupClustering.copy();
    //     }
    //     this.backupClustering = null;
    //     let toRestore = [];
    //     this.activeTiles.forEach(tile => {
    //         if (tile.unlocked) {
    //             this.clustering.addTileAndConnectNeighbors(tile);
    //         } else {
    //             toRestore.push(tile);
    //         }
    //         tile.active = false;
    //     });
    //     this.activeTiles = [];
    //     if (restoreActive) {
    //         this.backupClustering = this.clustering.copy();
    //         toRestore.forEach(tile => {
    //             tile.active = true;
    //             this.activeTiles.push(tile);
    //             this.clustering.addTileAndConnectNeighbors(tile);
    //         });
    //     }
    // }
}