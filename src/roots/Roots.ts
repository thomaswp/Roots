import { defineHex, Direction, Grid, rectangle } from "honeycomb-grid";
import { Tile, TileData } from "./Tile";
import { Clustering } from "./Clustering";
import { LevelGenerator } from "./LevelGenerator";

export type GameData = {
    seed: string;
    width: number;
    height: number;
    tiles: TileData[];
    nStones: number;
}

export class Roots {

    // serializable fields
    width = 20;
    height = 15;
    seed: string;
    grid: Grid<Tile>;
    nStones = 2;
    
    // derived fields
    groups: Tile[][] = [];
    clustering: Clustering = new Clustering();
    // backupClustering: Clustering;

    // client-only fields
    // TODO: Consider just passing this from the renderer
    // activeTiles: Tile[] = [];

    onNeedRefresh: () => void;
    onNeedSave: (data: GameData) => void;


    constructor(seed: string) {
        this.seed = seed;
    }

    createNewLevel() {
        let generator = new LevelGenerator(this.seed, this.width, this.height);
        this.grid = generator.generate();
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
        this.onNeedSave(this.serialize());
    }

    serialize() : GameData {
        return {
            seed: this.seed,
            width: this.width,
            height: this.height,
            tiles: this.grid.toArray().map(tile => tile.serialize()),
            nStones: this.nStones,
        };
    }

    deserialize(data: GameData) {
        console.log('loading...', data);
        this.seed = data.seed;
        this.nStones = data.nStones;
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


    // // Either this or "Check Connections" still has a bug in it - need to find it
    // tileClicked(tile: Tile, activateWholeGroup: boolean = false) {
    //     // If an inactive tile is clicked, activate it
    //     if (!tile.active) {
    //         // console.log('activating', tile);
    //         // console.log(this.activeTiles);
    //         if (this.activeTiles.length >= this.nStones) return;
    //         // console.log(this.activeTiles.length, this.nStones);
    //         tile.active = true;
    //         this.activeTiles.push(tile);
    //         if (this.backupClustering == null) {
    //             this.backupClustering = this.clustering.copy();
    //         }
    //         this.clustering.addTileAndConnectNeighbors(tile);
    //         this.checkConnections();
    //         // console.log(this.clustering);

    //     // Otherwise, unless this is a double-click, deactivate it
    //     } else if (!activateWholeGroup) {
    //         tile.active = false;
    //         this.activeTiles.splice(this.activeTiles.indexOf(tile), 1);
    //         this.clustering = this.backupClustering.copy();
    //         this.activeTiles.forEach(tile => {
    //             // console.log(JSON.stringify(this.clustering), tile.id);
    //             this.clustering.addTileAndConnectNeighbors(tile);
    //         });
    //     }
        
    //     // Either way, if this is a double-click, try to activate the whole group
    //     if (activateWholeGroup) {
    //         let unclickedTiles = this.groups[tile.groupIndex].filter(t => !t.active);
    //         // console.log('Considering ', unclickedTiles.length, unclickedTiles)
    //         if (this.nStones - this.activeTiles.length >= unclickedTiles.length) {
    //             // console.log("go!!");
    //             unclickedTiles.forEach(tile => this.tileClicked(tile));
    //         }
    //         this.onNeedRefresh();
    //     }
    // }

    // clearSelection() {
    //     this.clearActive(false);
    //     this.onNeedRefresh();
    // }

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
            
            // First mark all as unlocked
            group.forEach(tile => {
                tile.unlocked = true;
            });
            // Then add to the permenant clustering
            group.forEach(tile => {
                this.clustering.addTileAndConnectNeighbors(tile);
            });
            if (group[0].isStoneTile) {
                this.nStones++;
            }
            this.save();
            this.onNeedRefresh();
            // console.log('unlocked group ' + groupIndex);
            return true;
        }
        return false;
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