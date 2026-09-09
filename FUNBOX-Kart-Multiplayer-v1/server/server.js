const express = require("express");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;
const MAX_PLAYERS = 12;
const rooms = new Map();

// Serve the FUNBOX frontend
const clientPath = path.join(__dirname, "..", "client");
app.use(express.static(clientPath));

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    game: "FUNBOX Kart",
    multiplayer: true
  });
});

function getRoom(code) {
  if (!rooms.has(code)) {
    rooms.set(code, new Map());
  }
  return rooms.get(code);
}

io.on("connection", (socket) => {

  socket.on("joinRoom", ({ roomCode, name }) => {

    roomCode = String(roomCode || "")
      .trim()
      .toUpperCase()
      .slice(0, 8);

    name = String(name || "Player")
      .trim()
      .slice(0, 18) || "Player";

    if (!roomCode) {
      socket.emit("joinError", "Enter a room code.");
      return;
    }

    const room = getRoom(roomCode);

    if (room.size >= MAX_PLAYERS) {
      socket.emit("joinError", "Room is full (12 players).");
      return;
    }

    const colors = [
      "#ef4444",
      "#3b82f6",
      "#22c55e",
      "#f59e0b",
      "#ec4899",
      "#06b6d4",
      "#f97316",
      "#84cc16",
      "#a855f7",
      "#14b8a6",
      "#eab308",
      "#64748b"
    ];

    const usedColors = new Set(
      [...room.values()].map(player => player.color)
    );

    const color =
      colors.find(c => !usedColors.has(c)) ||
      colors[room.size % colors.length];

    socket.join(roomCode);

    socket.data.roomCode = roomCode;

    const player = {
      id: socket.id,
      name,
      color,
      x: 260,
      y: 360,
      angle: 0,
      speed: 0,
      lap: 1,
      checkpoint: 0,
      finished: false
    };

    room.set(socket.id, player);

    socket.emit("joined", {
      id: socket.id,
      roomCode,
      players: [...room.values()]
    });

    socket.to(roomCode).emit("playerJoined", player);
  });

  socket.on("state", data => {

    const roomCode = socket.data.roomCode;
    const room = rooms.get(roomCode);

    if (!room || !room.has(socket.id)) {
      return;
    }

    const player = room.get(socket.id);

    player.x = Number(data.x) || 0;
    player.y = Number(data.y) || 0;
    player.angle = Number(data.angle) || 0;
    player.speed = Number(data.speed) || 0;
    player.lap = Number(data.lap) || 1;
    player.checkpoint = Number(data.checkpoint) || 0;
    player.finished = Boolean(data.finished);

    socket.to(roomCode).emit("playerState", player);
  });

  socket.on("startRace", () => {

    const roomCode = socket.data.roomCode;

    if (roomCode) {
      io.to(roomCode).emit("raceStart");
    }
  });

  socket.on("disconnect", () => {

    const roomCode = socket.data.roomCode;
    const room = rooms.get(roomCode);

    if (!room) {
      return;
    }

    room.delete(socket.id);

    socket.to(roomCode).emit("playerLeft", socket.id);

    if (room.size === 0) {
      rooms.delete(roomCode);
    }
  });
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`FUNBOX Kart server running on port ${PORT}`);
});
