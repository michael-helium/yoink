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

function makeCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

io.on("connection", (socket) => {
  socket.on("createRoom", ({ nickname }, callback) => {
    const code = makeCode();

    rooms[code] = {
      code,
      host: socket.id,
      state: "LOBBY",
      players: {}
    };

    rooms[code].players[socket.id] = {
      nickname,
      score: 0
    };

    socket.join(code);

    callback({ ok: true, code });

    io.to(code).emit("roomUpdate", rooms[code]);
  });

  socket.on("joinRoom", ({ code, nickname }, callback) => {
    const room = rooms[code];

    if (!room) {
      callback({ ok: false });
      return;
    }

    room.players[socket.id] = {
      nickname,
      score: 0
    };

    socket.join(code);

    callback({ ok: true });
    io.to(code).emit("roomUpdate", room);
  });

  socket.on("disconnect", () => {
    Object.values(rooms).forEach((room) => {
      if (room.players[socket.id]) {
        delete room.players[socket.id];

        if (room.host === socket.id) {
          room.host = Object.keys(room.players)[0] || null;
        }

        io.to(room.code).emit("roomUpdate", room);
      }
    });
  });
});

server.listen(3001, () => {
  console.log("Server running on port 3001");
});
