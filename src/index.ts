import * as PIXI from "pixi.js";
import { Roots } from "./roots/Roots";
import { GameRenderer as GameRenderer } from "./render/GameRenderer";

window.onload = function() {
    // Create the application helper and add its render target to the page
    let app = new PIXI.Application<HTMLCanvasElement>({ 
        width: 1200, 
        height: 800,
        antialias: true,
        autoDensity: true,
    });
    document.body.appendChild(app.view);

    let game = new Roots();
    let renderer = new GameRenderer(app, game);
    renderer.start();
};
