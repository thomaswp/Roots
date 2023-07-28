import * as PIXI from 'pixi.js';
import 'hammerjs'
import e from 'express';
import { lerp } from '../util/MathUtil';

export class Multitouch {

    readonly viewport: PIXI.Container;
    readonly app: PIXI.Application<HTMLCanvasElement>;

    readonly width: number;
    readonly height: number;

    private minScale = 1;
    private maxScale = 4;

    private hammer: HammerManager;

    private panViewport: PIXI.Container;
    private scaleViewport: PIXI.Container;

    private panStart: PIXI.Point;
    private pinchStartScale: number;

    private targetPan: PIXI.Point = new PIXI.Point(0, 0);
    private panVelocity: PIXI.Point = new PIXI.Point(0, 0);
    private targetScale: number;

    private justFinishedGesturing = false;
    public get isGesturing() : boolean {
        return this.pinchStartScale !== undefined || this.panStart !== undefined || this.justFinishedGesturing;
    }

    public get scale() : number {
        return this.scaleViewport.scale.x;
    }

    private set scale(value: number) {
        this.scaleViewport.scale.x = this.scaleViewport.scale.y = value;
    }


    constructor(app: PIXI.Application<HTMLCanvasElement>, parent: PIXI.Container, width: number, height: number) {
        this.app = app;
        this.viewport = this.panViewport = new PIXI.Container();
        this.scaleViewport = new PIXI.Container();
        this.scaleViewport.x = app.view.width / 2;
        this.scaleViewport.y = app.view.height / 2;

        this.minScale = Math.min(app.view.width / width, app.view.height / height);

        this.scale = this.targetScale = this.minScale;

        this.width = width;
        this.height = height;

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
            this.targetScale = targetScale;
        });
        this.hammer.on('pinchend', (e) => {
            this.pinchStartScale = undefined;
            this.justFinishedGesturing = true;
        });

        this.hammer.get('pan').set({ direction: Hammer.DIRECTION_ALL, threshold: 5, pointers: 1 });

        this.hammer.on('panstart', (e) => {
            if (this.panStart !== undefined) return;
            this.panStart = new PIXI.Point(this.panViewport.x, this.panViewport.y);
            this.panVelocity.set(0, 0);
        });
        this.hammer.on('panmove', (e) => {
            this.targetPan.set(
                this.panStart.x + e.deltaX / this.scale,
                this.panStart.y + e.deltaY / this.scale
            );
        });
        this.hammer.on('panend', (e) => {
            this.panStart = undefined;
            this.panVelocity.set(e.velocityX, e.velocityY);
            this.justFinishedGesturing = true;
        });
    }

    update(delta: number) {
        this.justFinishedGesturing = false;

        let velocityScale = 6
        this.targetPan.x += this.panVelocity.x * delta / this.scale * velocityScale;
        this.targetPan.y += this.panVelocity.y * delta / this.scale * velocityScale;

        let friction = 0.95;
        this.panVelocity.x *= friction;
        this.panVelocity.y *= friction;

        let targetX = this.targetPan.x;
        let targetY = this.targetPan.y;

        let targetScale = this.targetScale;

        let lerpRate = 0.2 * delta;
        this.scale = lerp(this.scale, targetScale, lerpRate, 0.005);

        // Demon magic: do not mess with
        let boundsX = Math.max((-this.app.view.width / 2 / this.scale + this.width * 0.7), 0);
        let boundsY = Math.max((-this.app.view.height / 2 / this.scale + this.height * 0.7), 0);
        // console.log('target', targetX, targetY);
        // console.log('bounds', boundsX, boundsY);
        if (targetX < -boundsX) targetX = -boundsX;
        if (targetX > boundsX) targetX = boundsX;
        if (targetY < -boundsY) targetY = -boundsY;
        if (targetY > boundsY) targetY = boundsY;

        lerpRate = 0.6 * delta;
        this.panViewport.x = lerp(this.panViewport.x, targetX, lerpRate, 0.5);
        this.panViewport.y = lerp(this.panViewport.y, targetY, lerpRate, 0.5);
    }
}