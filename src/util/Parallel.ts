export async function parallelLoop(stepper: (i: number) => boolean, maxMSPerFrame: number) {
    let i = 0;
    let start = Date.now();
    while (stepper(i)) {
        i++;
        if (Date.now() - start > maxMSPerFrame) {
            await wait(0);
            console.log('waiting');
            start = Date.now();
        }
    }
}

export async function wait(ms: number) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    })
}

export async function waitUntil(until: () => boolean) {
    return new Promise<void>(resolve => {
        let interval = setInterval(() => {
            if (until()) {
                clearInterval(interval);
                resolve();
            }
        }, 1000 / 60);
    })
}