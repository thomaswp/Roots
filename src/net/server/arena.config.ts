import Arena from "@colyseus/arena";
import { monitor } from "@colyseus/monitor";
import { GameRoom } from "./GameRoom";
import express from 'express';
import path from 'path';

export default Arena({
    getId: () => "Your Colyseus App",

    initializeGameServer: (gameServer) => {
        /**
         * Define your room handlers:
         */
        gameServer.define('game_room', GameRoom)
            .enableRealtimeListing();
            

    },

    initializeExpress: (app) => {
        app.use('/', express.static(path.join(__dirname, "../../../static")));

        /**
         * Bind your custom express routes here:
         */
        // app.get("/", (req, res) => {
        //     res.send("It's time to kick ass and chew bubblegum!");
        // });

        /**
         * Bind @colyseus/monitor
         * It is recommended to protect this route with a password.
         * Read more: https://docs.colyseus.io/tools/monitor/
         */
        app.use("/colyseus", monitor());
    },


    beforeListen: () => {
        /**
         * Before before gameServer.listen() is called.
         */
    }
});