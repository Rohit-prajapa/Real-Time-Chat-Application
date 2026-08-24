const express = require("express");
const bcrypt = require("bcrypt");
const User = require("../models/User");

const router = express.Router();

// ====================================
// REGISTER PAGE
// ====================================

router.get("/register", (req, res) => {
    if (req.session.user) {
        return res.redirect("/chat");
    }

    return res.render("register", {
        error: null
    });
});

// ====================================
// REGISTER USER
// ====================================

router.post("/register", async (req, res) => {
    try {
        const {
            username,
            email,
            password,
            confirmPassword
        } = req.body;

        const cleanUsername =
            String(username || "").trim();

        const cleanEmail =
            String(email || "")
                .trim()
                .toLowerCase();

        if (
            !cleanUsername ||
            !cleanEmail ||
            !password ||
            !confirmPassword
        ) {
            return res.render("register", {
                error:
                    "Please fill all fields."
            });
        }

        if (password !== confirmPassword) {
            return res.render("register", {
                error:
                    "Passwords do not match."
            });
        }

        if (password.length < 6) {
            return res.render("register", {
                error:
                    "Password must contain at least 6 characters."
            });
        }

        const existingUser =
            await User.findOne({
                $or: [
                    {
                        email:
                            cleanEmail
                    },
                    {
                        username:
                            cleanUsername
                    }
                ]
            });

        if (existingUser) {
            return res.render("register", {
                error:
                    "Username or email already exists."
            });
        }

        const hashedPassword =
            await bcrypt.hash(
                password,
                10
            );

        const user = new User({
            username:
                cleanUsername,

            email:
                cleanEmail,

            password:
                hashedPassword
        });

        await user.save();

        return res.redirect("/login");

    } catch (error) {
        console.error(
            "Registration error:",
            error
        );

        return res.render("register", {
            error:
                "Something went wrong. Please try again."
        });
    }
});

// ====================================
// LOGIN PAGE
// ====================================

router.get("/login", (req, res) => {
    if (req.session.user) {
        return res.redirect("/chat");
    }

    return res.render("login", {
        error: null
    });
});

// ====================================
// LOGIN USER
// ====================================

router.post("/login", async (req, res) => {
    try {
        const {
            email,
            password
        } = req.body;

        const cleanEmail =
            String(email || "")
                .trim()
                .toLowerCase();

        if (
            !cleanEmail ||
            !password
        ) {
            return res.render("login", {
                error:
                    "Please enter email and password."
            });
        }

        // IMPORTANT:
        // User.password has select:false
        // in models/User.js, therefore
        // explicitly include it here.
        const user =
            await User.findOne({
                email:
                    cleanEmail
            }).select("+password");

        if (!user) {
            return res.render("login", {
                error:
                    "Invalid email or password."
            });
        }

        const isPasswordCorrect =
            await bcrypt.compare(
                password,
                user.password
            );

        if (!isPasswordCorrect) {
            return res.render("login", {
                error:
                    "Invalid email or password."
            });
        }

        // ====================================
        // CREATE SESSION
        // ====================================

        req.session.user = {
            id:
                user._id.toString(),

            username:
                user.username,

            email:
                user.email
        };

        // ====================================
        // SAVE SESSION BEFORE REDIRECT
        // ====================================

        req.session.save((error) => {
            if (error) {
                console.error(
                    "Session save error:",
                    error
                );

                return res.status(500).render(
                    "login",
                    {
                        error:
                            "Unable to create login session. Please try again."
                    }
                );
            }

            return res.redirect("/chat");
        });

    } catch (error) {
        console.error(
            "Login error:",
            error
        );

        return res.status(500).render(
            "login",
            {
                error:
                    "Something went wrong. Please try again."
            }
        );
    }
});

// ====================================
// LOGOUT
// ====================================

router.get("/logout", (req, res) => {
    req.session.destroy((error) => {
        if (error) {
            console.error(
                "Logout error:",
                error
            );
        }

        res.clearCookie("connect.sid");

        return res.redirect("/login");
    });
});

// ====================================
// EXPORT ROUTER
// ====================================

module.exports = router;