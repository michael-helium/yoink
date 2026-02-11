const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.get("/", (_req, res) => res.send("Yoink server running"));

/** ---------- Config ---------- */
const ROUND_MS = 60000;
const BANK_LIMIT = 10; // playtesting
const SPAWN_TICK_MS = 600; // how often we check if we should spawn

/** ---------- Dictionary ---------- */
function loadDictionary() {
  const filePath = path.join(__dirname, "words.txt");
  let text = "";
  try {
    text = fs.readFileSync(filePath, "utf8");
  } catch (e) {
    console.warn("Could not read words.txt. All words will be rejected until added.");
    return new Set();
  }
  const set = new Set();
  text.split(/\r?\n/).forEach((line) => {
    const w = (line || "").trim().toUpperCase();
    if (w) set.add(w);
  });
  console.log(`Loaded dictionary words: ${set.size}`);
  return set;
}
const DICT = loadDictionary();

/** ---------- Scoring tiers ---------- */
const VALUE_10 = new Set(["A","D","E","G","I","L","N","O","R","S","T","U"]);
const VALUE_20 = new Set(["B","C","F","H","K","M","P","V","W","Y"]);
const VALUE_30 = new Set(["J","Q","X","Z"]);

function letterValue(letter) {
  const L = (letter || "").toUpperCase();
  if (VALUE_10.has(L)) return 10;
  if (VALUE_20.has(L)) return 20;
  if (VALUE_30.has(L)) return 30;
  return 0;
}

function scoreWord(word) {
  const letters = word.split("");
  const base = letters.reduce((sum, l) => sum + letterValue(l), 0);
  const lengthBonus = 1 + (0.2 * letters.length);
  return Math.round(base * lengthBonus);
}

/** ---------- Letter bag ---------- */
const LETTER_BAG = [
  ..."AAAAAAA", ..."EEEEEEEE", ..."IIIIIII", ..."OOOOOO",
  ..."NNNNN", ..."RRRRR", ..."TTTTT", ..."SSSS", ..."LLL",
  ..."DDDD", ..."GGG", ..."UUU",
  ..."BB", ..."CC", ..."FF", ..."HH", ..."KK", ..."MM", ..."PP", ..."VV", ..."WW", ..."YY",
  ..."J", ..."Q", ..."X", ..."Z"
];

function randFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function makeId() {
  return Math.random().toString(36).slice(2, 10);
}
function makeCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}
function makeTile() {
  const letter = randFrom(LETTER_BAG);
  return { id: makeId(), letter, value: letterValue(letter) };
}

/** Pool is ALWAYS 16 slots. Empty slots are null. */
function createPool16FixedSlots() {
  const pool = new Array(16).fill(null);
  for (let i = 0; i < 16; i++) pool[i] = makeTile();
  return pool;
}

/** ---------- Rooms ---------- */
const rooms = {};

function emitRoom(code) {
  io.to(code).emit("roomUpdate", rooms[code]);
}

function poolCount(room) {
  return (room.pool || []).filter(Boolean).length;
}

function maybeSpawn(room) {
  if (room.state !== "ROUND_ACTIVE") return;

  const count = poolCount(room);
  const fullness = count / 16; // 1.0 full, 0.0 empty

  // Spawn probability increases as pool empties:
  // full -> ~10% chance per tick
  // empty -> ~85% chance per tick
  const spawnChance = 0.10 + (0.75 * (1 - fullness));

  if (Math.random() > spawnChance) return;

  // Find an empty slot and fill it (keeps positions fixed)
  const emptyIndexes = [];
  for (let i = 0; i < 16; i++) if (!room.pool[i]) emptyIndexes.push(i);
  if (emptyIndexes.length === 0) return;

  const idx = emptyIndexes[Math.floor(Math.random() * emptyIndexes.length)];
  room.pool[idx] = makeTile();
}

function startSpawnLoop(room) {
  stopSpawnLoop(room);
  room.spawnInterval = setInterval(() => {
    // room could be deleted
    if (!rooms[room.code]) return;
    maybeSpawn(room);
    emitRoom(room.code);
  }, SPAWN_TICK_MS);
}

function stopSpawnLoop(room) {
  if (room.spawnInterval) clearInterval(room.spawnInterval);
  room.spawnInterval = null;
}

