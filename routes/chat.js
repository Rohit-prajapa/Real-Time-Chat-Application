const express = require("express");

const Message = require("../models/Message");
const isAuthenticated = require("../middleware/auth");

const router = express.Router();

router.get("/chat", isAuthenticated, async (req, res) => {
  try {
    const room = req.query.room || "general";

    const messages = await Message.find({
      room: room
    })
      .sort({ createdAt: 1 })
      .limit(100);

    res.render("chat", {
      user: req.session.user,
      messages,
      room
    });

  } catch (error) {
    console.error(error);

    res.status(500).send("Unable to load chat.");
  }
});

module.exports = router;