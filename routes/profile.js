const express = require("express");
const bcrypt = require("bcrypt");

const User = require("../models/User");
const isAuthenticated = require("../middleware/auth");

const router = express.Router();


// ====================================
// PROFILE PAGE
// ====================================

router.get(
    "/profile",
    isAuthenticated,
    async (req, res) => {

        try {

            const userId = req.session.user.id;

            if (!userId) {
                return res.redirect("/login");
            }

            const user = await User.findById(userId).select(
                "_id username email bio isOnline lastSeen createdAt"
            );

            if (!user) {
                return res.status(404).send(
                    "User not found."
                );
            }

            return res.render(
                "profile",
                {
                    user
                }
            );

        } catch (error) {

            console.error(
                "Profile loading error:",
                error
            );

            return res.status(500).send(
                "Unable to load profile."
            );
        }

    }
);


// ====================================
// EDIT PROFILE PAGE
// ====================================

router.get(
    "/profile/edit",
    isAuthenticated,
    async (req, res) => {

        try {

            const userId = req.session.user.id;

            if (!userId) {
                return res.redirect("/login");
            }

            const user = await User.findById(userId).select(
                "_id username email bio"
            );

            if (!user) {
                return res.status(404).send(
                    "User not found."
                );
            }

            return res.render(
                "edit-profile",
                {
                    user,
                    error: null,
                    success: null
                }
            );

        } catch (error) {

            console.error(
                "Edit profile loading error:",
                error
            );

            return res.status(500).send(
                "Unable to load edit profile."
            );
        }

    }
);


// ====================================
// UPDATE PROFILE
// ====================================

router.post(
    "/profile/edit",
    isAuthenticated,
    async (req, res) => {

        try {

            const userId = req.session.user.id;

            if (!userId) {
                return res.redirect("/login");
            }


            // ====================================
            // GET FORM DATA
            // ====================================

            const username =
                req.body.username?.trim();

            const email =
                req.body.email
                    ?.trim()
                    .toLowerCase();

            const bio =
                (req.body.bio || "")
                    .trim();


            // ====================================
            // REQUIRED FIELDS
            // ====================================

            if (!username || !email) {

                const user =
                    await User.findById(userId).select(
                        "_id username email bio"
                    );

                return res.render(
                    "edit-profile",
                    {
                        user,

                        error:
                            "Username and email are required.",

                        success: null
                    }
                );
            }


            // ====================================
            // USERNAME VALIDATION
            // ====================================

            if (
                username.length < 3 ||
                username.length > 30
            ) {

                const user =
                    await User.findById(userId).select(
                        "_id username email bio"
                    );

                return res.render(
                    "edit-profile",
                    {
                        user,

                        error:
                            "Username must be between 3 and 30 characters.",

                        success: null
                    }
                );
            }


            // ====================================
            // BIO VALIDATION
            // ====================================

            if (bio.length > 160) {

                const user =
                    await User.findById(userId).select(
                        "_id username email bio"
                    );

                return res.render(
                    "edit-profile",
                    {
                        user,

                        error:
                            "Bio must be 160 characters or less.",

                        success: null
                    }
                );
            }


            // ====================================
            // CHECK USERNAME
            // ====================================

            const existingUsername =
                await User.findOne(
                    {
                        username,

                        _id: {
                            $ne: userId
                        }
                    }
                );


            if (existingUsername) {

                const user =
                    await User.findById(userId).select(
                        "_id username email bio"
                    );

                return res.render(
                    "edit-profile",
                    {
                        user,

                        error:
                            "Username already exists.",

                        success: null
                    }
                );
            }


            // ====================================
            // CHECK EMAIL
            // ====================================

            const existingEmail =
                await User.findOne(
                    {
                        email,

                        _id: {
                            $ne: userId
                        }
                    }
                );


            if (existingEmail) {

                const user =
                    await User.findById(userId).select(
                        "_id username email bio"
                    );

                return res.render(
                    "edit-profile",
                    {
                        user,

                        error:
                            "Email already exists.",

                        success: null
                    }
                );
            }


            // ====================================
            // UPDATE USER
            // ====================================

            const updatedUser =
                await User.findByIdAndUpdate(
                    userId,

                    {
                        username,
                        email,
                        bio
                    },

                    {
                        new: true,
                        runValidators: true
                    }
                ).select(
                    "_id username email bio isOnline lastSeen createdAt"
                );


            if (!updatedUser) {

                return res.status(404).send(
                    "User not found."
                );
            }


            // ====================================
            // UPDATE SESSION
            // ====================================

            req.session.user = {

                id:
                    updatedUser._id.toString(),

                username:
                    updatedUser.username,

                email:
                    updatedUser.email,

                bio:
                    updatedUser.bio || ""
            };


            // ====================================
            // SAVE SESSION
            // ====================================

            return req.session.save(
                (sessionError) => {

                    if (sessionError) {

                        console.error(
                            "Session save error:",
                            sessionError
                        );

                        return res.status(500).send(
                            "Profile updated but session could not be saved."
                        );
                    }


                    return res.render(
                        "edit-profile",
                        {
                            user: updatedUser,

                            error: null,

                            success:
                                "Profile updated successfully."
                        }
                    );

                }
            );

        } catch (error) {

            console.error(
                "Profile update error:",
                error
            );

            return res.status(500).send(
                "Unable to update profile."
            );
        }

    }
);


