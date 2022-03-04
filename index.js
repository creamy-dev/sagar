const express = require('express');
const Database = require("@creamy-dev/1udb");
const WebSocket = require('ws');
const compileSass = require('express-compile-sass');

const Token = require('js-sha512').sha512;

const credentials = new Database("./cred.json");

const app = express();

app.use(express.static("./src/"));
app.use(express.json());

app.use(compileSass({
    root: "./src/",
    sourceMap: true, 
    sourceComments: true, 
    watchFiles: true, 
    logToConsole: true 
}));

app.post("/api/v1/createacc", async function(req, res) {
    let { username, password } = req.body;

    if (username == null || password == null) {
        res.status(400).send({ "error": "Missing username or password" });
        return;
    }

    const token = Token(`${username}:${password}`);
    let userCheck = await credentials.query(token);
    console.log(userCheck);

    if (userCheck !== null) {
        res.status(400).send({ "error": "User already exists" });
        return;
    }

    await credentials.add(token, {"username": username, "password_sha512": Token(password)});
    res.status(200).send({ "success": "Account created", "token": token });
});

app.post("/api/v1/loginacc", async function (req, res) {
    let { username, password } = req.body;

    if (username == null || password == null) {
        res.status(400).send({ "error": "Missing username or password" });
        return;
    }

    const token = Token(`${username}:${password}`);
    let userCheck = await credentials.query(token);

    if (userCheck == null) {
        res.status(400).send({ "error": "User does not exist" });
        return;
    }

    res.status(200).send({ "success": "Logged in", "token": token });
});

async function initDB() {
    console.log("Initializing 'credentials' database...");
    await credentials.serialize();
    console.log("Done.");
}

async function isValidToken(token) {
    let tokenCheck = await credentials.get("token");

    if (tokenCheck == null) {
        return false;
    }

    return true;
}

initDB();

let server = app.listen(process.env.PORT);

let wss = new WebSocket.Server({
    server: server,
    perMessageDeflate: false
});

const interval = setInterval(function ping() {
    wss.clients.forEach(function each(ws) {
        if (ws.isAlive === false) return ws.terminate();

        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

wss.on('connection', function connection(ws, req) {
    const url = req.url;
    let token = url.split("/")

    if (url.startsWith("/game")) {
        if (token.length-1 !== 2) {
            ws.send(JSON.stringify({
                type: "error",
                message: "Missing token."
            }));

            ws.terminate();
            return;
        } else {
            token = token[2];

            if (isValidToken(token)) {
                ws.send(JSON.stringify({
                    type: "error",
                    message: "Invalid token."
                }));

                ws.terminate();
                return;
            }
        }
    } else {
        ws.send(JSON.stringify({
            type: "error",
            message: "Invalid URL."
        }));

        ws.terminate();
        return;
    }

    ws.on('pong', function() {
        ws.isAlive = true;
    });

    ws.on('message', function message(data) {
        ws.send(data);
    });

    ws.send(url);
});

wss.on('close', function close() {
    clearInterval(interval);
});
