// ====================================
// IMPORTS
// ====================================

require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");

const authRoutes = require("./routes/auth");
const chatRoutes = require("./routes/chat");
const profileRoutes = require("./routes/profile");

const Message = require("./models/Message");
const User = require("./models/User");

// ====================================
// APP SETUP
// ====================================

const app = express();

const server = http.createServer(app);

const io = new Server(server);

// ====================================
// TRUST PROXY
// ====================================

app.set("trust proxy", 1);

// ====================================
// ENVIRONMENT CHECK
// ====================================

if (!process.env.MONGO_URI) {
  console.error("ERROR: MONGO_URI is missing in .env");
  process.exit(1);
}

if (!process.env.SESSION_SECRET) {
  console.error("ERROR: SESSION_SECRET is missing in .env");
  process.exit(1);
}

// ====================================
// BODY PARSER
// ====================================

app.use(
  express.urlencoded({
    extended: true,
  }),
);

app.use(express.json());

// ====================================
// STATIC FILES
// ====================================

app.use(express.static(path.join(__dirname, "public")));

// ====================================
// EJS
// ====================================

app.set("view engine", "ejs");

app.set("views", path.join(__dirname, "views"));

// ====================================
// SESSION
// ====================================

const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET,

  resave: false,

  saveUninitialized: false,

  cookie: {
    maxAge: 1000 * 60 * 60 * 24,

    httpOnly: true,

    sameSite: "lax",

    secure: process.env.NODE_ENV === "production",
  },
});

app.use(sessionMiddleware);

// ====================================
// MONGODB
// ====================================

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected successfully");
  })
  .catch((error) => {
    console.error("MongoDB connection error:", error);
  });

// ====================================
// ROUTES
// ====================================

app.use("/", authRoutes);

app.use("/", chatRoutes);

app.use("/", profileRoutes);

// ====================================
// HOME ROUTE
// ====================================

app.get("/", (req, res) => {
  if (req.session && req.session.user) {
    return res.redirect("/chat");
  }

  return res.redirect("/login");
});

// ====================================
// ROUTE TEST
// ====================================

app.get("/route-test", (req, res) => {
  res.send("ROUTES ARE WORKING");
});

// ====================================
// HEALTH CHECK
// ====================================

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "ChatWave server is running",
    mongodb:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});

// ====================================
// ONLINE USERS
// ====================================

const onlineUsers = {};

const connectedUsers = new Map();

// ====================================
// SOCKET.IO SESSION
// ====================================

io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

// ====================================
// SOCKET.IO CONNECTION
// ====================================

