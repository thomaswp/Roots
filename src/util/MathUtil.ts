import * as PIXI from "pixi.js";

export function lerp(a: number, b: number, p: number, thresh: number) {
    if (thresh !== undefined && Math.abs(a - b) < thresh) return b;
    return a * (1 - p) + b * p;
}

export function lerpColor(a: PIXI.Color, b: PIXI.Color, p: number, thresh: number) {
    if (a.red == b.red && a.green == b.green && a.blue == b.blue && a.alpha == b.alpha) return b;
    return new PIXI.Color([
        lerp(a.red, b.red, p, thresh),
        lerp(a.green, b.green, p, thresh),
        lerp(a.blue, b.blue, p, thresh),
        lerp(a.alpha, b.alpha, p, thresh),
    ]);
}

let colorA = new PIXI.Color(), colorB = new PIXI.Color(), colorOut = new PIXI.Color();
export function lerpHexColor(a: PIXI.ColorSource, b: PIXI.ColorSource, p: number, thresh: number = 0.005): number {
    colorA.setValue(a);
    colorB.setValue(b);
    colorOut.setValue([
        lerp(colorA.red, colorB.red, p, thresh),
        lerp(colorA.green, colorB.green, p, thresh),
        lerp(colorA.blue, colorB.blue, p, thresh),
        lerp(colorA.alpha, colorB.alpha, p, thresh),
    ]);
    return colorOut.toNumber();
}

export function argMax<T>(array: T[], mapper: (item: T) => number) {
    if (array.length == 0) return null;
    let index = array.map((x, i) => [mapper(x), i])
        .reduce((r, a) => (a[0] > r[0] ? a : r))[1];
    return array[index];
}

export function argMin<T>(array: T[], mapper: (item: T) => number) {
    if (array.length == 0) return null;
    let index = array.map((x, i) => [mapper(x), i])
        .reduce((r, a) => (a[0] < r[0] ? a : r))[1];
    return array[index];
}

export function removeFrom<T>(array: T[], item: T) : boolean {
    let index = array.indexOf(item);
    if (index < 0) return false;
    array.splice(index, 1);
    return true;
}