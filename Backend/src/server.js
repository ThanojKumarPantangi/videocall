require("dotenv").config()

const express = require("express")
const http = require("http")
const cors = require("cors")
const { Server } = require("socket.io")

const app = express()

// ✅ Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || "*",
  methods: ["GET", "POST"]
}))
app.use(express.json())

// ✅ Health check route
app.get("/", (req, res) => {
  res.send("WebRTC Signaling Server Running 🚀")
})

const server = http.createServer(app)

// ✅ Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "*",
    methods: ["GET", "POST"]
  },
  transports: ["websocket", "polling"]
})

// ✅ Connection handler
io.on("connection", (socket) => {
  console.log(`🔌 Connected: ${socket.id}`)

  // send ID to client
  socket.emit("me", socket.id)

  // call user
  socket.on("callUser", ({ userToCall, signalData, from, name }) => {
    io.to(userToCall).emit("callUser", {
      signal: signalData,
      from,
      name
    })
  })

  // answer call
  socket.on("answerCall", ({ signal, to }) => {
    io.to(to).emit("callAccepted", signal)
  })

  // call ended (optional event)
  socket.on("endCall", ({ to }) => {
    io.to(to).emit("callEnded")
  })

  // disconnect
  socket.on("disconnect", (reason) => {
    console.log(`❌ Disconnected: ${socket.id} (${reason})`)
    socket.broadcast.emit("callEnded")
  })
})

// ✅ Global error handling (optional safety)
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err)
})

process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err)
})

// ✅ Start server
const PORT = process.env.PORT
server.listen(PORT, () =>
  console.log(`🚀 Signaling server running on port ${PORT}`)
)