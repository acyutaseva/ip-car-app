
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const router = express.Router();
const db = require("../database/db");
const authMiddleware = require("../middleware/authMiddleware");

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }

  next();
};

// USER MANAGEMENT ENDPOINTS

// List all users
router.get("/users", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { rows } = await db.query("SELECT id, username, role FROM users", []);
    res.json({ users: rows });
  } catch (err) {
    res.status(500).json({ message: "Database error" });
  }
});

// Delete user by id
router.delete("/users/:id", authMiddleware, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await db.query("SELECT id, role FROM users WHERE id = $1", [id]);
    const targetUser = rows[0];
    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }
    if (targetUser.role === "admin") {
      return res.status(400).json({ message: "Cannot delete admin user" });
    }
    await db.query("DELETE FROM users WHERE id = $1", [id]);
    res.json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ message: "Database error" });
  }
});

// Change user password
router.post("/users/:id/change-password", authMiddleware, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ message: "Password required" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.query(
      "UPDATE users SET password = $1 WHERE id = $2",
      [hashedPassword, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ message: "Password updated" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// ADMIN DB DUMP (for inspection)
router.get("/admin/db_dump", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const users = (await db.query("SELECT * FROM users")).rows;
    const cars = (await db.query("SELECT * FROM cars")).rows;
    const phone_numbers = (await db.query("SELECT * FROM phone_numbers")).rows;
    res.json({ users, cars, phone_numbers });
  } catch (err) {
    res.status(500).json({ message: "DB error" });
  }
});

// REGISTER
// Note: keep this endpoint available for compatibility.
// New users default to role=user.
router.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        message: "Username and password required",
      });
    }

    const userCheck = await db.query("SELECT * FROM users WHERE username = $1", [username]);
    if (userCheck.rows.length > 0) {
      return res.status(400).json({
        message: "User already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query(
      "INSERT INTO users (username, password, role) VALUES ($1, $2, 'user')",
      [username, hashedPassword]
    );
    res.json({
      message: "User registered successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
    });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        message: "Username and password required",
      });
    }

    const userResult = await db.query("SELECT * FROM users WHERE username = $1", [username]);
    const user = userResult.rows[0];
    if (!user) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    const role = user.role || "user";
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        username: user.username,
        role,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
    });
  }
});

module.exports = router;
