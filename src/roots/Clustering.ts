import { Tile } from "./Tile";

export class Clustering {
    // map: Map<number, number>;
    clusters: number[][];

    constructor() {
        // this.map = new Map<number, number>();
        this.clusters = [];
    }

    getClusterIndex(tileID: number): number {
        // return this.map.get(tileID);
        let index = this.clusters.findIndex(cluster => cluster.includes(tileID));
        if (index === -1) return undefined;
        return index;
    }

    addNewCluster(tileID: number) {
        let clusterID = this.clusters.length
        // this.map.set(id, clusterID);
        this.clusters.push([tileID]);
        return clusterID;
    }

    addTileAndConnectNeighbors(tile: Tile) {
        let mergedClusters = [this.addNewCluster(tile.id)];
        let neighbors = tile.getPassableNeighbors();
        for (let neighbor of neighbors) {
            let neighborClusterIndex = this.getClusterIndex(neighbor.id);
            if (neighborClusterIndex === undefined) continue;
            if (!mergedClusters.includes(neighborClusterIndex)) {
                mergedClusters.push(neighborClusterIndex);
            }
        }
        // console.log(mergedClusters);
        this.join(mergedClusters);
    }
    
    join(clusterIDs: number[]) {
        // console.log('joining clusters', clusterIDs);
        if (clusterIDs.length <= 1) return;
        let newCluster = [];
        clusterIDs.sort((a, b) => a - b);
        clusterIDs.reverse();
        clusterIDs.forEach(id => {
            newCluster = newCluster.concat(this.clusters[id]);
            this.clusters.splice(id, 1);
        });
        this.clusters.push(newCluster);
        // This is insufficient - we'd need to shift all the clusterIDs after the one we just removed
        // Maybe can just get away without a map
        // newCluster.forEach(id => {
        //     this.map.set(id, this.clusters.length - 1);
        // });
    }

    copy(): Clustering {
        let copy = new Clustering();
        // copy.map = new Map(this.map);
        copy.clusters = this.clusters.map(cluster => cluster.slice());
        return copy;
    }
}