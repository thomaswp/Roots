import * as PIXI from 'pixi.js';
import 'hammerjs'
import e from 'express';
import { lerp } from '../util/MathUtil';

export class Multitouch {

    minScale = 1;
    // TODO: base on screen size
    maxScale = 4;

    hammer: HammerManager;
    viewport: PIXI.Container;
    private panViewport: PIXI.Container;
    private scaleViewport: PIXI.Container;

    panStart: PIXI.Point;
    pinchStartScale: number;

    get scale() : number {
        return this.scaleViewport.scale.x;
    }

    constructor(app: PIXI.Application<HTMLCanvasElement>, parent: PIXI.Container) {
        this.viewport = this.panViewport = new PIXI.Container();
        this.scaleViewport = new PIXI.Container();
        this.scaleViewport.x = app.view.width / 2;
        this.scaleViewport.y = app.view.height / 2;

        // this.scaleViewport.scale.x = this.scaleViewport.scale.y = 2;

        parent.addChild(this.scaleViewport);
        this.scaleViewport.addChild(this.panViewport);


        this.hammer = new Hammer(app.view);
        this.hammer.get('pinch').set({ enable: true });

        // let transform = new PIXI.Matrix();
        // this.viewport.transform.setFromMatrix(transform);

        this.hammer.on('pinchstart', (e) => {
            if (this.pinchStartScale !== undefined) return;
            this.pinchStartScale = this.scale;
        });
        this.hammer.on('pinchmove', (e) => {
            let targetScale = this.pinchStartScale * e.scale;
            if (targetScale < this.minScale) targetScale = this.minScale;
            if (targetScale > this.maxScale) targetScale = this.maxScale;
            // if (Math.abs(Math.log(e.scale)) < 0.05) targetScale = this.pinchStartScale;
            let lerpRate = 0.05;
            this.scaleViewport.scale.x = this.scaleViewport.scale.y =
                lerp(this.scale, targetScale, lerpRate, 0.5);
        });
        this.hammer.on('pinchend', (e) => {
            this.pinchStartScale = undefined;
        });

        this.hammer.get('pan').set({ direction: Hammer.DIRECTION_ALL, threshold: 5, pointers: 2 })
            .recognizeWith(this.hammer.get('pinch'));

        this.hammer.on('panstart', (e) => {
            if (this.panStart !== undefined) return;
            console.log('pan start!');
            this.panStart = new PIXI.Point(this.panViewport.x, this.panViewport.y);
        });
        this.hammer.on('panmove', (e) => {
            let lerpRate = 0.1;

            let targetX = this.panStart.x + e.deltaX / this.scale;
            let targetY = this.panStart.y + e.deltaY / this.scale;

            let scale = this.scale;

            // Demon magic: do not mess with
            let boundsX = app.view.width * (scale - 1) / 2 / scale;
            let boundsY = app.view.height * (scale - 1) / 2 / scale;
            // console.log('target', targetX, targetY);
            // console.log('bounds', boundsX, boundsY);
            if (targetX < -boundsX) targetX = -boundsX;
            if (targetX > boundsX) targetX = boundsX;
            if (targetY < -boundsY) targetY = -boundsY;
            if (targetY > boundsY) targetY = boundsY;



            // TODO: lerp should happen in update based on ideal value, so it doesn't stop at panend
            this.panViewport.x = lerp(this.panViewport.x, targetX, lerpRate, 0.5);
            this.panViewport.y = lerp(this.panViewport.y, targetY, lerpRate, 0.5);
        });
        this.hammer.on('panend', (e) => {
            this.panStart = undefined;
        });
    }
}