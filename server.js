const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");
const fetch = (...a) => import("node-fetch").then(({default:f}) => f(...a));

const stateFile = "state.json";
let state = fs.existsSync(stateFile)
  ? JSON.parse(fs.readFileSync(stateFile))
  : { rooms: {} };

function save() {
  fs.writeFileSync(stateFile, JSON.stringify(state));
}

const server = http.createServer((req, res) => {
  const file = req.url === "/" ? "index.html" : req.url;
  const filePath = path.join(__dirname, "public", file);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.end(data);
  });
});

const wss = new WebSocket.Server({ server });

wss.on("connection", ws => {
  ws.on("message", async msg => {
    const data = JSON.parse(msg);

    if (!state.rooms[data.room]) {
      state.rooms[data.room] = {
        coins: {},
        deckId: null,
        player: [],
        dealer: [],
        gameOver: false
      };
    }

    const room = state.rooms[data.room];
    if (!room.coins[data.user]) room.coins[data.user] = 1000;

    if (data.type === "sync") {
      ws.send(JSON.stringify(room));
      return;
    }

    if (data.type === "new") {
      if (room.coins[data.user] < 100) return;

      room.coins[data.user] -= 100;
      room.player = [];
      room.dealer = [];
      room.gameOver = false;

      const deck = await fetch("https://deckofcardsapi.com/api/deck/new/shuffle/?deck_count=1").then(r => r.json());
      room.deckId = deck.deck_id;

      const draw = await fetch(`https://deckofcardsapi.com/api/deck/${room.deckId}/draw/?count=3`).then(r => r.json());
      room.player.push(draw.cards[0], draw.cards[1]);
      room.dealer.push(draw.cards[2]);
    }

    if (data.type === "hit" && !room.gameOver) {
      const draw = await fetch(`https://deckofcardsapi.com/api/deck/${room.deckId}/draw/?count=1`).then(r => r.json());
      room.player.push(draw.cards[0]);
      if (score(room.player) > 21) room.gameOver = true;
    }

    if (data.type === "stand" && !room.gameOver) {
      while (score(room.dealer) < 17) {
        const draw = await fetch(`https://deckofcardsapi.com/api/deck/${room.deckId}/draw/?count=1`).then(r => r.json());
        room.dealer.push(draw.cards[0]);
      }
      const p = score(room.player);
      const d = score(room.dealer);
      if (d > 21 || p > d) room.coins[data.user] += 200;
      else if (p === d) room.coins[data.user] += 100;
      room.gameOver = true;
    }

    save();
    wss.clients.forEach(c => {
      if (c.readyState === WebSocket.OPEN) c.send(JSON.stringify(room));
    });
  });
});

function score(hand) {
  let t = 0, a = 0;
  for (const c of hand) {
    if (c.value === "ACE") { t += 11; a++; }
    else if (["KING","QUEEN","JACK"].includes(c.value)) t += 10;
    else t += parseInt(c.value);
  }
  while (t > 21 && a--) t -= 10;
  return t;
}

server.listen(3000);
