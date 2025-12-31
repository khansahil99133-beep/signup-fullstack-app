import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";

const app = express();

/* ================== CONFIG ================== */

const PORT = process.env.PORT || 8080;
const DATA_DIR = process.env.DATA_DIR || "/data";
const DATA_FILE = path.join(DATA_DIR, "db.json");

const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "admin12345";
const JWT_SECRET = process.env.JWT_SECRET || "change-me";
const JWT_EXPIRES_IN = "8h";

/* ================== MIDDLEWARE ================== */

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

/* ================== STORAGE ================== */

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify({ users: [] }, null, 2)
  );
}

function readDB() {
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
}

function writeDB(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

/* ================== AUTH ================== */

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function requireAdmin(req, res, next) {
  const token = req.cookies.admin_token;
  if (!token) return res.status(401).json({ error: "unauthorized" });

  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "invalid_token" });
  }
}

/* ================== ROUTES ================== */

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

/* -------- SIGNUP (PUBLIC) -------- */
app.post("/api/signup", (req, res) => {
  const { username, password, email } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: "missing_fields" });

  const db = readDB();
  if (db.users.find(u => u.username === username))
    return res.status(409).json({ error: "user_exists" });

  const user = {
    id: Date.now().toString(),
    username,
    email: email || "",
    passwordHash: bcrypt.hashSync(password, 10),
    createdAt: new Date().toISOString()
  };

  db.users.push(user);
  writeDB(db);

  res.status(201).json({ user: { id: user.id, username, email } });
});

/* -------- ADMIN LOGIN -------- */
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;

  if (username !== ADMIN_USER || password !== ADMIN_PASS)
    return res.status(401).json({ error: "invalid_credentials" });

  const token = signToken({ username });
  res.cookie("admin_token", token, {
    httpOnly: true,
    sameSite: "lax"
  });

  res.json({ ok: true });
});

/* -------- ADMIN ME -------- */
app.get("/api/auth/me", requireAdmin, (req, res) => {
  res.json({ admin: req.admin });
});

/* -------- ADMIN USERS -------- */
app.get("/api/admin/users", requireAdmin, (_req, res) => {
  const db = readDB();
  const users = db.users.map(({ passwordHash, ...u }) => u);
  res.json({ users });
});

/* ================== START ================== */

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
