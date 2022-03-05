if (localStorage.getItem("token") == undefined) {
    window.location.replace("/login.html");
}

const Game = new WebSocket(window.location.origin.replaceAll("https://", "wss://").replaceAll("http://", "ws://") + "/game/" + localStorage.getItem("token"));

Game.onmessage = e => {
    let parsed = JSON.parse(e.data);

    if (parsed.type == "error") {
        if (parsed.message != "Already connected." && parsed.message != "Invalid token.") {
            Game.send(JSON.stringify({"type":"quit"}));
            alert("An unexpected error has occured! " + parsed.message);
        } else {
            alert(parsed.message);
        }
    }
}

addEventListener("beforeunload", () => {
    event.preventDefault();
});