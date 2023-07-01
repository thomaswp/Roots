import { GameState } from "../common/GameSchema";
import { Sender } from "../common/Messenger";

export class ClientOnlySender implements Sender {

    readState: GameState;
    writeState: GameState

    constructor(readState: GameState, writeState: GameState) {
        this.readState = readState;
        this.writeState = writeState;
    }

    callbacks = new Map<string, ((data) => void)[]>;

    onMessage(type, callback) {
        console.log('registring callback', type);
        if (!this.callbacks.has(type)) {
            this.callbacks.set(type, []);
        }
        this.callbacks.get(type).push(callback);
    }

    send(type, data) {
        if (!this.callbacks.has(type)) return;
        console.log('calling', this.callbacks.get(type).length, type);
        this.callbacks.get(type).forEach(c => c(data));
        this.updateState();
    }

    updateState() {
        let bytes = this.writeState.encode();
        console.log(bytes);
        this.readState.decode(bytes);
    }
}