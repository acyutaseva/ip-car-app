require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const db = require("./database/db");
// Ensure admin user exists on server start
db.ensureAdminUser();

const authRoutes = require("./routes/auth");
const carRoutes = require("./routes/cars");

const app = express();
const uploadsPrimaryDir = path.resolve(process.env.UPLOADS_DIR || path.join(__dirname, "uploads"));

const setUploadCacheHeaders = (res) => {
  res.setHeader("Cache-Control", "public, max-age=2592000, immutable");
};

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/cars", carRoutes);
app.use(
  "/uploads",
  express.static(uploadsPrimaryDir, {
    maxAge: "30d",
    immutable: true,
    setHeaders: setUploadCacheHeaders,
  })
);

if (!fs.existsSync(uploadsPrimaryDir)) {
  fs.mkdirSync(uploadsPrimaryDir, { recursive: true });
}

app.get("/", (req, res) => {
  res.send("API Running");
});

const PORT = process.env.PORT || 5002;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
