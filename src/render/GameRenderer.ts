import * as PIXI from 'pixi.js';
import { Roots } from '../roots/Roots';
import { GridRenderer } from './GridRender';
import { animalIcons } from './Animals';

export class GameRenderer {
    
    app: PIXI.Application;
    game: Roots;
    gridRenderer: GridRenderer;

    groupAnimalPaths: string[];
    groupColors: PIXI.Color[];


    constructor(app: PIXI.Application, game: Roots) {
        this.app = app;
        this.game = game;

        this.initGroups();
    }

    initGroups() {
        let nBasicColors = 8;
        let basicColors = Array.from(new Array(nBasicColors).keys()).map(i => {
            return new PIXI.Color({h: i * 360 / nBasicColors, s: 85, v: 100});
        })
        let nGroups = this.game.maxGroupIndex;
        this.groupColors = Array.from(new Array(nGroups).keys())
        .map(i => basicColors[Math.floor(Math.random() * nBasicColors)]);
        
        let paths = animalIcons.split('\n').filter(s => s.length > 0).map(s => s.trim());
        // shuffle paths
        for (let i = paths.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [paths[i], paths[j]] = [paths[j], paths[i]];
        }
        this.groupAnimalPaths = Array.from(new Array(nGroups).keys())
        .map(i => paths[i % paths.length]);
    }

    colorForGroupIndex(index: number) : PIXI.Color {
        return this.groupColors[index];
    }

    iconPathForGroupIndex(index: number) : string {
        return `img/animals/${this.groupAnimalPaths[index]}`;
    }

    start() {
        this.app.ticker.add(delta => {
            this.update(delta);  
        });
        this.gridRenderer = new GridRenderer(this, this.game.grid);
        this.gridRenderer.init();
        this.app.stage.addChild(this.gridRenderer.container);

        // this.gridRenderer.graphics.x = this.app.screen.width / 2;
        // this.gridRenderer.graphics.y = this.app.screen.height / 2;
    }

    update(delta: number) {
        
    }
}