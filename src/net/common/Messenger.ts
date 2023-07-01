import { Ship } from "./GameSchema";

export interface Sender {
    send(type: string, data: any): void;
    onMessage(type: string, callback: (data: any) => void): void;
}


export class Messenger {

    private messages = [] as Message<any>[];

    

    private add<T>(message: Message<T>): Message<T> {
        this.messages.push(message);
        return message;
    }

    setSender(sender: Sender) {
        this.messages.forEach(m => m.setSender(sender));
    }
}


export class Message<Data> {

    type: string;
    sender: Sender;
    callbacks = [] as ((data: Data) => void)[];

    constructor(type: string) {
        this.type = type;
    }

    setSender(sender: Sender) {
        this.sender = sender;
        sender.onMessage(this.type, data => {
            this.receive(data);
        })
    }

    receive(data: Data) {
        this.callbacks.forEach(cb => cb(data));
    }

    send(data: Data) {
        if (!this.sender) {
            throw Error("Cannot send before sender is initialized!");
        }
        this.sender.send(this.type, data);
    }

    on(callback: (data: Data) => void) {
        this.callbacks.push(callback);
    }
}

