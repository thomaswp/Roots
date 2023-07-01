import { GameState } from "./GameSchema";
import { Messenger } from "./Messenger";

export type JoinOptions = {
    name: string
}


export class GameLogic {

    currentClientID: string;
    state: GameState;
    messenger: Messenger;

    constructor(messenger: Messenger, state: GameState) {
        this.messenger = messenger;
        this.state = state;

        // messenger.addShip.on(args => {
        //     state.addShip(this.currentClientID, args.ship);
        // });

        // messenger.tryAddAI.on(args => state.initAI())

        // messenger.tryStartRound.on(() => {
        //     if (state.isRunning) return;
        //     state.startRound();
        //     messenger.roundStarted.send({ seed: state.seed });
        // });

        // messenger.tryEndRound.on(() => {
        //     if (!state.isRunning) return;
        //     state.endRound();
        //     messenger.roundEnded.send();
        // });
    }

    onPlayerJoined(clientID: string, options: JoinOptions) {
        this.state.createOrBindPlayer(clientID, options?.name);
    }

    onPlayerLeft(clientID: string) {
        this.state.onPlayerLeft(clientID);
    }
}