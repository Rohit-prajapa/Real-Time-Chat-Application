const express = require("express");
const bcrypt = require("bcrypt");

const User = require("../models/User");
const isAuthenticated = require("../middleware/auth");

const router = express.Router();

// ====================================
// PROFILE PAGE
// ====================================

router.get("/profile", isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user?.id;

    if (!userId) {
      return res.redirect("/login");
    }

    const user = await User.findById(userId).select(
      "_id username email bio isOnline lastSeen createdAt",
    );

    if (!user) {
      return res.status(404).send("User not found.");
    }

    return res.render("profile", {
      user,
    });
  } catch (error) {
    console.error("Profile loading error:", error);

    return res.status(500).send("Unable to load profile.");
  }
});

// ====================================
// EDIT PROFILE PAGE
// ====================================

router.get("/profile/edit", isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user?.id;

    if (!userId) {
      return res.redirect("/login");
    }

    const user = await User.findById(userId).select("_id username email bio");

    if (!user) {
      return res.status(404).send("User not found.");
    }

    return res.render("edit-profile", {
      user,
      error: null,
      success: null,
    });
  } catch (error) {
    console.error("Edit profile loading error:", error);

    return res.status(500).send("Unable to load edit profile.");
  }
});

// ====================================
// UPDATE PROFILE
// ====================================

router.post("/profile/edit", isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user?.id;

    if (!userId) {
      return res.redirect("/login");
    }

    const username = String(req.body.username || "").trim();

    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();

    const bio = String(req.body.bio || "").trim();

    const renderError = async (message) => {
      const user = await User.findById(userId).select("_id username email bio");

      return res.render("edit-profile", {
        user,
        error: message,
        success: null,
      });
    };

    if (!username || !email) {
      return renderError("Username and email are required.");
    }

    if (username.length < 3 || username.length > 30) {
      return renderError("Username must be between 3 and 30 characters.");
    }

    if (bio.length > 160) {
      return renderError("Bio must be 160 characters or less.");
    }

    // ====================================
    // CHECK USERNAME
    // ====================================

    const existingUsername = await User.findOne({
      username,
      _id: {
        $ne: userId,
      },
    });

    if (existingUsername) {
      return renderError("Username already exists.");
    }

    // ====================================
    // CHECK EMAIL
    // ====================================

    const existingEmail = await User.findOne({
      email,
      _id: {
        $ne: userId,
      },
    });

    if (existingEmail) {
      return renderError("Email already exists.");
    }

    // ====================================
    // UPDATE USER
    // ====================================

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        username,
        email,
        bio,
      },
      {
        new: true,
        runValidators: true,
      },
    ).select("_id username email bio isOnline lastSeen createdAt");

    if (!updatedUser) {
      return res.status(404).send("User not found.");
    }

    // ====================================
    // UPDATE SESSION
    // ====================================

    req.session.user = {
      id: updatedUser._id.toString(),

      username: updatedUser.username,

      email: updatedUser.email,

      bio: updatedUser.bio || "",
    };

    // ====================================
    // SAVE SESSION
    // ====================================

    return req.session.save((sessionError) => {
      if (sessionError) {
        console.error("Session save error:", sessionError);

        return res
          .status(500)
          .send("Profile updated but session could not be saved.");
      }

      return res.render("edit-profile", {
        user: updatedUser,

        error: null,

        success: "Profile updated successfully.",
      });
    });
  } catch (error) {
    console.error("Profile update error:", error);

    return res.status(500).send("Unable to update profile.");
  }
});

// ====================================
// CHANGE PASSWORD PAGE
// ====================================

router.get("/profile/password", isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user?.id;

    if (!userId) {
      return res.redirect("/login");
    }

    const user = await User.findById(userId).select("_id username");

    if (!user) {
      return res.status(404).send("User not found.");
    }

    return res.render("change-password", {
      user,
      error: null,
      success: null,
    });
  } catch (error) {
    console.error("Change password page error:", error);

    return res.status(500).send("Unable to load change password page.");
  }
});

// ====================================
// CHANGE PASSWORD
// ====================================

router.post("/profile/password", isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user?.id;

    if (!userId) {
      return res.redirect("/login");
    }

    const { currentPassword, newPassword, confirmPassword } = req.body;

    // IMPORTANT:
    // password has select:false in User model.
    // Therefore explicitly select it.
    const user = await User.findById(userId).select("+password");

    if (!user) {
      return res.status(404).send("User not found.");
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.render("change-password", {
        user,
        error: "Please fill all fields.",
        success: null,
      });
    }

    if (newPassword.length < 6) {
      return res.render("change-password", {
        user,
        error: "New password must contain at least 6 characters.",
        success: null,
      });
    }

    if (newPassword !== confirmPassword) {
      return res.render("change-password", {
        user,
        error: "New passwords do not match.",
        success: null,
      });
    }

    // ====================================
    // CHECK CURRENT PASSWORD
    // ====================================

    const passwordCorrect = await bcrypt.compare(
      currentPassword,
      user.password,
    );

    if (!passwordCorrect) {
      return res.render("change-password", {
        user,
        error: "Current password is incorrect.",
        success: null,
      });
    }

    // ====================================
    // HASH NEW PASSWORD
    // ====================================

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;

    await user.save();

    // ====================================
    // SUCCESS
    // ====================================

    return res.render("change-password", {
      user,
      error: null,
      success: "Password changed successfully.",
    });
  } catch (error) {
    console.error("Change password error:", error);

    return res.status(500).send("Unable to change password.");
  }
});

// ====================================
// EXPORT ROUTER
// ====================================

module.exports = router;
