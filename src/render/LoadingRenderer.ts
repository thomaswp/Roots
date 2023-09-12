import { Grid, defineHex, rectangle, spiral } from 'honeycomb-grid';
import * as PIXI from 'pixi.js';

export class LoadingRenderer extends PIXI.Container {

    text: PIXI.Text;
    hexagon: PIXI.Graphics;
    hexes: PIXI.Graphics[] = [];
    progress = 0;

    constructor(app: PIXI.Application) {
        super();

        this.text = new PIXI.Text('Loading...', {
            fontFamily: 'Arial',
            fontSize: 24,
            fill: 0xFFFFFF,
            align: 'center',
        });
        this.text.anchor.set(0.5);
        this.text.position.set(app.view.width / 2, app.view.height / 2 + 200);
        this.addChild(this.text);

        this.hexagon = new PIXI.Graphics();
        this.hexagon.lineStyle(4, 0xFFFFFF);
        this.drawHexagon(this.hexagon, 200);
        this.hexagon.position.set(app.view.width / 2, app.view.height / 2);
        this.addChild(this.hexagon);

        this.createGrid();
    }

    createGrid() {
        const Hex = defineHex({ dimensions: 20 })
        let grid = new Grid(Hex, rectangle({ width: 20, height: 20 }));
        let centerHex = grid.getHex([6, 6]);
        const traverser = spiral({ radius: 5, start: [6, 6] });
        grid = grid.traverse(traverser);
        grid.forEach(hex => {
            let graphics = new PIXI.Graphics();
            graphics.lineStyle(1, 0xFFFFFF);
            this.drawHexagon(graphics, 20);
            graphics.position.set(hex.x + this.hexagon.x - centerHex.x, hex.y + this.hexagon.y  - centerHex.y);
            graphics.rotation = 30 * Math.PI / 180;
            graphics.visible = false;
            this.addChild(graphics);
            this.hexes.push(graphics);
        });

        // Shuffle the hexes
        for (let i = 0; i < this.hexes.length; i++) {
            let j = Math.floor(Math.random() * (i + 1));
            let temp = this.hexes[i];
            this.hexes[i] = this.hexes[j];
            this.hexes[j] = temp;
        }
    }

    drawHexagon(graphics: PIXI.Graphics, radius: number) {
        graphics.drawPolygon([
            new PIXI.Point(radius, 0),
            new PIXI.Point(radius / 2, radius * Math.sqrt(3) / 2),
            new PIXI.Point(-radius / 2, radius * Math.sqrt(3) / 2),
            new PIXI.Point(-radius, 0),
            new PIXI.Point(-radius / 2, -radius * Math.sqrt(3) / 2),
            new PIXI.Point(radius / 2, -radius * Math.sqrt(3) / 2),
        ]);
    }

    update(progress: number) {
        if (progress > this.progress) {
            this.progress = progress;
        } else {
            this.progress += 0.003;
            this.progress = Math.min(1, this.progress);
        }
        this.text.text = 'Loading... ' + Math.round(this.progress * 100) + '%';
        for (let i = 0; i < this.hexes.length; i++) {
            let hex = this.hexes[i];
            hex.visible = i < this.progress * this.hexes.length;
        }
    }
}