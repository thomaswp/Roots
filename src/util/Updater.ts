/**
 * A function that will be called every frame until it returns false.
 */
export type UpdateFunction = () => (boolean | void)

export class Action {

    name: string;
    updater: Updater;
    subactions: UpdateFunction[] = [];
    onSuccess: (value: void | PromiseLike<void>) => void;


    constructor(update?: UpdateFunction) {
        if (update) this.then(update);
    }

    halt() {
        if (this.updater) this.updater.remove(this);
    }

    update(): UpdateFunction {
        // If we're out of things to do, remove ourselves from the runner
        if (this.subactions.length == 0) {
            this.halt();
            return;
        }
        
        // Run the next update function
        let next = this.subactions[0];
        if (!next()) {
            // If it's completed, remove it and update again
            this.subactions.shift();
            this.update();
        }
    }

    then(updateWhile: UpdateFunction) {
        this.subactions.push(updateWhile);
        return this;
    }

    wait(frames: number) {
        return this.then(() => {
            frames -= 1;
            return frames <= 0;
        })
    }

    unique(name: string, displace: boolean) {
        this.name = name;
        let existing = this.updater.actions.find(action => action.name == name && action != this);
        if (!existing) return;
        if (displace) {
            existing.halt();
        } else {
            this.halt();
        }
    }
}

export class Updater {

    actions: Action[] = [];

    runAction(action: Action) {
        this.actions.push(action);
        action.updater = this;
    }

    run(update: UpdateFunction) : Action {
        let action = new Action(update);
        this.runAction(action);
        return action;
    }

    remove(action: Action) {
        let index = this.actions.indexOf(action);
        if (index !== -1) this.actions.splice(index, 1);
    }

    update() {
        this.actions.forEach(action => action.update());
    }
}