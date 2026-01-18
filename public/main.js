const CLIENT_ID = "1178468570141839381";

let user = { id: "local", username: "Local" };
let room = "default";

try {
  const sdk = new window.DiscordSDK.DiscordSDK(CLIENT_ID);
  await sdk.ready();
  const res = await sdk.commands.getUser();
  user.id = res.user.id;
  user.username = res.user.username;
  room = sdk.instanceId;
} catch {}

document.getElementById("user").innerText = user.username;

const ws = new WebSocket(
  (location.protocol === "https:" ? "wss://" : "ws://") + location.host
);

ws.onopen = () => {
  ws.send(JSON.stringify({ type: "sync", room, user: user.id }));
};

ws.onmessage = e => {
  const s = JSON.parse(e.data);
  renderCards("player-cards", s.player);
  renderCards("dealer-cards", s.dealer);
  document.getElementById("player-score").innerText = score(s.player);
  document.getElementById("dealer-score").innerText = score(s.dealer);
  document.getElementById("coins").innerText = "💰 " + s.coins[user.id];
};

function send(type) {
  ws.send(JSON.stringify({ type, room, user: user.id }));
}

function renderCards(id, cards) {
  const el = document.getElementById(id);
  el.innerHTML = "";
  cards.forEach(c => {
    const img = document.createElement("img");
    img.src = c.image;
    img.className = "card";
    el.appendChild(img);
  });
}

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

document.getElementById("new").onclick = () => send("new");
document.getElementById("hit").onclick = () => send("hit");
document.getElementById("stand").onclick = () => send("stand");
