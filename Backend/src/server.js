require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL || "*",
  methods: ["GET", "POST"]
}));
app.use(express.json());

app.get("/", (req, res) => {
  res.send("WebRTC Signaling Server Running 🚀");
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "*",
    methods: ["GET", "POST"]
  },
  transports: ["websocket", "polling"]
});

// Track active call pairs: socketId -> partnerSocketId
const activeCalls = new Map();

io.on("connection", (socket) => {
  console.log(`🔌 Connected: ${socket.id}`);
  socket.emit("me", socket.id);

  socket.on("callUser", ({ userToCall, signalData, from, name }) => {
    activeCalls.set(from, userToCall);
    activeCalls.set(userToCall, from);

    io.to(userToCall).emit("callUser", {
      signal: signalData,
      from,
      name
    });
  });

  socket.on("answerCall", ({ signal, to }) => {
    io.to(to).emit("callAccepted", signal);
  });

  socket.on("endCall", ({ to }) => {
    activeCalls.delete(socket.id);
    activeCalls.delete(to);
    io.to(to).emit("callEnded");
  });

  socket.on("disconnect", (reason) => {
    console.log(`❌ Disconnected: ${socket.id} (${reason})`);

    const partner = activeCalls.get(socket.id);
    if (partner) {
      io.to(partner).emit("callEnded");
      activeCalls.delete(partner);
      activeCalls.delete(socket.id);
    }
  });
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err);
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () =>
  console.log(`🚀 Signaling server running on port ${PORT}`)
);