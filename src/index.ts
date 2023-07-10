import * as PIXI from "pixi.js";
import { GameData, Roots } from "./roots/Roots";
import { GameRenderer as GameRenderer } from "./render/GameRenderer";
import { generate } from "random-words";

window.onload = function() {
    // Create the application helper and add its render target to the page
    let app = new PIXI.Application<HTMLCanvasElement>({ 
        width: 1200, 
        height: 800,
        antialias: true,
        autoDensity: true,
    });
    document.body.appendChild(app.view);

    // Bug in the library - gives back a string, rather than a string[].
    let seed = generate({minLength: 4, maxLength: 8}) as unknown as string;
    let params = new URLSearchParams(window.location.search);
    if (params.has('seed')) {
        let paramSeed = params.get('seed');
        if (paramSeed.length > 0) {
            seed = paramSeed;
        }
    }


    let game = new Roots(seed);
    game.onNeedSave = (data: GameData) => {
        window.localStorage.setItem(seed, JSON.stringify(data));
    }
    let savedJSON = window.localStorage.getItem(seed);
    if (savedJSON != null && !params.has('reset')) {
        try {
            let data = JSON.parse(savedJSON);
            game.deserialize(data);
        } catch (e) {
            console.error('filed to load save for seed', e);
        }
    } else {
        game.createNewLevel();
    }

    let renderer = new GameRenderer(app, game);
    renderer.start();

    window.history.replaceState(null, null, `?seed=${seed}`);

    document.oncontextmenu = document.body.oncontextmenu = function(e) {
        e.preventDefault();
        // return false;
    }
};
