import * as PIXI from "pixi.js";
import { GameData, Roots } from "./roots/Roots";
import { GameRenderer as GameRenderer } from "./render/GameRenderer";
import { generate } from "random-words";
import { validate as uuidValidate } from 'uuid';
import 'hammerjs';
import { Network } from "./roots/Network";
import { setUrlParam } from "./util/NavUtils";
import tutorialLevel from "./TutorialLevel.json";
import { LoadingRenderer } from "./render/LoadingRenderer";

window.onload = function() {
    // Create the application helper and add its render target to the page
    let app = new PIXI.Application<HTMLCanvasElement>({
        antialias: true,
        autoDensity: true,
        resizeTo: window,
    });
    document.body.appendChild(app.view);

    document.oncontextmenu = document.body.oncontextmenu = function(e) {
        e.preventDefault();
        // return false;
    }

    // TODO: Resize app on resize events and update things...

    // Bug in the library - gives back a string, rather than a string[].
    let seed = generate({minLength: 4, maxLength: 8}) as unknown as string;
    let params = new URLSearchParams(window.location.search);
    let isTutorial = params.has('tutorial');
    if (params.has('seed')) {
        let paramSeed = params.get('seed');
        if (paramSeed.length > 0) {
            seed = paramSeed;
        }
    } else if (isTutorial) {
        seed = tutorialLevel.seed; // "pick"
    } else {
        setUrlParam('seed', seed);
    }

    const game = new Roots(seed);
    const net = new Network(game);

    if (isTutorial) {
        game.deserialize(tutorialLevel as GameData);
    }

    game.onNeedSave.addHandler((data: GameData) => {
        window.localStorage.setItem(seed, JSON.stringify(data));
    });

    const shareJoinURL = (joinID: string) => {
        let url = location.protocol + '//' + location.host + location.pathname;
        let params = new URLSearchParams(window.location.search);
        params.set('joinID', joinID);
        params.delete('hostID');
        let joinURL = url + '?' + params.toString();
        navigator.clipboard.writeText(joinURL);
        alert('Attempted to copy join link to clipboard:\n' + joinURL);
    }

    const startGame = () => {
        let renderer = new GameRenderer(app, game, isTutorial);
        renderer.start();
        net.setRenderer(renderer);

        renderer.onShare.addHandler(() => {
            if (net.isHost) {
                shareJoinURL(net.ID);
                return;
            }
            net.host(params.get('hostID')).then((id) => {
                shareJoinURL(id);
            });
        });
    
        app.ticker.add((delta) => {
            renderer.update(delta / 60);
        });
    }

    if (isTutorial) {
        startGame();
        return;
    }

    let isJoining = false;
    if (params.has('joinID')) {
        let joinGuid = params.get('joinID');
        if (uuidValidate(joinGuid)) {
            net.connect(joinGuid);
            isJoining = true;

            net.onGameReceived.addHandler(() => {
                setUrlParam('seed', game.seed);
                startGame();
            });
        } else {
            alert("Invalid join code: " + joinGuid);
        }
    } else if (params.has('hostID')) {
        net.host(params.get('hostID')).then((id) => {
            
        });
    }

    if (!isJoining) {
        let savedJSON = window.localStorage.getItem(seed);
        if (savedJSON != null && !(params.has('reset'))) {
            try {
                let data = JSON.parse(savedJSON);
                game.deserialize(data);
            } catch (e) {
                console.error('filed to load save for seed', e);
            }
            startGame();
        } else {
            let loading = new LoadingRenderer(app);
            app.stage.addChild(loading);
            let update = (delta) => {
                loading.update(game.loadProgress);
            };
            app.ticker.add(update);
            game.createNewLevel().then(() => {
                app.stage.removeChild(loading);
                app.ticker.remove(update);
                startGame();
            });
        }
    }
};
