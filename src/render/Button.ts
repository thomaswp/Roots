import * as PIXI from 'pixi.js';
import { SpriteH } from 'pixi-heaven';
import { Event } from '../util/Event';
import { Updater } from '../util/Updater';
import { lerp } from '../util/MathUtil';

export class Button extends PIXI.Container {

    static nextID = 0;

    readonly onClicked = new Event<void>();
    readonly icon: SpriteH;

    private id = Button.nextID++;

    constructor(sourcePath: string, updater: Updater) {
        super();
        this.icon = new SpriteH(PIXI.Texture.from(sourcePath));
        this.addChild(this.icon);

        this.icon.color.setDark(0.7, 0.7, 0.7);
        this.icon.anchor.set(0, 0);
        this.icon.interactive = true;
        this.icon.on('click', () => {
            this.onClicked.emit();
        });

        let uniqueName = 'buttonHover' + this.id;
        this.icon.on('mouseover', () => {
            updater.run(() => {
                let dark = this.icon.color.dark[0];
                dark = lerp(dark, 1, 0.2, 0.01);
                this.icon.color.setDark(dark, dark, dark);
                return dark < 1;
            }).unique(uniqueName, true);
        });
        this.icon.on('mouseout', () => {
            updater.run(() => {
                let dark = this.icon.color.dark[0];
                dark = lerp(dark, 0.7, 0.2, 0.01);
                this.icon.color.setDark(dark, dark, dark);
                return dark > 0.7;
            }).unique(uniqueName, true);
        });
    }
}