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

console.log(
  "AUTH ROUTES:",

  authRoutes.stack.map((route) => route.route && route.route.path),
);

const Message = require("./models/Message");

const User = require("./models/User");

// ====================================

// APP SETUP

// ====================================

const app = express();

const server = http.createServer(app);

const io = new Server(server);

console.log(
  "AUTH ROUTES:",

  authRoutes.stack.map((route) => route.route && route.route.path),
);

console.log(
  "PROFILE ROUTES:",

  profileRoutes.stack.map((route) => route.route && route.route.path),
);

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

app.use(
  session({
    secret: process.env.SESSION_SECRET,

    resave: false,

    saveUninitialized: false,

    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
    },
  }),
);

// ====================================

// ROUTES

// ====================================

app.get("/route-test", (req, res) => {
  res.send("ROUTES ARE WORKING");
});

// ====================================

// HOME ROUTE

// ====================================

app.get("/", (req, res) => {
  if (req.session.user) {
    return res.redirect("/chat");
  }

  return res.redirect("/login");
});

app.use("/", authRoutes);

app.use("/", chatRoutes);

app.use("/", profileRoutes);

// ====================================

// HTTP EDIT MESSAGE API

// ====================================

app.put("/api/messages/:messageId", async (req, res) => {
  try {
    const { messageId } = req.params;

    const { message } = req.body;

    if (!req.session.user) {
      return res.status(401).json({
        error: "You must be logged in.",
      });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({
        error: "Message cannot be empty.",
      });
    }

    const username = req.session.user.username;

    const existingMessage = await Message.findById(messageId);

    if (!existingMessage) {
      return res.status(404).json({
        error: "Message not found.",
      });
    }

    if (existingMessage.username !== username) {
      return res.status(403).json({
        error: "You can only edit your own messages.",
      });
    }

    if (existingMessage.deleted) {
      return res.status(400).json({
        error: "Deleted messages cannot be edited.",
      });
    }

    existingMessage.message = message.trim();

    existingMessage.edited = true;

    existingMessage.editedAt = new Date();

    await existingMessage.save();

    let targetRoom;

    if (existingMessage.room) {
      targetRoom = existingMessage.room;
    } else {
      const users = [existingMessage.username, existingMessage.receiver].sort();

      targetRoom = `private_${users[0]}_${users[1]}`;
    }

    io.to(targetRoom).emit("messageEdited", {
      messageId: existingMessage._id,

      message: existingMessage.message,

      edited: true,

      editedAt: existingMessage.editedAt,
    });

    return res.json({
      success: true,

      message: existingMessage.message,

      edited: true,

      editedAt: existingMessage.editedAt,
    });
  } catch (error) {
    console.error("HTTP edit message error:", error);

    return res.status(500).json({
      error: "Unable to edit message.",
    });
  }
});

// ====================================

// HTTP DELETE MESSAGE API

// ====================================

app.delete("/api/messages/:messageId", async (req, res) => {
  try {
    const { messageId } = req.params;

    if (!req.session.user) {
      return res.status(401).json({
        error: "You must be logged in.",
      });
    }

    const username = req.session.user.username;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        error: "Message not found.",
      });
    }

    if (message.username !== username) {
      return res.status(403).json({
        error: "You can only delete your own messages.",
      });
    }

    if (message.deleted) {
      return res.status(400).json({
        error: "Message is already deleted.",
      });
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

    return res.json({
      success: true,

      message: "This message was deleted",

      deleted: true,
    });
  } catch (error) {
    console.error("HTTP delete message error:", error);

    return res.status(500).json({
      error: "Unable to delete message.",
    });
  }
});

// ====================================

// ONLINE USERS

// ====================================

const onlineUsers = {};

