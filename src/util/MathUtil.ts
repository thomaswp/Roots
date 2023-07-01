export function lerp(a: number, b: number, p: number, thresh: number) {
    if (thresh !== undefined && Math.abs(a - b) < thresh) return b;
    return a * (1 - p) + b * p;
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