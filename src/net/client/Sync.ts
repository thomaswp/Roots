import seedrandom from 'seedrandom'
import * as Matter from 'matter-js';
import * as Colyseus from "colyseus.js"
import { GameState } from '../common/GameSchema';
import { Messenger, Sender } from '../common/Messenger';
import { GameLogic } from '../common/GameLogic';
import { ClientOnlySender } from './ClientOnlySender';

export class Random {

    private rng: () => number;

    constructor(seed: number) {
        this.rng = seedrandom(seed);
    }

    float(): number {
        return this.rng();
    };

    floatRange(min: number, max: number) {
        return this.float() * (max - min) + min;
    }

    int(min: number, max: number): number {
        return Math.round(this.floatRange(min, max));
    };

    boolean(): boolean {
        return this.float() < 0.5;
    };

    chance(chanceZeroToOne: number): boolean {
        return this.float() < chanceZeroToOne;
    }
}

export class Sync {

    static random: Random;
    static client: Colyseus.Client;
    static state: GameState;
    static messenger = new Messenger();
    static clientName: string;

    static listeners = [] as (() => void)[];

    static get isConnected() { return this.state != null; }


    static init(seed: number) {
        this.random = new Random(seed);

        
        let params = new URLSearchParams(window.location.search);
        this.clientName = params.get('name');

        // this.messenger.roundStarted.on(({ seed }) => {
        //     // console.log('SEED:', seed);
        //     this.random = new Random(seed);
        //     Matter.Common['_seed'] = this.random.float();
        // });

        // console.log(this.random.float(), this.random.int(0, 100), this.random.boolean());

        const host = window.document.location.host.replace(/:.*/, '');
        const endpoint = location.protocol.replace("http", "ws") + "//" + host + 
            (location.port ? ':' + location.port : '');
        console.log(endpoint);

        this.client = new Colyseus.Client(endpoint);
        this.client.joinOrCreate("game_room", {
            name: this.clientName,
        }).then(room_instance => {
            this.state = room_instance.state as GameState;
            this.messenger.setSender(room_instance);            
            this.listeners.forEach(l => l());

            room_instance.onStateChange.once((state: GameState) => {
                // if (state.isRunning) {
                //     this.messenger.roundStarted.receive({seed: state.seed});
                // }
            })
        }).catch(e => {
            console.error('Cannot connect to websocket!', e);
            
            // Client-only mode does not work yet! TODO!
            // console.error('Running in client mode.');
            // let id = 'localplayer';
            // this.state = new GameState();
            // let logic = new GameLogic(this.messenger, this.state);
            // logic.currentClientID = id;
            // let writeState = new GameState();
            // let sender = new ClientOnlySender(writeState, this.state);
            // this.messenger.setSender(sender);
            // this.listeners.forEach(l => l());

            // writeState.createOrBindPlayer(id, 'Local Player');
            // sender.updateState();
        });
    }

}