import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";

const app = express();

/* ===== CONFIG ===== */
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

/* ===== MIDDLEWARE ===== */
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

/* ===== STORAGE ===== */
const DATA_DIR = process.env.DATA_DIR || "/tmp";
const DB_FILE = path.join(DATA_DIR, "db.json");

function ensureDB() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: [] }, null, 2));
  }
}

function readDB() {
  ensureDB();
  return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

/* ===== HEALTH ===== */
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

/* ===== SIGNUP ===== */
app.post("/api/signup", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const db = readDB();
  if (db.users.find(u => u.username === username)) {
    return res.status(409).json({ error: "User exists" });
  }

  const hash = await bcrypt.hash(password, 10);
  const user = { id: Date.now(), username, password: hash };

  db.users.push(user);
  writeDB(db);

  res.json({ ok: true });
});

/* ===== LOGIN ===== */
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  const db = readDB();
  const user = db.users.find(u => u.username === username);
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "1h" });
  res.json({ token });
});

/* ===== START ===== */
app.listen(PORT, () => {
  console.log(`Backend running on ${PORT}`);
});