io.on("connection", (socket) => {
  socket.on("createRoom", ({ nickname }, callback) => {
    const code = makeCode();

    rooms[code] = {
      code,
      host: socket.id,
      state: "LOBBY",
      players: {},
      roundEndTime: null,
      pool: new Array(16).fill(null),
      spawnInterval: null
    };

    rooms[code].players[socket.id] = {
      nickname,
      score: 0,
      bank: []
    };

    socket.join(code);
    callback?.({ ok: true, code });
    emitRoom(code);
  });

  socket.on("joinRoom", ({ code, nickname }, callback) => {
    const room = rooms[code];
    if (!room) return callback?.({ ok: false, reason: "ROOM_NOT_FOUND" });

    room.players[socket.id] = { nickname, score: 0, bank: [] };
    socket.join(code);

    callback?.({ ok: true });
    emitRoom(code);
  });

  socket.on("startGame", ({ code }, callback) => {
    const room = rooms[code];
    if (!room) return callback?.({ ok: false, reason: "ROOM_NOT_FOUND" });
    if (room.host !== socket.id) return callback?.({ ok: false, reason: "NOT_HOST" });
    if (Object.keys(room.players).length < 2) return callback?.({ ok: false, reason: "NEED_2_PLAYERS" });

    room.state = "ROUND_ACTIVE";
    room.roundEndTime = Date.now() + ROUND_MS;
    room.pool = createPool16FixedSlots();

    Object.values(room.players).forEach((p) => (p.bank = []));

    startSpawnLoop(room);

    emitRoom(code);
    callback?.({ ok: true });

    setTimeout(() => {
      if (!rooms[code]) return;
      stopSpawnLoop(room);
      room.state = "LOBBY";
      room.roundEndTime = null;
      room.pool = new Array(16).fill(null);
      emitRoom(code);
    }, ROUND_MS);
  });

  socket.on("yoinkTile", ({ code, tileId }, callback) => {
    const room = rooms[code];
    if (!room) return callback?.({ ok: false, reason: "ROOM_NOT_FOUND" });
    if (room.state !== "ROUND_ACTIVE") return callback?.({ ok: false, reason: "NOT_IN_ROUND" });

    const player = room.players[socket.id];
    if (!player) return callback?.({ ok: false, reason: "NOT_IN_ROOM" });

    if (player.bank.length >= BANK_LIMIT) {
      return callback?.({ ok: false, reason: "BANK_FULL" });
    }

    const idx = room.pool.findIndex((t) => t && t.id === tileId);
    if (idx === -1) return callback?.({ ok: false, reason: "TILE_GONE" });

    const tile = room.pool[idx];
    room.pool[idx] = null; // keep position
    player.bank.push(tile);

    emitRoom(code);
    callback?.({ ok: true });
  });

  socket.on("submitWord", ({ code, tileIds }, callback) => {
    const room = rooms[code];
    if (!room) return callback?.({ ok: false, reason: "ROOM_NOT_FOUND" });
    if (room.state !== "ROUND_ACTIVE") return callback?.({ ok: false, reason: "NOT_IN_ROUND" });

    const player = room.players[socket.id];
    if (!player) return callback?.({ ok: false, reason: "NOT_IN_ROOM" });

    const ids = Array.isArray(tileIds) ? tileIds : [];
    if (ids.length < 2) return callback?.({ ok: false, reason: "TOO_SHORT" });

    const tiles = [];
    for (const id of ids) {
      const t = player.bank.find((x) => x.id === id);
      if (!t) return callback?.({ ok: false, reason: "INVALID_TILES" });
      tiles.push(t);
    }

    const word = tiles.map((t) => t.letter).join("").toUpperCase();

    if (!DICT.has(word)) return callback?.({ ok: false, reason: "NOT_A_WORD", word });

    const points = scoreWord(word);
    player.score += points;

    player.bank = player.bank.filter((t) => !ids.includes(t.id));

    emitRoom(code);
    callback?.({ ok: true, points, word });
  });

  socket.on("disconnect", () => {
    Object.values(rooms).forEach((room) => {
      if (!room.players[socket.id]) return;

      delete room.players[socket.id];

      if (room.host === socket.id) {
        room.host = Object.keys(room.players)[0] || null;
      }

      if (Object.keys(room.players).length === 0) {
        stopSpawnLoop(room);
        delete rooms[room.code];
        return;
      }

      emitRoom(room.code);
    });
  });
});

server.listen(3001, () => console.log("Server running on port 3001"));
