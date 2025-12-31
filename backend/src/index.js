import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";

const app = express();

/* ================= CONFIG ================= */
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

/* ================= MIDDLEWARE ================= */
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

/* ================= SIMPLE JSON DB ================= */
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

/* ================= HEALTH ================= */
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

/* ================= SIGNUP ================= */
app.post("/api/auth/signup", async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const db = readDB();

  const exists = db.users.find(
    (u) => u.email === email || u.username === username
  );

  if (exists) {
    return res.status(409).json({ error: "User already exists" });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = {
    id: Date.now(),
    username,
    email,
    passwordHash,
  };

  db.users.push(user);
  writeDB(db);

  res.status(201).json({
    message: "Signup successful",
    user: { id: user.id, username, email },
  });
});

/* ================= LOGIN ================= */
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;

  const db = readDB();
  const user = db.users.find((u) => u.email === email);

  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: "1d" }
  );

  res.json({ token });
});

/* ================= START ================= */
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
