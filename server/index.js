const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

app.get("/", (_req, res) => {
  res.send("Yoink server running");
});

const rooms = {};

// --- Letter scoring tiers (per spec) ---
const VALUE_10 = new Set(["A","D","E","G","I","L","N","O","R","S","T","U"]);
const VALUE_20 = new Set(["B","C","F","H","K","M","P","V","W","Y"]);
const VALUE_30 = new Set(["J","Q","X","Z"]);

function letterValue(letter) {
  if (VALUE_10.has(letter)) return 10;
  if (VALUE_20.has(letter)) return 20;
  return 30;
}

// Simple weighted-ish letter bag (can refine later)
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

function createPool16() {
  const tiles = [];
  for (let i = 0; i < 16; i++) {
    const letter = randFrom(LETTER_BAG);
    tiles.push({
      id: makeId(),
      letter,
      value: letterValue(letter)
    });
  }
  return tiles;
}

function emitRoom(code) {
  io.to(code).emit("roomUpdate", rooms[code]);
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
      pool: [] // 4x4 grid as flat array length 0..16
    };

    rooms[code].players[socket.id] = {
      nickname,
      score: 0,
      bank: [] // later max 7
    };

    socket.join(code);
    callback({ ok: true, code });
    emitRoom(code);
  });

  socket.on("joinRoom", ({ code, nickname }, callback) => {
    const room = rooms[code];
    if (!room) return callback({ ok: false });

    room.players[socket.id] = { nickname, score: 0, bank: [] };
    socket.join(code);

    callback({ ok: true });
    emitRoom(code);
  });

  socket.on("startGame", ({ code }) => {
    const room = rooms[code];
    if (!room) return;
    if (room.host !== socket.id) return;
    if (Object.keys(room.players).length < 2) return;

    // Start round
    room.state = "ROUND_ACTIVE";
    room.roundEndTime = Date.now() + 60000;
    room.pool = createPool16();

    emitRoom(code);

    setTimeout(() => {
      if (!rooms[code]) return;
      room.state = "LOBBY";
      room.roundEndTime = null;
      room.pool = [];
      emitRoom(code);
    }, 60000);
  });

  // --- NEW: Yoink a tile from pool ---
  socket.on("yoinkTile", ({ code, tileId }, callback) => {
    try {
      const room = rooms[code];
      if (!room) return callback?.({ ok: false, reason: "ROOM_NOT_FOUND" });
      if (room.state !== "ROUND_ACTIVE") return callback?.({ ok: false, reason: "NOT_IN_ROUND" });

      const player = room.players[socket.id];
      if (!player) return callback?.({ ok: false, reason: "NOT_IN_ROOM" });

      const idx = room.pool.findIndex((t) => t.id === tileId);
      if (idx === -1) return callback?.({ ok: false, reason: "TILE_GONE" });

      // bank limit 7 (per spec)
      if (player.bank.length >= 7) return callback?.({ ok: false, reason: "BANK_FULL" });

      const [tile] = room.pool.splice(idx, 1);
      player.bank.push(tile);

      emitRoom(code);
      callback?.({ ok: true });
    } catch (e) {
      callback?.({ ok: false, reason: "ERROR" });
    }
  });

  socket.on("disconnect", () => {
    Object.values(rooms).forEach((room) => {
      if (room.players[socket.id]) {
        delete room.players[socket.id];

        if (room.host === socket.id) {
          room.host = Object.keys(room.players)[0] || null;
        }

        // If room empty, delete
        if (Object.keys(room.players).length === 0) {
          delete rooms[room.code];
          return;
        }

        emitRoom(room.code);
      }
    });
  });
});

server.listen(3001, () => {
  console.log("Server running on port 3001");
});
