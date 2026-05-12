const bcrypt = require("bcryptjs");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("railway") ? { rejectUnauthorized: false } : false,
});

async function ensureAdminUser() {
  try {
    const { rows } = await pool.query("SELECT * FROM users WHERE username = $1", ["admin"]);
    if (rows.length === 0) {
      const hashedPassword = await bcrypt.hash("harekrishan@123", 10);
      await pool.query(
        "INSERT INTO users (username, password, role) VALUES ($1, $2, 'admin')",
        ["admin", hashedPassword]
      );
      console.log("Default admin user created: admin / harekrishan@123");
    }
  } catch (err) {
    console.error("Error ensuring admin user:", err.message);
  }
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  ensureAdminUser,
};
