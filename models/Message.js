const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true
    },

    message: {
      type: String,
      required: true,
      trim: true
    },

    room: {
      type: String,
      required: true,
      default: "general"
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Message", messageSchema);