import { Peer, DataConnection, PeerOptions } from "peerjs";
import { GameData, Roots } from "./Roots";
import { GameRenderer } from "../render/GameRenderer";

interface Message {
    type: string,
    data: Object | string,
}

export class Network {

    readonly game: Roots;
    renderer: GameRenderer;
    onGameReceived: () => void;
    
    // TODO: For hosts may be multiple IDs
    private peer: Peer;
    private _isHost: boolean;
    private hostConnections: DataConnection[] = [];

    get ID() { return this.peer?.id; }
    get isHost() { return this._isHost; }

    constructor(game: Roots) {
        this.game = game;
    }

    private async createPeer(id = null) : Promise<string> {
        this.peer = new Peer(id, {
            debug: 2,
        });

        return new Promise((resolve, reject) => {
            this.peer.on('open', (id) => {
                console.log('connection opened', id);
                resolve(id);
            });
    
            this.peer.on('error', (err) => {
                console.error('peer error', err);
                reject(err);
            });
        });
    }

    async host() : Promise<string> {
        this._isHost = true;
        let promise = this.createPeer('79ae4d13-ec49-4d35-8cd1-8888ddad5bca'); // Hard code temporarily
        this.peer.on('connection', (connection) => {
            this.handleConnection(connection);
            connection.on('open', () => {
                console.log('sending game');
                this.hostConnections.push(connection);
                connection.send({
                    type: 'sendGame',
                    data: this.game.serialize(),
                })
            });
        });
        return promise;
    }

    connect(peerID: string) {
        this._isHost = false;
        this.createPeer().then((id) => {
            let connection = this.peer.connect(peerID, {
                // serialization: 'json',
            });
            this.handleConnection(connection);
        });
    }

    private handleConnection(conn: DataConnection) {
        console.log('connection', conn);
        conn.on('data', (data: Message) => {
            if (data.type == 'sendGame') {
                console.log('received game', data);
                let gameData = data.data as GameData;
                this.game.deserialize(gameData);
                if (this.onGameReceived) {
                    this.onGameReceived();
                }
            } else if (data.type == 'tilesActivated') {
                console.log('received tiles', data);
                let tileIDs = data.data as number[];
                let allTiles = this.game.grid.toArray();
                let tiles = tileIDs.map(id => allTiles.filter(t => t.id == id)[0]);
                console.log(tiles, this.game.grid);
                // TODO: check if any tiles are null and raise error
                if (tiles.some(t => !t)) {
                    console.error('received invalid tile IDs', tileIDs);
                } else {
                    this.game.activateTiles(tiles);
                    if (this.isHost) {
                        // Send the event to all *other* client connections
                        this.hostConnections.filter(c => c != conn).forEach(c => {
                            c.send(data);
                        });
                    }
                }
            } else {
                console.error('unknown message type', data);
            }
            if (this.renderer) {
                this.renderer.refresh();
            }
        });
        conn.on('close', () => {
            console.log('connection closed');
            this.hostConnections = this.hostConnections.filter(c => c != conn);
        });
        conn.on('error', (err) => {
            console.error('connection error', err);
        });

        this.game.onTilesActivated.addHandler((tiles) => {
            console.log('sending tiles', tiles);
            conn.send({
                type: 'tilesActivated',
                data: tiles.map(tile => tile.id),
            });
        });
    }

}