// ====================================
// CHANGE PASSWORD PAGE
// ====================================

router.get(
    "/profile/password",
    isAuthenticated,
    async (req, res) => {

        try {

            const userId = req.session.user.id;

            if (!userId) {
                return res.redirect("/login");
            }

            const user =
                await User.findById(userId).select(
                    "_id username"
                );

            if (!user) {
                return res.status(404).send(
                    "User not found."
                );
            }

            return res.render(
                "change-password",
                {
                    user,
                    error: null,
                    success: null
                }
            );

        } catch (error) {

            console.error(
                "Change password page error:",
                error
            );

            return res.status(500).send(
                "Unable to load change password page."
            );
        }

    }
);


// ====================================
// CHANGE PASSWORD
// ====================================

router.post(
    "/profile/password",
    isAuthenticated,
    async (req, res) => {

        try {

            const userId = req.session.user.id;

            if (!userId) {
                return res.redirect("/login");
            }

            const {
                currentPassword,
                newPassword,
                confirmPassword
            } = req.body;


            // ====================================
            // FIND USER
            // ====================================

            const user =
                await User.findById(userId);


            if (!user) {

                return res.status(404).send(
                    "User not found."
                );
            }


            // ====================================
            // REQUIRED FIELDS
            // ====================================

            if (
                !currentPassword ||
                !newPassword ||
                !confirmPassword
            ) {

                return res.render(
                    "change-password",
                    {
                        user,

                        error:
                            "Please fill all fields.",

                        success: null
                    }
                );
            }


            // ====================================
            // PASSWORD LENGTH
            // ====================================

            if (
                newPassword.length < 6
            ) {

                return res.render(
                    "change-password",
                    {
                        user,

                        error:
                            "New password must contain at least 6 characters.",

                        success: null
                    }
                );
            }


            // ====================================
            // CONFIRM PASSWORD
            // ====================================

            if (
                newPassword !==
                confirmPassword
            ) {

                return res.render(
                    "change-password",
                    {
                        user,

                        error:
                            "New passwords do not match.",

                        success: null
                    }
                );
            }


            // ====================================
            // CHECK CURRENT PASSWORD
            // ====================================

            const passwordCorrect =
                await bcrypt.compare(
                    currentPassword,
                    user.password
                );


            if (!passwordCorrect) {

                return res.render(
                    "change-password",
                    {
                        user,

                        error:
                            "Current password is incorrect.",

                        success: null
                    }
                );
            }


            // ====================================
            // HASH NEW PASSWORD
            // ====================================

            const hashedPassword =
                await bcrypt.hash(
                    newPassword,
                    10
                );


            // ====================================
            // SAVE PASSWORD
            // ====================================

            user.password =
                hashedPassword;


            await user.save();


            // ====================================
            // SUCCESS
            // ====================================

            return res.render(
                "change-password",
                {
                    user,

                    error: null,

                    success:
                        "Password changed successfully."
                }
            );

        } catch (error) {

            console.error(
                "Change password error:",
                error
            );

            return res.status(500).send(
                "Unable to change password."
            );
        }

    }
);


module.exports = router;