
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
router.get("/users", authMiddleware, requireAdmin, (req, res) => {
  db.all("SELECT id, username, role FROM users", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ message: "Database error" });
    }
    res.json({ users: rows });
  });
});

// Delete user by id
router.delete("/users/:id", authMiddleware, requireAdmin, (req, res) => {
  const { id } = req.params;

  db.get("SELECT id, role FROM users WHERE id = ?", [id], (lookupErr, targetUser) => {
    if (lookupErr) {
      return res.status(500).json({ message: "Database error" });
    }

    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    if (targetUser.role === "admin") {
      return res.status(400).json({ message: "Cannot delete admin user" });
    }

    db.run("DELETE FROM users WHERE id = ?", [id], function (err) {
      if (err) {
        return res.status(500).json({ message: "Database error" });
      }

      res.json({ message: "User deleted" });
    });
  });
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
    db.run(
      "UPDATE users SET password = ? WHERE id = ?",
      [hashedPassword, id],
      function (err) {
        if (err) {
          return res.status(500).json({ message: "Database error" });
        }
        if (this.changes === 0) {
          return res.status(404).json({ message: "User not found" });
        }
        res.json({ message: "Password updated" });
      }
    );
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// ADMIN DB DUMP (for inspection)
router.get("/admin/db_dump", authMiddleware, requireAdmin, (req, res) => {
  // Dump all tables for inspection (users, cars, phone_numbers)
  const dump = {};
  db.all("SELECT * FROM users", [], (err, users) => {
    if (err) return res.status(500).json({ message: "DB error (users)" });
    dump.users = users;
    db.all("SELECT * FROM cars", [], (err2, cars) => {
      if (err2) return res.status(500).json({ message: "DB error (cars)" });
      dump.cars = cars;
      db.all("SELECT * FROM phone_numbers", [], (err3, phones) => {
        if (err3) return res.status(500).json({ message: "DB error (phones)" });
        dump.phone_numbers = phones;
        res.json(dump);
      });
    });
  });
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

    db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
      if (err) {
        return res.status(500).json({
          message: "Database error",
        });
      }

      if (user) {
        return res.status(400).json({
          message: "User already exists",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      db.run(
        "INSERT INTO users (username, password, role) VALUES (?, ?, 'user')",
        [username, hashedPassword],
        function (insertErr) {
          if (insertErr) {
            return res.status(500).json({
              message: "Insert error",
            });
          }

          res.json({
            message: "User registered successfully",
          });
        }
      );
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
    });
  }
});

// LOGIN
router.post("/login", (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        message: "Username and password required",
      });
    }

    db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
      if (err) {
        return res.status(500).json({
          message: "Database error",
        });
      }

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
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
    });
  }
});

module.exports = router;
