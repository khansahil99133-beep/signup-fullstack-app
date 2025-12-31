import express from "express";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import swaggerUi from "swagger-ui-express";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";

import { ensureDataFile, readState, writeStateAtomic } from "./storage.js";
import { cookieOptions, getCookieName, requireAdmin, signAdminJwt } from "./auth.js";
import { openapi } from "./openapi.js";
import {
  validateAdminLogin,
  validateNewPassword,
  validateSignup,
  validateBlogUpsert,
  validateAdminUserUpdate,
} from "./validators.js";

const app = express();

/* =======================
   ENV & BASIC SETUP
======================= */

if (process.env.TRUST_PROXY === "1" || process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

const PORT = Number(process.env.PORT || 8080);
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "admin12345";
const JWT_SECRET = process.env.JWT_SECRET || "change-me";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";
const RESERVED_USERNAMES = process.env.RESERVED_USERNAMES || "";

/* =======================
   STORAGE INIT (FIXED)
======================= */

ensureDataFile(); // ✅ MUST be called once on startup

const DATA_DIR = process.env.DATA_DIR || "/tmp/data";
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

/* =======================
   MIDDLEWARE
======================= */

const corsOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (corsOrigins.length) {
  app.use(cors({ origin: corsOrigins, credentials: true }));
}

app.use(morgan("dev"));
app.use(express.json({ limit: "256kb" }));
app.use(cookieParser());

/* =======================
   FILE UPLOADS
======================= */

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase() || ".bin";
      cb(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
});

app.use("/uploads", express.static(UPLOADS_DIR));

/* =======================
   HEALTH
======================= */

app.get("/health", (_req, res) => res.json({ ok: true }));

/* =======================
   HELPERS
======================= */

function publicUser(u) {
  const { passwordHash, ...rest } = u;
  return rest;
}

function normalizeState(state) {
  return {
    users: state.users || [],
    posts: state.posts || [],
    auditLog: state.auditLog || [],
    resetTokens: state.resetTokens || [],
    newsletterLog: state.newsletterLog || [],
  };
}

function cryptoRandomId() {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 10)
  );
}

/* =======================
   AUTH
======================= */

app.post("/api/auth/login", (req, res) => {
  const v = validateAdminLogin(req.body);
  if (!v.ok) return res.status(400).json(v);

  if (v.value.username !== ADMIN_USER || v.value.password !== ADMIN_PASS) {
    return res.status(401).json({ error: "invalid_credentials" });
  }

  const token = signAdminJwt({ username: ADMIN_USER }, JWT_SECRET, JWT_EXPIRES_IN);
  res.cookie(getCookieName(), token, cookieOptions());
  res.json({ ok: true });
});

app.post("/api/auth/logout", (_req, res) => {
  res.clearCookie(getCookieName(), { path: "/" });
  res.json({ ok: true });
});

/* =======================
   SIGNUP
======================= */

app.post("/api/signup", (req, res) => {
  const v = validateSignup(req.body, { reservedUsernames: new Set([ADMIN_USER]) });
  if (!v.ok) return res.status(400).json(v);

  const state = normalizeState(readState());

  if (state.users.some(u => u.username === v.value.username)) {
    return res.status(409).json({ error: "username_exists" });
  }

  const user = {
    id: cryptoRandomId(),
    username: v.value.username,
    email: v.value.email,
    passwordHash: bcrypt.hashSync(v.value.password, 10),
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  state.users.unshift(user);
  writeStateAtomic(state);

  res.status(201).json({ user: publicUser(user) });
});

/* =======================
   ADMIN USERS
======================= */

app.get("/api/admin/users", requireAdmin({ secret: JWT_SECRET }), (_req, res) => {
  const state = normalizeState(readState());
  res.json({ users: state.users.map(publicUser) });
});

/* =======================
   API DOCS
======================= */

app.get("/api/openapi.json", requireAdmin({ secret: JWT_SECRET }), (_req, res) => {
  res.json(openapi);
});

app.use(
  "/api/docs",
  requireAdmin({ secret: JWT_SECRET }),
  swaggerUi.serve,
  swaggerUi.setup(openapi),
);

/* =======================
   START SERVER
======================= */

app.listen(PORT, () => {
  console.log(`✅ Backend running on port ${PORT}`);
});
