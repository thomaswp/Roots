import * as PIXI from 'pixi.js';
import 'hammerjs'
import e from 'express';
import { lerp } from '../util/MathUtil';
import { GameRenderer } from './GameRenderer';
import { HexRenderer } from './HexRenderer';

export class Multitouch {

    readonly viewport: PIXI.Container;
    readonly app: PIXI.Application<HTMLCanvasElement>;
    readonly renderer: GameRenderer;

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

    private updatesSinceLastGesture = 0;
    public get isGesturing() : boolean {
        return this.isPinching || this.panStart !== undefined || this.updatesSinceLastGesture < 5;
    }

    public get isPinching() : boolean {
        return this.pinchStartScale !== undefined;
    }

    public get scale() : number {
        return this.scaleViewport.scale.x;
    }

    private set scale(value: number) {
        this.scaleViewport.scale.x = this.scaleViewport.scale.y = value;
    }

    resetTransform() {
        let app = this.app;
        this.scaleViewport.x = app.view.width / 2;
        this.scaleViewport.y = app.view.height / 2;

        this.minScale = Math.min(app.view.width / this.width, app.view.height / this.height) * 0.97;

        this.scale = this.targetScale = this.minScale;
    }

    constructor(renderer: GameRenderer, parent: PIXI.Container, width: number, height: number) {
        this.renderer = renderer;
        let app = this.app = renderer.app;
        this.viewport = this.panViewport = new PIXI.Container();
        this.scaleViewport = new PIXI.Container();
        
        this.width = width;
        this.height = height;

        this.resetTransform();
        renderer.onResized.addHandler(() => {
            this.resetTransform();
        }, true);


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
            this.updatesSinceLastGesture = 0;
        });
        window.addEventListener('wheel', (e) => {
            let delta = e.deltaY;
            let targetScale = this.scale - delta * 0.004;
            if (targetScale < this.minScale) targetScale = this.minScale;
            if (targetScale > this.maxScale) targetScale = this.maxScale;
            this.targetScale = targetScale;
        });

        this.hammer.get('pan').set({ direction: Hammer.DIRECTION_ALL, threshold: 10, pointers: 1 })
        // TODO: Need a better way to stop pan from occurring at the end of pinch.
        .requireFailure(this.hammer.get('pinch'));


        let maxDistance = new PIXI.Point();
        this.hammer.on('panstart', (e) => {
            if (this.panStart !== undefined) return;
            this.panStart = new PIXI.Point(this.panViewport.x, this.panViewport.y);
            this.panVelocity.set(0, 0);
            maxDistance.set(0, 0);
        });
        this.hammer.on('panmove', (e) => {
            if (this.panStart === undefined) return;
            maxDistance.x = Math.max(Math.abs(e.deltaX), maxDistance.x);
            maxDistance.y = Math.max(Math.abs(e.deltaY), maxDistance.y);
            let totalDistance = Math.sqrt(maxDistance.x * maxDistance.x + maxDistance.y * maxDistance.y);

            // If we haven't moved much, then cancel the pan.
            if (e.deltaTime > 300 && totalDistance < 50) {
                this.panStart = undefined;
                return;
            }

            this.renderer.gridRenderer.clearHover();

            this.targetPan.set(
                this.panStart.x + e.deltaX / this.scale,
                this.panStart.y + e.deltaY / this.scale
            );
        });
        this.hammer.on('panend', (e) => {
            if (this.panStart === undefined) return;
            this.panStart = undefined;
            this.panVelocity.set(e.velocityX, e.velocityY);
            this.updatesSinceLastGesture = 0;
        });

        this.hammer.get('tap').set({ pointers: 2, enable: true})
        .recognizeWith(this.hammer.get('pinch'));
        this.hammer.on('tap', (e) => {
            this.renderer.clearActiveTiles();
            this.updatesSinceLastGesture = 0;
        });
    }

    show(hexes: HexRenderer[], margin: number = 20) {
        let min = new PIXI.Point(Number.MAX_VALUE, Number.MAX_VALUE);
        let max = new PIXI.Point(-Number.MAX_VALUE, -Number.MAX_VALUE);
        for (let hex of hexes) {
            let x = hex.x - this.width / 2;
            let y = hex.y - this.height / 2;
            min.x = Math.min(min.x, x - hex.width / 2);
            min.y = Math.min(min.y, y - hex.height / 2);
            max.x = Math.max(max.x, x + hex.width / 2);
            max.y = Math.max(max.y, y + hex.height / 2);
        }
        min.x -= margin;
        min.y -= margin;
        max.x += margin;
        max.y += margin;

        let centerX = (min.x + max.x) / 2;
        let centerY = (min.y + max.y) / 2;
        this.targetPan.set(-centerX, -centerY);

        let width = max.x - min.x;
        let height = max.y - min.y;

        let targetScale = Math.min(this.app.view.width / width, this.app.view.height / height);
        this.targetScale = Math.min(targetScale, this.maxScale);
    }

    update(delta: number) {
        this.updatesSinceLastGesture++;

        let velocityScale = 6
        this.targetPan.x += this.panVelocity.x * delta / this.scale * velocityScale;
        this.targetPan.y += this.panVelocity.y * delta / this.scale * velocityScale;

        let friction = 0.95;
        this.panVelocity.x *= friction;
        this.panVelocity.y *= friction;

        let targetX = this.targetPan.x;
        let targetY = this.targetPan.y;

        let targetScale = this.targetScale;

        let lerpRate = 0.3;
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

        lerpRate = 1; // To make it snappy on mobile
        this.panViewport.x = lerp(this.panViewport.x, targetX, lerpRate, 0.5);
        this.panViewport.y = lerp(this.panViewport.y, targetY, lerpRate, 0.5);
    }
}