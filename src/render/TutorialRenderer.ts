import { Tile } from "../roots/Tile";
import { GameRenderer } from "./GameRenderer";
import { HexRenderer } from "./HexRenderer";

interface TutorialStep {
    name: string;
    text: string;
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
            isReady: () => true,
            activate: () => {
                this.renderer.autoSelectGroup = false;
                this.updateShowing(this.currentMoveset.slice(0, 1));
                this.currentMoveset[0].showingIndicator = true;
            },
            text: '*Activate* a tile by {clicking} on it.',
        },
        {
            name: 'deactivate first',
            isReady: () => this.renderer.activeTileCount == 1,
            activate: () => {
                
            },
            text: '*Deactivate* the by {clicking} on it again.',
        },
        {
            name: 'activate second',
            isReady: () => this.renderer.activeTileCount == 0,
            activate: () => {
                this.updateShowing(this.currentMoveset.slice(0, 2));
                this.currentMoveset[1].showingIndicator = true;
            },
            text: '*Activate* two matching tiles to *unlock* the pair.',
        },
        {
            name: 'try second pair',
            isReady: () => this.currentMoveset[0].tile.unlocked,
            activate: () => {
                this.clearIndicators();
                let tiles = this.currentMoveset.slice(4, 6);
                tiles.forEach(t => t.showingIndicator = true);
                this.updateShowing(tiles);
            },
            text: 'Those two tiles are now permenantly *unlocked*! ' +
                'Now, try to *unlock* the next matching pair.',
        },
        // {
        //     name: 'activate first',
        //     // TODO: probably better to make this "isDone" and advance then
        //     isReady: () => true,
        //     activate: () => {
        //         this.updateShowing(this.currentMoveset.slice(2, 4));
        //     }
        // },
        // {
        //     name: 'activate second',
        //     isReady: () => true,
        //     activate: () => {
        //         // TODO: Show message
        //     }
        // },
        {
            name: 'show mddle',
            isReady: () => this.renderer.activatedTiles.size == 2,
            activate: () => {
                // let grid = this.renderer.game.grid;
                // let toShow = this.currentMoveset.slice(0, 2).filter(r => {
                //     console.log(grid.distance(r.tile, showing[0].tile) == 1,
                //     grid.distance(r.tile, showing[1].tile));
                //     return grid.distance(r.tile, showing[0].tile) == 1 &&
                //         grid.distance(r.tile, showing[1].tile) == 1;

                // });
                let toShow = this.currentMoveset[3];
                this.clearIndicators();
                toShow.showingIndicator = true;
                this.updateShowing([toShow]);
            },
            text: 'The tiles did not *unlock*! ' +
                'Tiles will only unlock if they are connected by *activated* or *unlocked* tiles. ' + 
                'Try selecting a third tile to connect the first two.',
        },
        {
            name: 'deactivate',
            isReady: () => this.isError,
            activate: () => {
                this.clearIndicators();
            },
            text: 'Oops, you can only *activate* two tiles at a time. ' +
                'You can see how many tiles you have left to activate in the corner of the screen. ' + 
                'Now, *deactivate* all tiles by {right clicking} anywhere on screen.',
        },
        {
            name: 'match',
            isReady: () => this.renderer.activatedTiles.size == 0,
            activate: () => {
                this.updateShowing(this.currentMoveset.slice(0, 4));
            },
            text: 'Order matters. Try *unlocking* these tiles in the correct order.',
        },
        {
            name: 'up to stone',
            isReady: () => this.currentMoveset[4].tile.unlocked,
            activate: () => {
                this.updateShowing(this.currentMoveset.slice(0, this.currentMoveset.length - 2));

            },
            text: 'Great job! Now *unlock* another pair.',
        },
        {
            name: 'auto select',
            isReady: () => this.tiles.filter(t => t.unlocked).length > 4,
            activate: () => {
                this.renderer.autoSelectGroup = true;
            },
            text: 'From now on, to save time, when you {click} on a tile, ' + 
                'the game will *activate* all matching tiles for you (if possible).',
        },
        {
            name: 'stone',
            isReady: () => this.currentMoveset.filter(t => !t.tile.unlocked).length == 2,
            activate: () => {
                this.updateShowing(this.currentMoveset.slice(0, this.currentMoveset.length));
            },
            text: 'Gray *stone tiles* are special. If you *unlock* three pairs of them, '
                + 'you can *activate* one extra tile at a time.',
        },
        // TODO: Combine second and third moveset
        // TODO: On mobile, explain panning
        {
            name: 'second moveset',
            isReady: () => this.currentMoveset.filter(t => !t.tile.unlocked).length == 0,
            activate: () => {
                this.findNextMoveset();
                this.updateShowing(this.currentMoveset);
            },
            text: 'Try completing the next section of the board.',
        },
        {
            name: 'third moveset',
            isReady: () => this.currentMoveset.filter(t => !t.tile.unlocked).length == 0,
            activate: () => {
                this.findNextMoveset();
                this.updateShowing(this.currentMoveset);
            },
            text: '*Unlock* all of the *stone tiles* to proceed.',
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
            },
            text: 'Now you can *activate* three tiles at a time! ' +
                'You can even activate blank (black) tiles if needed.' +
                'Now, *unlock* another pair of tiles.',
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
            this.renderer.showTutorialText(nextStep.text);
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

    clearIndicators() {
        this.hexes.forEach(t => {
            t.showingIndicator = false;
        });
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