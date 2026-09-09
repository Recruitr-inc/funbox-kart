const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const rooms = new Map();
const MAX_PLAYERS = 12;

app.get("/", (_req, res) => res.send("FUNBOX Kart multiplayer server is running."));

function getRoom(code) {
  if (!rooms.has(code)) rooms.set(code, new Map());
  return rooms.get(code);
}

io.on("connection", socket => {
  socket.on("joinRoom", ({ roomCode, name }) => {
    roomCode = String(roomCode || "").trim().toUpperCase().slice(0, 8);
    name = String(name || "Player").trim().slice(0, 18) || "Player";
    if (!roomCode) return socket.emit("joinError", "Enter a room code.");
    const room = getRoom(roomCode);
    if (room.size >= MAX_PLAYERS) return socket.emit("joinError", "Room is full (12 players).");

    const colors = ["#ef4444","#3b82f6","#22c55e","#f59e0b","#ec4899","#06b6d4",
                    "#f97316","#84cc16","#a855f7","#14b8a6","#eab308","#64748b"];
    const used = new Set([...room.values()].map(p => p.color));
    const color = colors.find(c => !used.has(c)) || colors[room.size % colors.length];

    socket.join(roomCode);
    socket.data.roomCode = roomCode;
    const player = {
      id: socket.id, name, color, x: 0, y: 0, angle: 0,
      speed: 0, lap: 1, checkpoint: 0, finished: false
    };
    room.set(socket.id, player);
    socket.emit("joined", { id: socket.id, roomCode, players: [...room.values()] });
    socket.to(roomCode).emit("playerJoined", player);
  });

  socket.on("state", data => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room || !room.has(socket.id)) return;
    const p = room.get(socket.id);
    Object.assign(p, {
      x: Number(data.x)||0, y: Number(data.y)||0, angle: Number(data.angle)||0,
      speed: Number(data.speed)||0, lap: Number(data.lap)||1,
      checkpoint: Number(data.checkpoint)||0, finished: !!data.finished
    });
    socket.to(code).emit("playerState", p);
  });

  socket.on("startRace", () => {
    const code = socket.data.roomCode;
    if (code) io.to(code).emit("raceStart");
  });

  socket.on("disconnect", () => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room) return;
    room.delete(socket.id);
    socket.to(code).emit("playerLeft", socket.id);
    if (!room.size) rooms.delete(code);
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`FUNBOX server listening on ${PORT}`));
