import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";

const app = express();

/* ===================== CONFIG ===================== */
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "admin123";

/* ===================== MIDDLEWARE ===================== */
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

/* ===================== STORAGE ===================== */
const DATA_DIR = process.env.DATA_DIR || "/tmp";
const DB_FILE = path.join(DATA_DIR, "db.json");

function ensureDB() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: [] }, null, 2));
  }
}
ensureDB();

function readDB() {
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

/* ===================== AUTH HELPERS ===================== */
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "8h" });
}

function requireAdmin(req, res, next) {
  const token = req.cookies?.admin_token;
  if (!token) return res.status(401).json({ error: "unauthorized" });

  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "invalid_token" });
  }
}

/* ===================== HEALTH ===================== */
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

/* ===================== SIGNUP ===================== */
app.post("/api/signup", (req, res) => {
  const { username, password, email } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: "missing_fields" });

  const db = readDB();
  if (db.users.find((u) => u.username === username))
    return res.status(409).json({ error: "user_exists" });

  const user = {
    id: Date.now().toString(),
    username,
    email: email || "",
    passwordHash: bcrypt.hashSync(password, 10),
    createdAt: new Date().toISOString(),
  };

  db.users.push(user);
  writeDB(db);

  res.status(201).json({
    user: { id: user.id, username: user.username, email: user.email },
  });
});

/* ===================== ADMIN LOGIN ===================== */
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;

  if (username !== ADMIN_USER || password !== ADMIN_PASS)
    return res.status(401).json({ error: "invalid_credentials" });

  const token = signToken({ username });
  res.cookie("admin_token", token, {
    httpOnly: true,
    sameSite: "lax",
  });

  res.json({ ok: true });
});

/* ===================== ADMIN ME ===================== */
app.get("/api/auth/me", requireAdmin, (req, res) => {
  res.json({ admin: req.admin });
});

/* ===================== ADMIN USERS ===================== */
app.get("/api/admin/users", requireAdmin, (req, res) => {
  const db = readDB();
  const users = db.users.map(({ passwordHash, ...u }) => u);
  res.json({ users });
});

/* ===================== START ===================== */
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
