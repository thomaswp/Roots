import { Tile } from "../roots/Tile";
import { GameRenderer } from "./GameRenderer";
import { HexRenderer } from "./HexRenderer";

interface TutorialStep {
    name: string;
    isReady: () => boolean;
    activate: () => void;
}

export class TutorialRenderer {

    renderer: GameRenderer;

    movesetIndex: number;
    nextStoneGroup: number;
    currentMoveset: HexRenderer[];
    showing: Set<HexRenderer> = new Set();

    tiles: Tile[];

    get hexes() {
        return this.renderer.gridRenderer.hexes;
    }

    get multitouch() {
        return this.renderer.multitouch;
    }

    tutorialStepIndex = 0;
    tutorialSteps: TutorialStep[] = [
        {
            name: 'activate',
            // TODO: probably better to make this "isDone" and advance then
            isReady: () => true,
            activate: () => {
                this.updateShowing(this.currentMoveset.slice(2, 4));
            }
        },
        {
            name: 'deactivate',
            isReady: () => this.renderer.activatedTiles.size == 2,
            activate: () => {

            }
        },
        {
            name: 'match',
            isReady: () => this.renderer.activatedTiles.size == 0,
            activate: () => {
                this.updateShowing(this.currentMoveset.slice(0, 4));
            }
        },
        {
            name: 'match again',
            isReady: () => this.currentMoveset[0].tile.unlocked,
            activate: () => {

            }
        },
        {
            name: 'up to stone',
            isReady: () => this.currentMoveset[2].tile.unlocked,
            activate: () => {
                this.updateShowing(this.currentMoveset.slice(0, this.currentMoveset.length - 2));
            }
        },
        {
            name: 'stone',
            isReady: () => this.currentMoveset.filter(t => !t.tile.unlocked).length == 2,
            activate: () => {
                this.updateShowing(this.currentMoveset.slice(0, this.currentMoveset.length));
            }
        },
        {
            name: 'second moveset',
            isReady: () => this.currentMoveset.filter(t => !t.tile.unlocked).length == 0,
            activate: () => {
                this.findNextMoveset();
                this.updateShowing(this.currentMoveset);
            }
        },
        {
            name: 'third moveset',
            isReady: () => this.currentMoveset.filter(t => !t.tile.unlocked).length == 0,
            activate: () => {
                this.findNextMoveset();
                this.updateShowing(this.currentMoveset);
            }
        },
        {
            name: 'extra stone',
            isReady: () => this.currentMoveset.filter(t => !t.tile.unlocked).length == 0,
            activate: () => {
                this.findNextMoveset();
                let nextGroup = this.currentMoveset.filter(h => !h.tile.unlocked)[0].tile.groupIndex;
                console.log(this.currentMoveset, nextGroup);
                let nextMove = this.currentMoveset.filter(t => t.tile.groupIndex == nextGroup);
                let neighborTiles = nextMove.flatMap(h => h.tile.getNeighbors());
                let showing = this.hexes.filter(h => neighborTiles.includes(h.tile));
                this.updateShowing([...nextMove, ...showing]);
            }
        },
    ];

    constructor(renderer: GameRenderer) {
        this.renderer = renderer;
        this.init();
    }

    init() {
        this.tiles = this.renderer.game.grid.toArray().filter(t => t.groupIndex !== undefined);
        this.tiles.sort((a, b) => a.groupIndex - b.groupIndex);
        this.findNextMoveset();
    }

    findNextMoveset() {
        let nextStoneTile = this.tiles.filter(t => t.isStoneTile && !t.unlocked)[0];
        this.nextStoneGroup = nextStoneTile.groupIndex;
        this.movesetIndex = nextStoneTile.movesetIndex;
        this.currentMoveset = this.getIconHexes()
        .filter(t => t.tile.movesetIndex == this.movesetIndex && t.tile.groupIndex <= this.nextStoneGroup)
        .sort((a, b) => a.tile.groupIndex - b.tile.groupIndex);
    }

    step() {
        if (this.tutorialStepIndex >= this.tutorialSteps.length) return;
        let nextStep = this.tutorialSteps[this.tutorialStepIndex];
        if (nextStep.isReady()) {
            nextStep.activate();
            console.log('starting tutorial step:', nextStep.name);
            this.tutorialStepIndex++;
        }
    }

    updateShowing(addedTiles: HexRenderer[]) {
        addedTiles.forEach(t => this.showing.add(t));
        this.hexes.forEach(t => {
            t.setHidden(!this.showing.has(t));
        });
        this.multitouch.show([...this.showing.keys()]);
    }

    getIconHexes() {
        return this.hexes.filter(t => t.tile.groupIndex !== undefined);
    }

    getLockedHexes() {
        return this.hexes.filter(t => !t.tile.unlocked && t.tile.groupIndex !== undefined);
    }

    getNextGroupIndex() {
        let lockedHexes = this.getLockedHexes();
        return lockedHexes.reduce((min, hex) => Math.min(min, hex.tile.groupIndex), Number.MAX_VALUE);
    }

    getNextGroup() {
        return this.getLockedHexes().filter(t => t.tile.groupIndex == this.getNextGroupIndex());
    }

}