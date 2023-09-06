import { Peer, DataConnection, PeerOptions } from "peerjs";
import { GameData, Roots } from "./Roots";
import { GameRenderer } from "../render/GameRenderer";
import { Event } from "../util/Event";

interface Message {
    type: string,
    playerIndex: number,
    data: Object | string,
}

export class Network {

    readonly game: Roots;
    readonly onGameReceived = new Event<void>();
    
    private renderer: GameRenderer;
    private peer: Peer;
    private connections: DataConnection[] = [];
    private playerIndex;

    get ID() { return this.peer?.id; }
    get isHost() { return this.playerIndex === 0; }


    constructor(game: Roots) {
        this.game = game;

        this.game.onTilesActivated.addHandler((tiles) => {
            this.connections.forEach(conn => {
                conn.send({
                    type: 'tilesActivated',
                    playerIndex: this.playerIndex,
                    data: tiles.map(tile => tile.id),
                });
            });
        });
    }

    private async createPeer(id?: string) : Promise<string> {
        this.peer = new Peer(id, {
            debug: 2,
        });

        return new Promise((resolve, reject) => {
            this.peer.on('open', (id) => {
                console.log('connection opened', id);
                resolve(id);
            });
    
            
            let alertShown = false;
            this.peer.on('error', (err) => {
                console.error('peer error', err);
                if (!alertShown) {
                    alertShown = true;
                    alert('Could not connect to peer. Make sure they are hosting and try again.');
                }
                reject(err);
            });
        });
    }

    setRenderer(renderer: GameRenderer) {
        this.renderer = renderer;
        this.renderer.onHoverChanged.addHandler((index) => {
            this.connections.forEach(conn => {
                conn.send({
                    type: 'hoverChanged',
                    playerIndex: this.playerIndex,
                    data: index,
                });
            });
        });
    }

    async host(id?: string) : Promise<string> {
        this.playerIndex = 0;
        let promise = this.createPeer(id); // Hard code temporarily
        let nextIndex = 1;
        this.peer.on('connection', (connection) => {
            this.handleConnection(connection);
            connection.on('open', () => {
                console.log('sending game');
                connection.send({
                    type: 'sendGame',
                    playerIndex: nextIndex++,
                    data: this.game.serialize(),
                })
            });
        });
        return promise;
    }

    connect(peerID: string) {
        this.createPeer().then((id) => {
            let connection = this.peer.connect(peerID, {
                // serialization: 'json',
            });
            this.handleConnection(connection);
        });
    }

    private handleConnection(conn: DataConnection) {
        console.log('connection', conn);
        this.connections.push(conn);
        conn.on('data', (message: Message) => {
            if (message.type == 'sendGame') {
                console.log('received game', message);
                this.playerIndex = message.playerIndex;
                let gameData = message.data as GameData;
                this.game.deserialize(gameData);
                this.onGameReceived.emit();
            } else if (message.type == 'tilesActivated') {
                console.log('received tiles', message);
                let tileIDs = message.data as number[];
                let allTiles = this.game.grid.toArray();
                let tiles = tileIDs.map(id => allTiles.filter(t => t.id == id)[0]);
                console.log(tiles, this.game.grid);
                // TODO: check if any tiles are null and raise error
                if (tiles.some(t => !t)) {
                    console.error('received invalid tile IDs', tileIDs);
                } else {
                    this.renderer.deactivateTiles(tiles);
                    this.game.unlockTiles(tiles);
                }
            } else if (message.type == 'hoverChanged') {
                let index = message.data as number;
                this.renderer.updatePlayerHover(message.playerIndex, index);
            } else {
                console.error('unknown message type', message);
                return;
            }
            if (this.isHost) {
                // Send the event to all *other* client connections
                this.connections.filter(c => c != conn).forEach(c => {
                    c.send(message);
                });
            }
            if (this.renderer) {
                this.renderer.refresh();
            }
        });
        conn.on('close', () => {
            console.log('connection closed');
            this.connections = this.connections.filter(c => c != conn);
        });
    }

}