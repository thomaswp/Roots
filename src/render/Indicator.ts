import * as PIXI from 'pixi.js';
import { lerp } from '../util/MathUtil';
import { GameRenderer } from './GameRenderer';

export class Indicator extends PIXI.Graphics {

    public showing = true;

    constructor(size: number, thickness = 2) {
        super();

        this.lineStyle(thickness, 0xffffff);
        this.drawCircle(0, 0, size / 2);
        this.endFill();
        this.alpha = 0;
    }

    // Bounds seems real glitchy - not sure this is worth automating...
    // static calculateBounds(targets: PIXI.Container[]): PIXI.Rectangle {
    //     if (targets.length == 0) return new PIXI.Rectangle(0, 0, 0, 0);
    //     let left = targets[0].;
    //     let right = targets[0].x + targets[0].width;
    //     let top = targets[0].y;
    //     let bottom = targets[0].y + targets[0].height;
    //     for (let i = 1; i < targets.length; i++) {
    //         let target = targets[i];
    //         left = Math.min(left, target.x);
    //         right = Math.max(right, target.x + target.width);
    //         top = Math.min(top, target.y);
    //         bottom = Math.max(bottom, target.y + target.height);
    //     };
    //     return new PIXI.Rectangle(left, top, right - left, bottom - top);
    // }

    update(delta: number) {
        let indicatorClockCycle = 100;
        let indicatorClock = (GameRenderer.clock % indicatorClockCycle) / indicatorClockCycle;
        let targetIndicatorAlpha = this.showing ? (1 - indicatorClock * 2) : 0;
        let targetIndicatorScale = 1 + indicatorClock * 0.5;
        this.alpha = lerp(this.alpha, targetIndicatorAlpha, delta * 0.3, 0.005);
        this.scale.x = this.scale.y = targetIndicatorScale; // / this.parent.scale.y;
    }
}