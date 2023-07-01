import { defineHex, Grid, rectangle } from "honeycomb-grid";
import { Roots } from "./Roots";
import { Color } from "pixi.js";

export class Tile extends defineHex({ dimensions: 30, origin: "topLeft" }) {
  
    // this property is present in the instance
    active: boolean = false;
    tempActive: boolean = false;
    groupIndex: number;
    game: Roots;
  
    clicked() {
        if (this.active) return;
        this.game.tileClicked(this);
    }
  }