require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");

const authRoutes = require("./routes/auth");
const chatRoutes = require("./routes/chat");

const Message = require("./models/Message");

const app = express();

const server = http.createServer(app);

const io = new Server(server);

// ===============================
// DATABASE CONNECTION
// ===============================

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected successfully");
  })
  .catch((error) => {
    console.error("MongoDB connection error:", error);
  });

// ===============================
// MIDDLEWARE
// ===============================

app.use(express.urlencoded({ extended: true }));

app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));

// ===============================
// EJS
// ===============================

app.set("view engine", "ejs");

app.set("views", path.join(__dirname, "views"));

// ===============================
// SESSION
// ===============================

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,

    cookie: {
      maxAge: 1000 * 60 * 60 * 24
    }
  })
);

// ===============================
// ROUTES
// ===============================

app.use("/", authRoutes);

app.use("/", chatRoutes);

// ===============================
// HOME
// ===============================

app.get("/", (req, res) => {
  if (req.session.user) {
    return res.redirect("/chat");
  }

  res.redirect("/login");
});

// ===============================
// ONLINE USERS
// ===============================

const onlineUsers = {};

// ===============================
// SOCKET.IO
// ===============================

io.on("connection", (socket) => {

  console.log("New user connected:", socket.id);

  // JOIN ROOM
  socket.on("joinRoom", ({ username, room }) => {

    socket.join(room);

    socket.username = username;
    socket.room = room;

    if (!onlineUsers[room]) {
      onlineUsers[room] = new Map();
    }

    onlineUsers[room].set(socket.id, username);

    socket.to(room).emit("systemMessage", {
      message: `${username} joined the room`
    });

    io.to(room).emit(
      "onlineUsers",
      Array.from(onlineUsers[room].values())
    );
  });

  // CHAT MESSAGE
  socket.on("chatMessage", async (data) => {

    try {

      const { username, message, room } = data;

      if (!message || !message.trim()) {
        return;
      }

      const newMessage = new Message({
        username,
        message: message.trim(),
        room
      });

      await newMessage.save();

      io.to(room).emit("message", {
        username: newMessage.username,
        message: newMessage.message,
        room: newMessage.room,
        createdAt: newMessage.createdAt
      });

    } catch (error) {

      console.error("Message error:", error);

    }
  });

  // TYPING
  socket.on("typing", ({ username, room }) => {

    socket.to(room).emit("typing", {
      username
    });

  });

  socket.on("stopTyping", ({ room }) => {

    socket.to(room).emit("stopTyping");

  });

  // DISCONNECT
  socket.on("disconnect", () => {

    console.log("User disconnected:", socket.id);

    const username = socket.username;
    const room = socket.room;

    if (room && onlineUsers[room]) {

      onlineUsers[room].delete(socket.id);

      if (username) {

        socket.to(room).emit("systemMessage", {
          message: `${username} left the room`
        });

      }

      io.to(room).emit(
        "onlineUsers",
        Array.from(onlineUsers[room].values())
      );
    }
  });
});

// ===============================
// SERVER
// ===============================

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {

  console.log(
    `Server running on http://localhost:${PORT}`
  );

});