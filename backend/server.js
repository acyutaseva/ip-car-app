require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const db = require("./database/db");
// Ensure admin user exists on server start
db.ensureAdminUser();

const authRoutes = require("./routes/auth");
const carRoutes = require("./routes/cars");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/cars", carRoutes);
app.use(
  "/uploads",
  express.static(path.resolve(__dirname, "uploads"), {
    maxAge: "30d",
    immutable: true,
    setHeaders: (res) => {
      res.setHeader("Cache-Control", "public, max-age=2592000, immutable");
    },
  })
);

app.get("/", (req, res) => {
  res.send("API Running");
});

const PORT = process.env.PORT || 5002;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
