import { defineHex } from "honeycomb-grid";
import { Roots } from "./Roots";

export class Tile extends defineHex({ dimensions: 30, origin: "topLeft" }) {
  
    // this property is present in the instance
    id: number;
    unlocked: boolean = false;
    active: boolean = false;
    groupIndex: number;
    game: Roots;
  
    isPassable() {
        return this.active || this.unlocked;
    }

    clicked() {
        if (this.unlocked) return;
        this.game.tileClicked(this);
    }
  }