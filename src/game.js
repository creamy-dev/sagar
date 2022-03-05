function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    if (localStorage.getItem("token") == null) {
        window.location.replace("/login.html");
        return;
    }

    const Game = new WebSocket(window.location.origin.replaceAll("https://", "wss://").replaceAll("http://", "ws://") + "/game/" + localStorage.getItem("token"));

    Game.onmessage = e => {
        let parsed = JSON.parse(e.data);

        if (parsed.type == "error") {
            if (parsed.message != "You are being rate limited!" && parsed.message != "Invalid token.") {
                alert("An unexpected error has occured! " + parsed.message);
            } else {
                alert(parsed.message);
            }
        } else if (parsed.type == "connections") {
            console.log("Got connections list: " + parsed.connections);

            document.getElementsByClassName("leaderboard-content")[0].innerHTML = "";
            for (connection of parsed.connections) {
                if (connection != localStorage.getItem("username")) {
                    document.getElementsByClassName("leaderboard-content")[0].innerHTML += "<h20>" + connection + "</h20><br>";
                }
            }

            document.getElementsByClassName("plb_loaderfill")[0].remove()
        }
    }

    window.onbeforeunload = function (event) {
        console.log("Closing connections...");
        Game.close();
        return;
    };
}

main();