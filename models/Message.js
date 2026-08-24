const mongoose = require("mongoose");

// ====================================
// REPLY-TO SUB-SCHEMA
// (separate schema + default: null so an un-set replyTo is actually
// `null`, not an object with empty/null fields)
// ====================================

const replyToSchema = new mongoose.Schema(
    {
        messageId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Message"
        },
        text: {
            type: String,
            default: ""
        }
    },
    { _id: false }
);

// ====================================
// MESSAGE SCHEMA
// ====================================

const messageSchema = new mongoose.Schema(
    {
        // SENDER
        username: {
            type: String,
            required: true,
            trim: true
        },

        // MESSAGE TEXT
        message: {
            type: String,
            required: true,
            trim: true,
            maxlength: 5000
        },

        // PUBLIC ROOM
        room: {
            type: String,
            default: null,
            trim: true
        },

        // PRIVATE MESSAGE RECEIVER
        receiver: {
            type: String,
            default: null,
            trim: true
        },

        // DELIVERY / READ STATUS
        delivered: {
            type: Boolean,
            default: false
        },
        seen: {
            type: Boolean,
            default: false
        },
        seenAt: {
            type: Date,
            default: null
        },

        // EDIT STATUS
        edited: {
            type: Boolean,
            default: false
        },
        editedAt: {
            type: Date,
            default: null
        },

        // DELETE STATUS
        deleted: {
            type: Boolean,
            default: false
        },

        // REACTIONS
        reactions: [
            {
                username: {
                    type: String,
                    required: true
                },
                emoji: {
                    type: String,
                    required: true
                }
            }
        ],

        // REPLY TO MESSAGE
        replyTo: {
            type: replyToSchema,
            default: null
        }
    },
    {
        timestamps: true
    }
);

// ====================================
// INDEXES (for the query patterns used in routes/chat.js and server.js)
// ====================================

messageSchema.index({ room: 1, createdAt: 1 });
messageSchema.index({ username: 1, receiver: 1, createdAt: 1 });

// ====================================
// EXPORT
// ====================================

module.exports = mongoose.model("Message", messageSchema);