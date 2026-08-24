const express = require("express");

const Message = require("../models/Message");
const User = require("../models/User");
const isAuthenticated = require("../middleware/auth");

const router = express.Router();


// ====================================
// CHAT PAGE
// ====================================

router.get(
    "/chat",
    isAuthenticated,
    async (req, res) => {

        try {

            const currentUsername =
                req.session.user.username;


            // ====================================
            // PRIVATE CHAT
            // ====================================

            if (req.query.user) {

                const targetUser =
                    await User.findById(
                        req.query.user
                    ).select(
                        "_id username isOnline lastSeen"
                    );


                if (!targetUser) {

                    return res.status(404).send(
                        "User not found."
                    );

                }


                // ====================================
                // DON'T CHAT WITH YOURSELF
                // ====================================

                if (
                    targetUser.username ===
                    currentUsername
                ) {

                    return res.redirect(
                        "/chat?room=general"
                    );

                }


                // ====================================
                // FIND PRIVATE MESSAGES
                // ====================================

                const messages =
                    await Message.find({

                        $or: [

                            {
                                username:
                                    currentUsername,

                                receiver:
                                    targetUser.username
                            },

                            {
                                username:
                                    targetUser.username,

                                receiver:
                                    currentUsername
                            }

                        ]

                    })
                    .sort({
                        createdAt: 1
                    })
                    .limit(100);


                return res.render(
                    "chat",
                    {

                        user:
                            req.session.user,

                        messages,

                        room:
                            null,

                        privateChat:
                            true,

                        targetUser

                    }
                );

            }


            // ====================================
            // PUBLIC ROOM CHAT
            // ====================================

            const room =
                req.query.room ||
                "general";


            const messages =
                await Message.find({

                    room:
                        room

                })
                .sort({
                    createdAt: 1
                })
                .limit(100);


            res.render(
                "chat",
                {

                    user:
                        req.session.user,

                    messages,

                    room,

                    privateChat:
                        false,

                    targetUser:
                        null

                }
            );


        } catch (error) {

            console.error(
                "Chat loading error:",
                error
            );


            res.status(500).send(
                "Unable to load chat."
            );

        }

    }
);


// ====================================
// GET ALL USERS
// ====================================

router.get(
    "/api/users",
    isAuthenticated,
    async (req, res) => {

        try {

            const currentUsername =
                req.session.user.username;


            // ====================================
            // FIND ALL OTHER USERS
            // ====================================

            const users =
                await User.find(

                    {
                        username: {
                            $ne:
                                currentUsername
                        }
                    },

                    {
                        _id: 1,
                        username: 1,
                        isOnline: 1,
                        lastSeen: 1,
                        unreadMessages: 1
                    }

                )
                .sort({
                    username: 1
                });


            // ====================================
            // SEND USERS
            // ====================================

            res.json(
                users
            );


        } catch (error) {

            console.error(
                "Users API error:",
                error
            );


            res.status(500).json({

                error:
                    "Unable to load users"

            });

        }

    }
);


module.exports = router;