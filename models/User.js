const mongoose = require("mongoose");

// ====================================
// USER SCHEMA
// ====================================

const userSchema = new mongoose.Schema(
  {
    // USERNAME
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },

    // EMAIL
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    // BIO
    bio: {
      type: String,
      trim: true,
      maxlength: 160,
      default: "",
    },

    // PASSWORD
    // select: false -> excluded from query results by default, so any
    // future route/query that forgets to add a projection won't
    // accidentally leak the password hash. Use `.select("+password")`
    // wherever you actually need it (e.g. in login).
    password: {
      type: String,
      required: true,
      select: false,
    },

    // ONLINE STATUS
    isOnline: {
      type: Boolean,
      default: false,
    },

    // LAST SEEN
    lastSeen: {
      type: Date,
      default: null,
    },

    // UNREAD PRIVATE MESSAGES
    unreadMessages: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("User", userSchema);