const connectedUsers = new Map();

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
      socket.username = username;

      connectedUsers.set(username, socket.id);

      await User.findOneAndUpdate(
        {
          username,
        },

        {
          $set: {
            isOnline: true,

            lastSeen: null,
          },
        },
      );

      io.emit("userStatus", {
        username,

        isOnline: true,

        lastSeen: null,
      });

      io.emit("userOnline", {
        username,

        isOnline: true,

        lastSeen: null,
      });

      io.emit(
        "usersUpdated",

        await User.find({})

          .select("_id username isOnline lastSeen unreadMessages")

          .lean(),
      );

      console.log(`${username} is online`);
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

    socket.join(room);

    socket.username = username;

    socket.room = room;

    if (!onlineUsers[room]) {
      onlineUsers[room] = new Map();
    }

    onlineUsers[room].set(socket.id, username);

    socket.to(room).emit("systemMessage", {
      message: `${username} joined the room`,
    });

    io.to(room).emit(
      "onlineUsers",

      Array.from(onlineUsers[room].values()),
    );
  });

  // ====================================

  // PUBLIC CHAT MESSAGE

  // ====================================

  socket.on("chatMessage", async (data) => {
    try {
      const { username, message, room, replyTo } = data;

      if (!username || !room || !message || !message.trim()) {
        return;
      }

      const newMessage = new Message({
        username,

        message: message.trim(),

        room,

        receiver: null,

        delivered: false,

        seen: false,

        seenAt: null,

        deleted: false,

        replyTo:
          replyTo && replyTo.messageId
            ? {
                messageId: replyTo.messageId,

                text: replyTo.text || "",
              }
            : null,
      });

      await newMessage.save();

      io.to(room).emit("message", {
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

        replyTo: newMessage.replyTo || null,
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

    const users = [username, receiver].sort();

    const privateRoom = `private_${users[0]}_${users[1]}`;

    socket.join(privateRoom);

    socket.privateRoom = privateRoom;

    socket.privateUsername = username;

    socket.privateReceiver = receiver;

    try {
      const target = await User.findOne({
        username: receiver,
      })

        .select("username isOnline lastSeen")

        .lean();

      socket.emit("targetUserStatus", {
        username: receiver,

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
      const {
        username,

        receiver,

        message,

        replyTo,
      } = data;

      if (!username || !receiver || !message || !message.trim()) {
        return;
      }

      const newMessage = new Message({
        username,

        message: message.trim(),

        receiver,

        room: null,

        delivered: false,

        seen: false,

        seenAt: null,

        replyTo:
          replyTo && replyTo.messageId
            ? {
                messageId: replyTo.messageId,

                text: replyTo.text || "",
              }
            : null,
      });

      await newMessage.save();

      const receiverSocket = connectedUsers.get(receiver);

      const receiverIsOnline = Boolean(receiverSocket);

      if (receiverIsOnline) {
        newMessage.delivered = true;

        await newMessage.save();
      }

      await User.findOneAndUpdate(
        {
          username: receiver,
        },

        {
          $inc: {
            unreadMessages: 1,
          },
        },
      );

      const users = [username, receiver].sort();

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

        replyTo: newMessage.replyTo || null,
      };

      io.to(privateRoom).emit("privateMessage", messageData);

      if (receiverSocket && receiverSocket !== socket.id) {
        io.to(receiverSocket).emit("newMessageNotification", {
          messageId: newMessage._id,

          sender: username,

          message: newMessage.message,

          createdAt: newMessage.createdAt,

          room: privateRoom,
        });
      }

      if (receiverSocket) {
        const receiverUser = await User.findOne({
          username: receiver,
        }).select("unreadMessages");

        io.to(receiverSocket).emit("unreadCount", {
          count: receiverUser ? receiverUser.unreadMessages : 0,

          sender: username,
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

      const currentUser = await User.findOneAndUpdate(
        {
          username,
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
          console.log("Invalid edit request:", {
            messageId,

            username,

            message,

            newMessage,
          });

          return;
        }

        const existingMessage = await Message.findById(messageId);

        if (!existingMessage) {
          console.log("Edit failed: message not found");

          return;
        }

        if (existingMessage.username !== username) {
          console.log("Edit failed: unauthorized user");

          return;
        }

        if (existingMessage.deleted) {
          console.log("Edit failed: message already deleted");

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

        console.log(
          `Message edited by ${username}: ${existingMessage.message}`,
        );
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

      io.to(room).emit(
        "onlineUsers",

        Array.from(onlineUsers[room].values()),
      );
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

          io.emit(
            "usersUpdated",

            await User.find({})

              .select("_id username isOnline lastSeen unreadMessages")

              .lean(),
          );
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

// START SERVER

// ====================================

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
