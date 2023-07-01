import { Room, Client } from "colyseus";
import { GameLogic } from "../common/GameLogic";
import { GameState } from "../common/GameSchema";
import { Messenger, Sender } from "../common/Messenger";

export class GameRoom extends Room<GameState> {
    maxClients = 4;

    messenger: Messenger;
    gameLogic: GameLogic;

    onCreate (options) {
        console.log("StateHandlerRoom created!", options);

        this.setState(new GameState());

        this.messenger = new Messenger();
        let gameLogic = this.gameLogic = new GameLogic(this.messenger, this.state);

        let me = this;
        let sender = {
            onMessage(type, callback) {
                me.onMessage(type, (client, data) => {
                    console.log(`Room received ${type} from ${client.sessionId}`, data);
                    gameLogic.currentClientID = client.sessionId;
                    callback(data);
                })
            },

            send(type, data) {
                me.clients.forEach(c => c.send(type, data));
            },
        } as Sender;
        this.messenger.setSender(sender);
    }

    onAuth(client, options, req) {
        return true;
    }

    onJoin (client: Client, options) {
        this.gameLogic.onPlayerJoined(client.sessionId, options);
    }

    onLeave (client) {
        this.gameLogic.onPlayerLeft(client.sessionId);
    }

    onDispose () {
        console.log("Dispose StateHandlerRoom");
    }

}
