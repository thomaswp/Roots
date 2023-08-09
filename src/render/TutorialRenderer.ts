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

    isError: boolean = false;

    tutorialStepIndex = 0;
    tutorialSteps: TutorialStep[] = [
        {
            name: 'activate first',
            // TODO: probably better to make this "isDone" and advance then
            isReady: () => true,
            activate: () => {
                this.renderer.autoSelectGroup = false;
                this.updateShowing(this.currentMoveset.slice(2, 4));
            }
        },
        {
            name: 'activate second',
            isReady: () => true,
            activate: () => {
                // TODO: Show message
            }
        },
        {
            name: 'show mddle',
            isReady: () => this.renderer.activatedTiles.size == 2,
            activate: () => {
                let showing = this.currentMoveset.slice(2, 4);
                let grid = this.renderer.game.grid;
                let toShow = this.currentMoveset.slice(0, 2).filter(r => {
                    console.log(grid.distance(r.tile, showing[0].tile) == 1,
                    grid.distance(r.tile, showing[1].tile));
                    return grid.distance(r.tile, showing[0].tile) == 1 &&
                        grid.distance(r.tile, showing[1].tile) == 1;

                });
                this.updateShowing(toShow);
            }
        },
        {
            name: 'deactivate',
            isReady: () => this.isError,
            activate: () => {
                // TODO: Show deactivate message
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
            name: 'auto select',
            isReady: () => this.tiles.filter(t => t.unlocked).length > 4,
            activate: () => {
                this.renderer.autoSelectGroup = true;
            }
        },
        {
            name: 'stone',
            isReady: () => this.currentMoveset.filter(t => !t.tile.unlocked).length == 2,
            activate: () => {
                this.updateShowing(this.currentMoveset.slice(0, this.currentMoveset.length));
            }
        },
        // TODO: Combine second and third moveset
        // TODO: On mobile, explain panning
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
        // TODO: Use fixed seed for fixed order: introduce gap (step by step) and then tripple
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
        // TODO: Show all 2s and 3s: Talk about colors
        // TODO: Show 4, 5, and 6s discussing each
        // TODO: Tutorial finish
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

    step(isError = false) {
        this.isError = isError;
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