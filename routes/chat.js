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
            // ====================================
            // GET CURRENT USER ID
            // ====================================

            const userId =
                req.session.user?.id;

            if (!userId) {
                return res.redirect("/login");
            }

            // ====================================
            // GET CURRENT USER FROM DATABASE
            // ====================================

            const currentUser =
                await User.findById(userId).select(
                    "_id username email isOnline lastSeen"
                );

            if (!currentUser) {
                return res.status(401).send(
                    "User account not found. Please login again."
                );
            }

            // ====================================
            // VERIFY USERNAME
            // ====================================

            const currentUsername =
                String(
                    currentUser.username || ""
                ).trim();

            if (!currentUsername) {
                console.error(
                    "Chat error: username missing from database user:",
                    currentUser
                );

                return res.status(500).send(
                    "Username is missing from your account."
                );
            }

            // ====================================
            // CREATE SAFE USER OBJECT FOR EJS
            // ====================================

            const chatUser = {
                _id:
                    currentUser._id,

                username:
                    currentUsername,

                email:
                    currentUser.email || "",

                isOnline:
                    currentUser.isOnline || false,

                lastSeen:
                    currentUser.lastSeen || null
            };

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

                // ====================================
                // TARGET USER NOT FOUND
                // ====================================

                if (!targetUser) {
                    return res.status(404).send(
                        "User not found."
                    );
                }

                const targetUsername =
                    String(
                        targetUser.username || ""
                    ).trim();

                if (!targetUsername) {
                    return res.status(404).send(
                        "Target user's username is missing."
                    );
                }

                // ====================================
                // DON'T CHAT WITH YOURSELF
                // ====================================

                if (
                    targetUsername ===
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
                                    targetUsername
                            },
                            {
                                username:
                                    targetUsername,

                                receiver:
                                    currentUsername
                            }
                        ]
                    })
                    .sort({
                        createdAt: 1
                    })
                    .limit(100);

                // ====================================
                // RENDER PRIVATE CHAT
                // ====================================

                return res.render(
                    "chat",
                    {
                        user:
                            chatUser,

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
                String(
                    req.query.room ||
                    "general"
                ).trim() ||
                "general";

            // ====================================
            // FIND PUBLIC MESSAGES
            // ====================================

            const messages =
                await Message.find({
                    room:
                        room
                })
                .sort({
                    createdAt: 1
                })
                .limit(100);

            // ====================================
            // RENDER PUBLIC CHAT
            // ====================================

            return res.render(
                "chat",
                {
                    user:
                        chatUser,

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

            return res.status(500).send(
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
            // ====================================
            // GET CURRENT USER ID
            // ====================================

            const userId =
                req.session.user?.id;

            if (!userId) {
                return res.status(401).json({
                    error:
                        "You must be logged in."
                });
            }

            // ====================================
            // GET CURRENT USER
            // ====================================

            const currentUser =
                await User.findById(userId)
                    .select(
                        "_id username"
                    )
                    .lean();

            if (!currentUser) {
                return res.status(401).json({
                    error:
                        "User not found."
                });
            }

            const currentUsername =
                String(
                    currentUser.username || ""
                ).trim();

            if (!currentUsername) {
                return res.status(500).json({
                    error:
                        "Current username is missing."
                });
            }

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
                })
                .lean();

            // ====================================
            // REMOVE INVALID USERS
            // ====================================

            const safeUsers =
                users.filter(
                    (user) =>
                        user &&
                        user.username
                );

            // ====================================
            // SEND USERS
            // ====================================

            return res.json(
                safeUsers
            );

        } catch (error) {
            console.error(
                "Users API error:",
                error
            );

            return res.status(500).json({
                error:
                    "Unable to load users"
            });
        }
    }
);

// ====================================
// EXPORT ROUTER
// ====================================

module.exports = router;