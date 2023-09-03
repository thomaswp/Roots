import { Peer, DataConnection, PeerOptions } from "peerjs";
import { GameData, Roots } from "./Roots";

interface Message {
    type: string,
    data: Object | string,
}

export class Network {

    readonly game: Roots;
    onGameReceived: () => void;
    
    // TODO: For hosts may be multiple IDs
    private peer: Peer;
    private _isHost: boolean;

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
            } else {
                console.error('unknown message type', data);
            }
        });
        conn.on('close', () => {
            console.log('connection closed');
        });
        conn.on('error', (err) => {
            console.error('connection error', err);
        });
    }

}