io.on("connection", (socket) => {
  console.log("New user connected:", socket.id);

  // ====================================
  // USER ONLINE
  // ====================================

  socket.on("userOnline", async ({ username }) => {
    if (!username) {
      return;
    }

    try {
      const cleanUsername = String(username).trim();

      if (!cleanUsername) {
        return;
      }

      socket.username = cleanUsername;

      connectedUsers.set(cleanUsername, socket.id);

      await User.findOneAndUpdate(
        {
          username: cleanUsername,
        },
        {
          $set: {
            isOnline: true,

            lastSeen: null,
          },
        },
      );

      io.emit("userStatus", {
        username: cleanUsername,

        isOnline: true,

        lastSeen: null,
      });

      io.emit("userOnline", {
        username: cleanUsername,

        isOnline: true,

        lastSeen: null,
      });

      const users = await User.find({})
        .select("_id username isOnline lastSeen unreadMessages")
        .lean();

      io.emit("usersUpdated", users);

      console.log(`${cleanUsername} is online`);
    } catch (error) {
      console.error("Online status error:", error);
    }
  });

  // ====================================
  // JOIN PUBLIC ROOM
  // ====================================

  socket.on("joinRoom", ({ username, room }) => {
    if (!username || !room) {
      return;
    }

    const cleanUsername = String(username).trim();

    const cleanRoom = String(room).trim();

    if (!cleanUsername || !cleanRoom) {
      return;
    }

    socket.join(cleanRoom);

    socket.username = cleanUsername;

    socket.room = cleanRoom;

    if (!onlineUsers[cleanRoom]) {
      onlineUsers[cleanRoom] = new Map();
    }

    onlineUsers[cleanRoom].set(socket.id, cleanUsername);

    socket.to(cleanRoom).emit("systemMessage", {
      message: `${cleanUsername} joined the room`,
    });

    io.to(cleanRoom).emit(
      "onlineUsers",
      Array.from(onlineUsers[cleanRoom].values()),
    );
  });

  // ====================================
  // PUBLIC CHAT MESSAGE
  // ====================================

  socket.on("chatMessage", async (data) => {
    try {
      const { username, message, room } = data || {};

      if (!username || !room || !message || !message.trim()) {
        return;
      }

      const cleanUsername = String(username).trim();

      const cleanMessage = String(message).trim();

      const cleanRoom = String(room).trim();

      const newMessage = new Message({
        username: cleanUsername,

        message: cleanMessage,

        room: cleanRoom,

        receiver: null,

        delivered: false,

        seen: false,

        seenAt: null,
      });

      await newMessage.save();

      io.to(cleanRoom).emit("message", {
        _id: newMessage._id,

        username: newMessage.username,

        message: newMessage.message,

        room: newMessage.room,

        createdAt: newMessage.createdAt,

        delivered: newMessage.delivered,

        seen: newMessage.seen,

        reactions: newMessage.reactions,

        edited: newMessage.edited,

        deleted: newMessage.deleted,
      });
    } catch (error) {
      console.error("Public message error:", error);
    }
  });

  // ====================================
  // PUBLIC TYPING
  // ====================================

  socket.on("typing", ({ username, room }) => {
    if (!room) {
      return;
    }

    socket.to(room).emit("typing", {
      username,
    });
  });

  // ====================================
  // STOP PUBLIC TYPING
  // ====================================

  socket.on("stopTyping", ({ room }) => {
    if (!room) {
      return;
    }

    socket.to(room).emit("stopTyping");
  });

  // ====================================
  // JOIN PRIVATE CHAT
  // ====================================

  socket.on("joinPrivateChat", async ({ username, receiver }) => {
    if (!username || !receiver) {
      return;
    }

    try {
      const cleanUsername = String(username).trim();

      const cleanReceiver = String(receiver).trim();

      if (!cleanUsername || !cleanReceiver || cleanUsername === cleanReceiver) {
        return;
      }

      const users = [cleanUsername, cleanReceiver].sort();

      const privateRoom = `private_${users[0]}_${users[1]}`;

      socket.join(privateRoom);

      socket.privateRoom = privateRoom;

      socket.privateUsername = cleanUsername;

      socket.privateReceiver = cleanReceiver;

      const target = await User.findOne({
        username: cleanReceiver,
      })
        .select("username isOnline lastSeen")
        .lean();

      socket.emit("targetUserStatus", {
        username: cleanReceiver,

        isOnline: Boolean(target?.isOnline),

        lastSeen: target?.lastSeen || null,
      });
    } catch (error) {
      console.error("Target user status error:", error);
    }
  });

  // ====================================
  // PRIVATE MESSAGE
  // ====================================

  socket.on("privateMessage", async (data) => {
    try {
      const { username, receiver, message } = data || {};

      if (!username || !receiver || !message || !message.trim()) {
        return;
      }

      const cleanUsername = String(username).trim();

      const cleanReceiver = String(receiver).trim();

      const cleanMessage = String(message).trim();

      if (cleanUsername === cleanReceiver) {
        return;
      }

      const newMessage = new Message({
        username: cleanUsername,

        message: cleanMessage,

        receiver: cleanReceiver,

        room: null,

        delivered: false,

        seen: false,

        seenAt: null,
      });

      await newMessage.save();

      const receiverSocket = connectedUsers.get(cleanReceiver);

      const receiverIsOnline = Boolean(receiverSocket);

      if (receiverIsOnline) {
        newMessage.delivered = true;

        await newMessage.save();
      }

      await User.findOneAndUpdate(
        {
          username: cleanReceiver,
        },
        {
          $inc: {
            unreadMessages: 1,
          },
        },
      );

      const users = [cleanUsername, cleanReceiver].sort();

      const privateRoom = `private_${users[0]}_${users[1]}`;

      const messageData = {
        _id: newMessage._id,

        username: newMessage.username,

        receiver: newMessage.receiver,

        message: newMessage.message,

        createdAt: newMessage.createdAt,

        delivered: newMessage.delivered,

        seen: newMessage.seen,

        seenAt: newMessage.seenAt,

        reactions: newMessage.reactions,

        edited: newMessage.edited,

        deleted: newMessage.deleted,
      };

      io.to(privateRoom).emit("privateMessage", messageData);

      if (receiverSocket && receiverSocket !== socket.id) {
        io.to(receiverSocket).emit("newMessageNotification", {
          messageId: newMessage._id,

          sender: cleanUsername,

          message: newMessage.message,

          createdAt: newMessage.createdAt,

          room: privateRoom,
        });
      }

      if (receiverSocket) {
        const receiverUser = await User.findOne({
          username: cleanReceiver,
        })
          .select("unreadMessages")
          .lean();

        io.to(receiverSocket).emit("unreadCount", {
          count: receiverUser ? receiverUser.unreadMessages : 0,

          sender: cleanUsername,
        });
      }
    } catch (error) {
      console.error("Private message error:", error);
    }
  });

  // ====================================
  // MARK CHAT AS READ
  // ====================================

  socket.on("markChatAsRead", async ({ username }) => {
    try {
      if (!username) {
        return;
      }

      const cleanUsername = String(username).trim();

      const currentUser = await User.findOneAndUpdate(
        {
          username: cleanUsername,
        },
        {
          $set: {
            unreadMessages: 0,
          },
        },
        {
          new: true,
        },
      ).select("unreadMessages");

      io.to(socket.id).emit("unreadCount", {
        count: currentUser ? currentUser.unreadMessages : 0,
      });
    } catch (error) {
      console.error("Mark chat as read error:", error);
    }
  });

  // ====================================
  // MESSAGE DELIVERED
  // ====================================

  socket.on("messageDelivered", async ({ messageId, username }) => {
    try {
      if (!messageId || !username) {
        return;
      }

      const message = await Message.findById(messageId);

      if (!message) {
        return;
      }

      if (message.receiver !== username) {
        return;
      }

      message.delivered = true;

      await message.save();

      const users = [message.username, message.receiver].sort();

      const privateRoom = `private_${users[0]}_${users[1]}`;

      io.to(privateRoom).emit("messageDelivered", {
        messageId: message._id,
      });
    } catch (error) {
      console.error("Delivery status error:", error);
    }
  });

  // ====================================
  // MESSAGE SEEN
  // ====================================

  socket.on("messageSeen", async ({ messageId, username }) => {
    try {
      if (!messageId || !username) {
        return;
      }

      const message = await Message.findById(messageId);

      if (!message) {
        return;
      }

      if (message.receiver !== username) {
        return;
      }

      message.delivered = true;

      message.seen = true;

      message.seenAt = new Date();

      await message.save();

      const users = [message.username, message.receiver].sort();

      const privateRoom = `private_${users[0]}_${users[1]}`;

      io.to(privateRoom).emit("messageSeen", {
        messageId: message._id,

        seenAt: message.seenAt,
      });
    } catch (error) {
      console.error("Seen status error:", error);
    }
  });

  // ====================================
  // EDIT MESSAGE
  // ====================================

  socket.on(
    "editMessage",
    async ({ messageId, username, message, newMessage }) => {
      try {
        const editedText = typeof message === "string" ? message : newMessage;

        if (
          !messageId ||
          !username ||
          typeof editedText !== "string" ||
          !editedText.trim()
        ) {
          return;
        }

        const existingMessage = await Message.findById(messageId);

        if (!existingMessage) {
          return;
        }

        if (existingMessage.username !== username) {
          return;
        }

        if (existingMessage.deleted) {
          return;
        }

        existingMessage.message = editedText.trim();

        existingMessage.edited = true;

        existingMessage.editedAt = new Date();

        await existingMessage.save();

        let targetRoom;

        if (existingMessage.room) {
          targetRoom = existingMessage.room;
        } else {
          const users = [
            existingMessage.username,
            existingMessage.receiver,
          ].sort();

          targetRoom = `private_${users[0]}_${users[1]}`;
        }

        io.to(targetRoom).emit("messageEdited", {
          messageId: existingMessage._id,

          message: existingMessage.message,

          edited: true,

          editedAt: existingMessage.editedAt,
        });
      } catch (error) {
        console.error("Edit message error:", error);
      }
    },
  );

  // ====================================
  // DELETE MESSAGE
  // ====================================

  socket.on("deleteMessage", async ({ messageId, username }) => {
    try {
      if (!messageId || !username) {
        return;
      }

      const message = await Message.findById(messageId);

      if (!message) {
        return;
      }

      if (message.username !== username) {
        return;
      }

      if (message.deleted) {
        return;
      }

      message.message = "This message was deleted";

      message.deleted = true;

      message.edited = false;

      message.editedAt = null;

      await message.save();

      let targetRoom;

      if (message.room) {
        targetRoom = message.room;
      } else {
        const users = [message.username, message.receiver].sort();

        targetRoom = `private_${users[0]}_${users[1]}`;
      }

      io.to(targetRoom).emit("messageDeleted", {
        messageId: message._id,

        message: "This message was deleted",

        deleted: true,
      });
    } catch (error) {
      console.error("Delete message error:", error);
    }
  });

  // ====================================
  // PRIVATE TYPING
  // ====================================

  socket.on("privateTyping", ({ username, receiver }) => {
    if (!username || !receiver) {
      return;
    }

    const users = [username, receiver].sort();

    const privateRoom = `private_${users[0]}_${users[1]}`;

    socket.to(privateRoom).emit("privateTyping", {
      username,
    });
  });

  // ====================================
  // STOP PRIVATE TYPING
  // ====================================

  socket.on("stopPrivateTyping", ({ username, receiver }) => {
    if (!username || !receiver) {
      return;
    }

    const users = [username, receiver].sort();

    const privateRoom = `private_${users[0]}_${users[1]}`;

    socket.to(privateRoom).emit("stopPrivateTyping");
  });

  // ====================================
  // ADD REACTION
  // ====================================

  socket.on("addReaction", async ({ messageId, username, emoji }) => {
    try {
      if (!messageId || !username || !emoji) {
        return;
      }

      const allowedReactions = ["❤️", "👍", "😂", "😮", "😢", "🔥"];

      if (!allowedReactions.includes(emoji)) {
        return;
      }

      const message = await Message.findById(messageId);

      if (!message) {
        return;
      }

      message.reactions = message.reactions.filter(
        (reaction) => reaction.username !== username,
      );

      message.reactions.push({
        username,
        emoji,
      });

      await message.save();

      let targetRoom;

      if (message.room) {
        targetRoom = message.room;
      } else {
        const users = [message.username, message.receiver].sort();

        targetRoom = `private_${users[0]}_${users[1]}`;
      }

      io.to(targetRoom).emit("reactionUpdated", {
        messageId: message._id,

        reactions: message.reactions,
      });
    } catch (error) {
      console.error("Reaction error:", error);
    }
  });

  // ====================================
  // REMOVE REACTION
  // ====================================

  socket.on("removeReaction", async ({ messageId, username }) => {
    try {
      if (!messageId || !username) {
        return;
      }

      const message = await Message.findById(messageId);

      if (!message) {
        return;
      }

      message.reactions = message.reactions.filter(
        (reaction) => reaction.username !== username,
      );

      await message.save();

      let targetRoom;

      if (message.room) {
        targetRoom = message.room;
      } else {
        const users = [message.username, message.receiver].sort();

        targetRoom = `private_${users[0]}_${users[1]}`;
      }

      io.to(targetRoom).emit("reactionUpdated", {
        messageId: message._id,

        reactions: message.reactions,
      });
    } catch (error) {
      console.error("Remove reaction error:", error);
    }
  });

  // ====================================
  // DISCONNECT
  // ====================================

  socket.on("disconnect", async () => {
    console.log("User disconnected:", socket.id);

    const username = socket.username;

    const room = socket.room;

    // ====================================
    // REMOVE CONNECTED USER
    // ====================================

    if (username) {
      const currentSocketId = connectedUsers.get(username);

      if (currentSocketId === socket.id) {
        connectedUsers.delete(username);
      }
    }

    // ====================================
    // REMOVE FROM ROOM
    // ====================================

    if (room && onlineUsers[room]) {
      onlineUsers[room].delete(socket.id);

      if (username) {
        socket.to(room).emit("systemMessage", {
          message: `${username} left the room`,
        });
      }

      io.to(room).emit("onlineUsers", Array.from(onlineUsers[room].values()));
    }

    // ====================================
    // OFFLINE STATUS
    // ====================================

    if (username) {
      try {
        const currentSocketId = connectedUsers.get(username);

        if (currentSocketId === socket.id || !currentSocketId) {
          const lastSeen = new Date();

          await User.findOneAndUpdate(
            {
              username,
            },
            {
              $set: {
                isOnline: false,

                lastSeen,
              },
            },
          );

          io.emit("userStatus", {
            username,

            isOnline: false,

            lastSeen,
          });

          io.emit("userOffline", {
            username,

            isOnline: false,

            lastSeen,
          });

          const users = await User.find({})
            .select("_id username isOnline lastSeen unreadMessages")
            .lean();

          io.emit("usersUpdated", users);
        }
      } catch (error) {
        console.error("Offline status error:", error);
      }
    }

    socket.privateRoom = null;

    socket.privateUsername = null;

    socket.privateReceiver = null;
  });
});

// ====================================
// VERCEL / LOCAL SERVER EXPORT
// ====================================

module.exports = server;

// ====================================
// LOCAL DEVELOPMENT SERVER
// ====================================

if (require.main === module) {
  const PORT = process.env.PORT || 3000;

  server.listen(PORT, "0.0.0.0", () => {
    console.log(
      `Server running on http://localhost:${PORT}`
    );
  });
}