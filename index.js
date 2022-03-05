const express = require('express');
const Database = require("@creamy-dev/1udb");
const WebSocket = require('ws');
const e = require('express');

const Token = require('js-sha512').sha512;
const credentials = new Database("./cred.json");

const app = express();

app.use(express.static("./src/"));
app.use(express.json());

let connections = [];

app.post("/api/v1/createacc", async function (req, res) {
    let { username, password } = req.body;

    if (username == null || password == null) {
        res.status(400).send({ "error": "Missing username or password" });
        return;
    }

    const token = Token(`${username}:${password}`);
    let userCheck = await credentials.get(token);

    if (userCheck !== null) {
        res.status(400).send({ "error": "User already exists" });
        return;
    }

    await credentials.add(token, { "username": username, "password_sha512": Token(password) });
    res.status(200).send({ "success": "Account created", "token": token });
});

app.post("/api/v1/loginacc", async function (req, res) {
    let { username, password } = req.body;

    if (username == null || password == null) {
        res.status(400).send({ "error": "Missing username or password" });
        return;
    }

    const token = Token(`${username}:${password}`);
    let userCheck = await credentials.get(token);

    if (userCheck == null) {
        res.status(400).send({ "error": "User does not exist" });
        return;
    }

    res.status(200).send({ "success": "Logged in", "token": token });
});

app.post("/api/v1/getusername", async function (req, res) {
    let { token } = req.body;

    if (token == null) {
        res.status(400).send({ "error": "Missing token" });
        return;
    }

    let tokenCheck = await getTokenData(token);

    if (tokenCheck == null) {
        res.status(400).send({ "error": "Invalid token" });
        return;
    }

    res.status(200).send({ "success": "Username retrieved", "username": tokenCheck.username });
})

async function initDB() {
    console.log("Initializing 'credentials' database...");
    await credentials.serialize();
    console.log("Done.");
}

async function isValidToken(token) {
    let tokenCheck = await credentials.get(token);

    if (tokenCheck == null) {
        return false;
    }

    return true;
}

async function getTokenData(token) {
    let tokenCheck = await credentials.get(token);

    if (tokenCheck == null) {
        return null;
    }

    return tokenCheck;
}

initDB();

let server = app.listen(process.env.PORT);

let wss = new WebSocket.Server({
    server: server,
    perMessageDeflate: false
});

wss.on('connection', async function connection(ws, req) {
    let data = {};
    let token = req.url.split("/");

    /*
    const interval = setInterval(function ping() {
        if (ws.isAlive === false) return ws.terminate();

        disableKeepalive();
        ws.ping();
    }, 100);
    */

    function disableKeepalive() {
        //clearInterval(interval);
        ws.isAlive = false;
        let localConnections = [];

        for (let i = 0; i < connections.length; i++) {
            if (connections[i] !== data.username) {
                localConnections.push(connections[i]);
            }
        }

        connections = localConnections;
        ws.terminate();

        return;
    }

    async function joinDaemon() {
        let hacky = "";
        async function sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        while (true) {
            if (ws.isAlive) {
                let hackyLocal = JSON.stringify({ "type": "connections", "connections": connections });

                if (hackyLocal !== hacky) {
                    hacky = hackyLocal;
                    ws.send(hacky);
                }

                await sleep(100);
            }
        }
    }

    if (req.url.startsWith("/game")) {
        if (token.length - 1 !== 2) {
            ws.send(JSON.stringify({
                type: "error",
                message: "Missing token."
            }));

            ws.terminate();
            disableKeepalive();
            return;
        } else {
            token = token[2];

            if (!await isValidToken(token)) {
                ws.send(JSON.stringify({
                    type: "error",
                    message: "Invalid token."
                }));

                ws.terminate();
                disableKeepalive();
                return;
            }

            ws.isAlive = true;
            data = await getTokenData(token);

            if (connections.includes(data.username)) {
                ws.send(JSON.stringify({
                    type: "error",
                    message: "Already connected."
                }));

                ws.terminate();
                disableKeepalive();
                return;
            }

            connections.push(data.username);
        }
    } else {
        ws.send(JSON.stringify({
            type: "error",
            message: "Invalid URL."
        }));

        ws.terminate();
        disableKeepalive();
        return;
    }

    joinDaemon();

    ws.on('pong', function() {
        ws.isAlive = true;
    });

    ws.on('message', function message(data) {
        let dataParsed = {};

        try {
            dataParsed = JSON.parse(data);
        } catch (e) {
            if (!e instanceof SyntaxError) {
                console.error(e);
            }
        }

        if (dataParsed.type == undefined) {
            ws.send(JSON.stringify({ "type": "error", "message": "Missing data." }));
        } else if (dataParsed.type === "quit") {
            ws.send(JSON.stringify({ "message": "Goodbye." }));
            ws.terminate();
            disableKeepalive();
            return;
        } else if (dataParsed.type === "bounce" && dataParsed.message !== undefined) {
            ws.send(JSON.stringify({ "type": "bounce", "message": dataParsed.message }));
        }
    });
});