const express = require("express");
const bcrypt = require("bcrypt");

const User = require("../models/User");

const router = express.Router();

// ========================
// REGISTER PAGE
// ========================

router.get("/register", (req, res) => {
  if (req.session.user) {
    return res.redirect("/chat");
  }

  res.render("register", {
    error: null
  });
});

// ========================
// REGISTER USER
// ========================

router.post("/register", async (req, res) => {
  try {
    const { username, email, password, confirmPassword } = req.body;

    if (!username || !email || !password || !confirmPassword) {
      return res.render("register", {
        error: "Please fill all fields."
      });
    }

    if (password !== confirmPassword) {
      return res.render("register", {
        error: "Passwords do not match."
      });
    }

    if (password.length < 6) {
      return res.render("register", {
        error: "Password must contain at least 6 characters."
      });
    }

    const existingUser = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        { username: username }
      ]
    });

    if (existingUser) {
      return res.render("register", {
        error: "Username or email already exists."
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      username,
      email: email.toLowerCase(),
      password: hashedPassword
    });

    await user.save();

    res.redirect("/login");

  } catch (error) {
    console.error(error);

    res.render("register", {
      error: "Something went wrong. Please try again."
    });
  }
});

// ========================
// LOGIN PAGE
// ========================

router.get("/login", (req, res) => {
  if (req.session.user) {
    return res.redirect("/chat");
  }

  res.render("login", {
    error: null
  });
});

// ========================
// LOGIN USER
// ========================

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.render("login", {
        error: "Please enter email and password."
      });
    }

    const user = await User.findOne({
      email: email.toLowerCase()
    });

    if (!user) {
      return res.render("login", {
        error: "Invalid email or password."
      });
    }

    const isPasswordCorrect = await bcrypt.compare(
      password,
      user.password
    );

    if (!isPasswordCorrect) {
      return res.render("login", {
        error: "Invalid email or password."
      });
    }

    req.session.user = {
      id: user._id.toString(),
      username: user.username,
      email: user.email
    };

    res.redirect("/chat");

  } catch (error) {
    console.error(error);

    res.render("login", {
      error: "Something went wrong. Please try again."
    });
  }
});

// ========================
// LOGOUT
// ========================

router.get("/logout", (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      console.error(error);
    }

    res.redirect("/login");
  });
});

module.exports = router;