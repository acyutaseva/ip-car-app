require("dotenv").config();

const express = require("express");
const cors = require("cors");

require("./database/db");

const authRoutes = require("./routes/auth");
const carRoutes = require("./routes/cars");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/cars", carRoutes);
app.use("/uploads", express.static("uploads"));

app.get("/", (req, res) => {
  res.send("API Running");
});

app.listen(5002, () => {
  console.log("Server running on port 5002");
});