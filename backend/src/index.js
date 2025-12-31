
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors({ origin: "*"}));
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/auth/login", (req, res) => {
  res.json({ message: "Login endpoint working" });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log("Backend running on port", PORT);
});
