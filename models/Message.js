const mongoose = require("mongoose");

// ====================================
// MESSAGE SCHEMA
// ====================================

const messageSchema = new mongoose.Schema(
    {

        // ====================================
        // SENDER
        // ====================================

        username: {
            type: String,
            required: true,
            trim: true
        },


        // ====================================
        // MESSAGE TEXT
        // ====================================

        message: {
            type: String,
            required: true,
            trim: true,
            maxlength: 5000
        },


        // ====================================
        // PUBLIC ROOM
        // ====================================

        room: {
            type: String,
            default: null,
            trim: true
        },


        // ====================================
        // PRIVATE MESSAGE RECEIVER
        // ====================================

        receiver: {
            type: String,
            default: null,
            trim: true
        },


        // ====================================
        // MESSAGE DELIVERED
        // ====================================

        delivered: {
            type: Boolean,
            default: false
        },


        // ====================================
        // MESSAGE SEEN
        // ====================================

        seen: {
            type: Boolean,
            default: false
        },


        // ====================================
        // MESSAGE SEEN TIME
        // ====================================

        seenAt: {
            type: Date,
            default: null
        },


        // ====================================
        // MESSAGE EDITED
        // ====================================

        edited: {
            type: Boolean,
            default: false
        },


        // ====================================
        // MESSAGE EDITED TIME
        // ====================================

        editedAt: {
            type: Date,
            default: null
        },


        // ====================================
        // MESSAGE DELETED
        // ====================================

        deleted: {
            type: Boolean,
            default: false
        },


        // ====================================
        // MESSAGE REACTIONS
        // ====================================

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


        // ====================================
        // REPLY TO MESSAGE
        // ====================================

        replyTo: {

            messageId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Message",
                default: null
            },

            text: {
                type: String,
                default: ""
            }

        }

    },

    {
        timestamps: true
    }
);


// ====================================
// EXPORT
// ====================================

module.exports = mongoose.model(
    "Message",
    messageSchema
);