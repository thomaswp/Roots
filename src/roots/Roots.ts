import { defineHex, Direction, Grid, rectangle } from "honeycomb-grid";
import { Tile } from "./Tile";
import e from "express";
import { Clustering } from "./Clustering";

export class Roots {

    grid: Grid<Tile>;
    maxGroupIndex;
    clustering: Clustering = new Clustering();
    backupClustering: Clustering;
    activeTiles: Tile[] = [];
    groups: Tile[][];

    onNeedRefresh: () => void;

    constructor() {

        // 2. Create a grid by passing the class and a "traverser" for a rectangular-shaped grid:
        this.grid = new Grid(Tile, rectangle({ width: 20, height: 15 }))

        this.maxGroupIndex = 200;
        this.groups = new Array(this.maxGroupIndex);
        let indexes = Array.from(Array(this.maxGroupIndex).keys());
        let id = 0;
        this.grid.forEach(tile => {
            tile.id = id++;
            tile.game = this;
            tile.groupIndex = indexes[Math.floor(Math.random() * indexes.length)]
            if (this.groups[tile.groupIndex] == null) {
                this.groups[tile.groupIndex] = [];
            }
            this.groups[tile.groupIndex].push(tile);
        });
    }

    addToClustering(tile: Tile) {
        let mergedClusters = [this.clustering.addNewCluster(tile.id)];
        for (let i = 0; i < 8; i++) {
            let neighbor = this.grid.neighborOf(tile, i, {allowOutside: false});
            if (!neighbor || !neighbor.isPassable()) continue;
            let neighborClusterIndex = this.clustering.getClusterIndex(neighbor.id);
            if (neighborClusterIndex === undefined) continue;
            if (!mergedClusters.includes(neighborClusterIndex)) {
                mergedClusters.push(neighborClusterIndex);
            }
        }
        // console.log(mergedClusters);
        this.clustering.join(mergedClusters);
    }

    // Either this or "Check Connections" still has a bug in it - need to find it
    tileClicked(tile: Tile) {
        if (tile.active) {
            tile.active = false;
            this.activeTiles.splice(this.activeTiles.indexOf(tile), 1);
            this.clustering = this.backupClustering.copy();
            this.activeTiles.forEach(tile => {
                // console.log(JSON.stringify(this.clustering), tile.id);
                this.addToClustering(tile);
            });
        } else {
            tile.active = true;
            this.activeTiles.push(tile);
            if (this.backupClustering == null) {
                this.backupClustering = this.clustering.copy();
            }
            this.addToClustering(tile);
            this.checkConnections();
        }
        // console.log(this.clustering.clusters);
    }

    checkConnections() {
        let activeGroupIndices = this.activeTiles.map(tile => tile.groupIndex);
        // remove duplicates
        activeGroupIndices = activeGroupIndices.filter((value, index, self) => self.indexOf(value) === index);

        let clear = false, refresh = false;
        for (let i = 0; i < activeGroupIndices.length; i++) {
            let groupIndex = activeGroupIndices[i];
            let group = this.groups[groupIndex];
            let clusterIndex = this.clustering.getClusterIndex(group[0].id);
            if (group.every(tile => {
                return this.activeTiles.includes(tile) &&
                    clusterIndex === this.clustering.getClusterIndex(tile.id);
            })) {
                group.forEach(tile => {
                    tile.unlocked = true
                });
                if (group.length > 1) clear = true;
                refresh = true;
                // console.log('unlocked group ' + groupIndex);
            }
        }

        this.clearActive(!clear);
        if (refresh) {
            this.onNeedRefresh();
        }
    }

    clearActive(restoreActive: boolean) {
        if (this.backupClustering != null) {
            this.clustering = this.backupClustering.copy();
        }
        this.backupClustering = null;
        let toRestore = [];
        this.activeTiles.forEach(tile => {
            if (tile.unlocked) {
                this.addToClustering(tile);
            } else {
                toRestore.push(tile);
            }
            tile.active = false;
        });
        this.activeTiles = [];
        if (restoreActive) {
            this.backupClustering = this.clustering.copy();
            toRestore.forEach(tile => {
                tile.active = true;
                this.activeTiles.push(tile);
                this.addToClustering(tile);
            });
        }
    }
}