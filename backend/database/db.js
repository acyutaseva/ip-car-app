const sqlite3 = require("sqlite3").verbose();
const path = require("path");

// Database path
const dbPath = path.join(__dirname, "cars.db");

// Create/connect database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Database connection error:", err.message);
  } else {
    console.log("Connected to SQLite database");
  }
});

// Create tables
// users.role migration notes:
// - Existing databases might not have role column.
// - We add it once, then ensure at least one admin exists.
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT NOT NULL DEFAULT 'user'
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS cars (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      car_number TEXT UNIQUE,
      owner_name TEXT,
      photo TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS phone_numbers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      car_id INTEGER,
      phone_number TEXT,
      FOREIGN KEY(car_id) REFERENCES cars(id)
    )
  `);

  db.all("PRAGMA table_info(users)", [], (err, columns) => {
    if (err) {
      console.error("Error checking users schema:", err.message);
      return;
    }

    const hasRole = columns.some((column) => column.name === "role");

    if (!hasRole) {
      db.run(
        "ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'",
        [],
        (alterErr) => {
          if (alterErr) {
            console.error("Error adding users.role column:", alterErr.message);
            return;
          }

          ensureAdminUser();
        }
      );
      return;
    }

    ensureAdminUser();
  });
});

function ensureAdminUser() {
  db.get("SELECT id FROM users WHERE role = 'admin' LIMIT 1", [], (err, adminUser) => {
    if (err) {
      console.error("Error checking admin user:", err.message);
      return;
    }

    if (adminUser) {
      return;
    }

    db.run(
      "UPDATE users SET role = 'admin' WHERE LOWER(username) = 'admin'",
      [],
      function (updateErr) {
        if (updateErr) {
          console.error("Error assigning admin by username:", updateErr.message);
          return;
        }

        if (this.changes > 0) {
          return;
        }

        db.run(
          `
            UPDATE users
            SET role = 'admin'
            WHERE id = (
              SELECT id FROM users ORDER BY id ASC LIMIT 1
            )
          `,
          [],
          (fallbackErr) => {
            if (fallbackErr) {
              console.error("Error assigning fallback admin:", fallbackErr.message);
            }
          }
        );
      }
    );
  });
}

module.exports = db;
