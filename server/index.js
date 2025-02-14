const express = require("express");
const http = require("http");
const cors = require("cors");
const socketIO = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 5000;

// Event names as constants
const EVENTS = {
  SOCKET_ID: "socketId",
  INITIATE_CALL: "initiateCall",
  INCOMING_CALL: "incomingCall",
  CHANGE_MEDIA_STATUS: "changeMediaStatus",
  MEDIA_STATUS_CHANGED: "mediaStatusChanged",
  SEND_MESSAGE: "sendMessage",
  RECEIVE_MESSAGE: "receiveMessage",
  ANSWER_CALL: "answerCall",
  CALL_ANSWERED: "callAnswered",
  TERMINATE_CALL: "terminateCall",
  CALL_TERMINATED: "callTerminated",
  DISCONNECT: "disconnect",
};

// Middleware
app.use(cors());

// Health Check Route
app.get("/", (req, res) => {
  res.send("Server is running");
});

// Socket.IO logic
io.on("connection", (socket) => {
  socket.emit(EVENTS.SOCKET_ID, socket.id);

  socket.on(EVENTS.INITIATE_CALL, ({ targetId, signalData, senderId, senderName }) => {
    console.log(`Initiating call from ${senderId} to ${targetId}`);
    io.to(targetId).emit(EVENTS.INCOMING_CALL, {
      signal: signalData,
      from: senderId,
      name: senderName,
    });
  });

  socket.on(EVENTS.CHANGE_MEDIA_STATUS, ({ mediaType, isActive }) => {
    console.log(`Media status changed: ${mediaType} is ${isActive ? "active" : "inactive"}`);
    socket.broadcast.emit(EVENTS.MEDIA_STATUS_CHANGED, { mediaType, isActive });
  });

  socket.on(EVENTS.SEND_MESSAGE, ({ targetId, message, senderName }) => {
    console.log(`Message from ${senderName} to ${targetId}: ${message}`);
    io.to(targetId).emit(EVENTS.RECEIVE_MESSAGE, { message, senderName });
  });

  socket.on(EVENTS.ANSWER_CALL, (data) => {
    console.log(`Call answered by ${socket.id}`);
    socket.broadcast.emit(EVENTS.MEDIA_STATUS_CHANGED, {
      mediaType: data.mediaType,
      isActive: data.mediaStatus,
    });
    io.to(data.to).emit(EVENTS.CALL_ANSWERED, data);
  });

  socket.on(EVENTS.TERMINATE_CALL, ({ targetId }) => {
    console.log(`Call terminated by ${socket.id}`);
    io.to(targetId).emit(EVENTS.CALL_TERMINATED);
  });

  socket.on(EVENTS.DISCONNECT, () => {
    console.log(`User disconnected: ${socket.id}`);
  });

  socket.on("error", (err) => {
    console.error(`Socket error on ${socket.id}:`, err);
  });
});

// Start the server
server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
