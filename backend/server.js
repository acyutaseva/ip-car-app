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

const PORT = process.env.PORT || 5002;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
