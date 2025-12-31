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

if (process.env.TRUST_PROXY === "1" || process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

const corsOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (corsOrigins.length) {
  app.use(
    cors({
      origin: corsOrigins,
      credentials: true,
    }),
  );
}


const PORT = Number(process.env.PORT || 8080);
const DATA_DIR = process.env.DATA_DIR || "/data";
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "admin12345";
const JWT_SECRET = process.env.JWT_SECRET || "change-me";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";
const RESERVED_USERNAMES = process.env.RESERVED_USERNAMES || "";

const dataFile = ensureDataFile(DATA_DIR);

const metrics = {
  requestsTotal: 0,
  errorTotal: 0,
  exportCounts: {
    users: 0,
    audit: 0,
  },
  lastExportDurationMs: 0,
  lastRequestDurationMs: 0,
  routes: {},
};

app.use(morgan("dev"));
app.use(express.json({ limit: "256kb" }));
app.use(cookieParser());

app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  res.once("finish", () => {
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
    metrics.requestsTotal += 1;
    metrics.lastRequestDurationMs = elapsedMs;
    const key = `${req.method} ${req.path}`;
    metrics.routes[key] = (metrics.routes[key] || 0) + 1;
  });
  next();
});

const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => {
      const ext = (path.extname(file.originalname || "").toLowerCase() || ".bin").slice(0, 10);
      const safeExt = /^[.][a-z0-9]{1,10}$/.test(ext) ? ext : ".bin";
      cb(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${safeExt}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith("image/"))
      return cb(new Error("Only image uploads allowed"));
    cb(null, true);
  },
});

app.use("/uploads", express.static(UPLOADS_DIR, { maxAge: "7d", etag: true }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const ADMIN_UI_DIST = path.join(process.cwd(), "..", "frontend", "dist");
const hasAdminUi = fs.existsSync(ADMIN_UI_DIST) && fs.statSync(ADMIN_UI_DIST).isDirectory();
const sendAdminApp = (_req, res) => {
  res.sendFile(path.join(ADMIN_UI_DIST, "index.html"));
};

if (hasAdminUi) {
  app.use(express.static(ADMIN_UI_DIST, { index: false }));
  app.get("/", sendAdminApp);
  app.get("/admin", sendAdminApp);
  app.get("/admin/login", sendAdminApp);
  app.get("/admin/*", sendAdminApp);
} else {
  app.get("/", (_req, res) => {
    res
      .type("text/plain")
      .send("Sign UP Jeetwin backend is running. Use /health or /api/* endpoints.");
  });
}

function publicUser(u) {
  const { passwordHash: _, ...rest } = u;
  return rest;
}

function getReservedUsernames() {
  const set = new Set(
    RESERVED_USERNAMES.split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
  set.add(String(ADMIN_USER).toLowerCase());
  return set;
}

function normalizeState(state) {
  const now = new Date().toISOString();
  const users = (state.users || []).map((u) => ({
    status: "pending",
    updatedAt: u?.updatedAt ?? u?.createdAt ?? now,
    statusHistory: Array.isArray(u?.statusHistory) ? u.statusHistory : [],
    ...u,
  }));

  const resetTokens = (state.resetTokens || []).filter(
    (t) => t && typeof t === "object" && t.expiresAt,
  );
  const auditLog = Array.isArray(state.auditLog) ? state.auditLog : [];
  const posts = Array.isArray(state.posts) ? state.posts : [];
  const newsletterLog = Array.isArray(state.newsletterLog) ? state.newsletterLog : [];

  return { ...state, users, resetTokens, auditLog, posts, newsletterLog };
}

function parseIntSafe(v, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.trunc(n);
  return i > 0 ? i : fallback;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function slugify(input) {
  const s = String(input || "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s.slice(0, 80);
}

function uniqueSlug(posts, desired, idToIgnore = null) {
  const base = desired || "post";
  let slug = base;
  let n = 2;
  const taken = new Set(
    posts.filter((p) => p.id !== idToIgnore).map((p) => String(p.slug || "").toLowerCase()),
  );
  while (taken.has(slug)) {
    slug = `${base}-${n}`;
    n += 1;
    if (n > 9999) break;
  }
  return slug;
}

function postHaystack(p) {
  return [p.title, p.slug, p.excerpt ?? "", p.tags?.join(" ") ?? "", p.contentMarkdown ?? ""]
    .join(" ")
    .toLowerCase();
}

function toPublicPost(p) {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt ?? "",
    coverImageUrl: p.coverImageUrl ?? null,
    tags: Array.isArray(p.tags) ? p.tags : [],
    published: Boolean(p.published),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    publishedAt: p.publishedAt ?? null,
    newsletterRequested: Boolean(p.newsletterRequested),
    newsletterStatus: p.newsletterStatus ?? null,
    newsletterSentAt: p.newsletterSentAt ?? null,
  };
}

function postSummary(p) {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt ?? "",
    coverImageUrl: p.coverImageUrl ?? null,
    tags: Array.isArray(p.tags) ? p.tags : [],
    publishedAt: p.publishedAt ?? null,
    newsletterRequested: Boolean(p.newsletterRequested),
    newsletterStatus: p.newsletterStatus ?? null,
    createdAt: p.createdAt,
  };
}

function baseUrlFromReq(req) {
  const proto = req.headers["x-forwarded-proto"]
    ? String(req.headers["x-forwarded-proto"]).split(",")[0].trim()
    : req.protocol;
  const host = req.headers["x-forwarded-host"]
    ? String(req.headers["x-forwarded-host"]).split(",")[0].trim()
    : req.headers.host;
  return process.env.PUBLIC_BASE_URL
    ? String(process.env.PUBLIC_BASE_URL).replace(/\/$/, "")
    : `${proto}://${host}`;
}

function xmlEscape(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function userHaystack(u) {
  return [
    u.username,
    u.email ?? "",
    u.mobileNumber ?? "",
    u.whatsappNumber ?? "",
    u.telegramUsername ?? "",
    u.createdAt ?? "",
    u.updatedAt ?? "",
    u.status ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

function statusCounts(users) {
  const c = { pending: 0, approved: 0, rejected: 0 };
  for (const u of users) {
    const s = String(u.status || "pending").toLowerCase();
    if (s === "approved") c.approved += 1;
    else if (s === "rejected") c.rejected += 1;
    else c.pending += 1;
  }
  return c;
}

function escapeCsvCell(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows, columns) {
  const header = columns.map(escapeCsvCell).join(",");
  const body = rows.map((r) => columns.map((c) => escapeCsvCell(r[c])).join(",")).join("\n");
  return `${header}\n${body}\n`;
}

function setCsvHeaders(res, filename) {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
}

app.post(["/api/signup", "/api/users"], (req, res) => {
  const v = validateSignup(req.body, { reservedUsernames: getReservedUsernames() });
  if (!v.ok) return res.status(400).json({ error: "validation_error", details: v.errors });

  const state0 = readState(dataFile);
  const state = normalizeState(state0);

  const exists = state.users.some(
    (u) => u.username.toLowerCase() === v.value.username.toLowerCase(),
  );
  if (exists) return res.status(409).json({ error: "username_exists" });

  const now = new Date().toISOString();
  const passwordHash = bcrypt.hashSync(v.value.password, 10);

  const user = {
    id: cryptoRandomId(),
    username: v.value.username,
    email: v.value.email,
    mobileNumber: v.value.mobileNumber,
    whatsappNumber: v.value.whatsappNumber,
    telegramUsername: v.value.telegramUsername,
    createdAt: now,
    updatedAt: now,
    status: "pending",
    statusHistory: [{ at: now, by: "system", from: null, to: "pending", note: "signup" }],
    passwordHash,
  };

  const next = { ...state, users: [user, ...state.users] };
  writeStateAtomic(dataFile, next);

  return res.status(201).json({ user: publicUser(user) });
});

app.post("/api/auth/login", (req, res) => {
  const v = validateAdminLogin(req.body);
  if (!v.ok) return res.status(400).json({ error: "validation_error", details: v.errors });

  const ok = v.value.username === ADMIN_USER && v.value.password === ADMIN_PASS;
  if (!ok) return res.status(401).json({ error: "invalid_credentials" });

  const token = signAdminJwt({ username: ADMIN_USER }, JWT_SECRET, JWT_EXPIRES_IN);

  res.cookie(getCookieName(), token, cookieOptions());
  return res.json({ ok: true });
});

app.get("/api/auth/me", requireAdmin({ secret: JWT_SECRET }), (req, res) => {
  res.json({ ok: true, admin: req.admin });
});

app.post("/api/auth/logout", (_req, res) => {
  res.clearCookie(getCookieName(), { path: "/" });
  res.json({ ok: true });
});

app.post(
  "/api/admin/uploads/image",
  requireAdmin({ secret: JWT_SECRET }),
  upload.single("file"),
  (req, res) => {
    if (!req.file)
      return res
        .status(400)
        .json({ error: "validation_error", details: [{ field: "file", message: "Required" }] });
    const url = `/uploads/${req.file.filename}`;

    const now = new Date().toISOString();
    const state0 = readState(dataFile);
    const state = normalizeState(state0);
    const auditEntry = {
      id: cryptoRandomId(),
      at: now,
      actor: req.admin?.username ?? ADMIN_USER,
      action: "upload_image",
      userId: "",
      username: "",
      from: "",
      to: url,
    };
    const auditLog = [...(Array.isArray(state.auditLog) ? state.auditLog : []), auditEntry].slice(
      -5000,
    );
    writeStateAtomic(dataFile, { ...state, auditLog });

    res.json({ url });
  },
);

/**
 * Server-side filtering + pagination.
 * Query:
 * - q: search
 * - status: pending|approved|rejected
 * - sort: newest|oldest
 * - page: 1-based
 * - pageSize: 1..100
 */

/**
 * SEO: sitemap.xml for blog (served via frontend nginx proxy to backend)
 */
app.get("/blog/sitemap.xml", (req, res) => {
  const state0 = readState(dataFile);
  const state = normalizeState(state0);

  const proto = req.headers["x-forwarded-proto"]
    ? String(req.headers["x-forwarded-proto"]).split(",")[0].trim()
    : req.protocol;
  const host = req.headers["x-forwarded-host"]
    ? String(req.headers["x-forwarded-host"]).split(",")[0].trim()
    : req.headers.host;
  const baseUrl = process.env.PUBLIC_BASE_URL
    ? String(process.env.PUBLIC_BASE_URL).replace(/\/$/, "")
    : `${proto}://${host}`;

  const posts = state.posts.filter((p) => Boolean(p.published));
  posts.sort(
    (a, b) =>
      new Date(b.publishedAt ?? b.createdAt).getTime() -
      new Date(a.publishedAt ?? a.createdAt).getTime(),
  );

  const urls = [
    { loc: `${baseUrl}/blog`, lastmod: new Date().toISOString() },
    ...posts.map((p) => ({
      loc: `${baseUrl}/blog/${encodeURIComponent(String(p.slug || ""))}`,
      lastmod: new Date(p.updatedAt ?? p.publishedAt ?? p.createdAt).toISOString(),
    })),
  ];

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod></url>`).join("\n") +
    `\n</urlset>\n`;

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.send(xml);
});

/**
 * SEO: RSS feed for blog
 */
app.get("/blog/rss.xml", (req, res) => {
  const state0 = readState(dataFile);
  const state = normalizeState(state0);
  const baseUrl = baseUrlFromReq(req);

  const posts = state.posts.filter((p) => Boolean(p.published));
  posts.sort(
    (a, b) =>
      new Date(b.publishedAt ?? b.createdAt).getTime() -
      new Date(a.publishedAt ?? a.createdAt).getTime(),
  );
  const items = posts.slice(0, 50);

  const now = new Date();
  const channelTitle =
    process.env.SITE_NAME || process.env.PUBLIC_SITE_NAME || "Sign UP Jeetwin Blog";

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss version="2.0">\n` +
    `  <channel>\n` +
    `    <title>${xmlEscape(channelTitle)}</title>\n` +
    `    <link>${xmlEscape(baseUrl + "/blog")}</link>\n` +
    `    <description>${xmlEscape("Latest blog posts")}</description>\n` +
    `    <lastBuildDate>${now.toUTCString()}</lastBuildDate>\n` +
    items
      .map((p) => {
        const link = `${baseUrl}/blog/${encodeURIComponent(String(p.slug || ""))}`;
        const pub = new Date(p.publishedAt ?? p.createdAt).toUTCString();
        return (
          `    <item>\n` +
          `      <title>${xmlEscape(p.title)}</title>\n` +
          `      <link>${xmlEscape(link)}</link>\n` +
          `      <guid>${xmlEscape(link)}</guid>\n` +
          `      <pubDate>${pub}</pubDate>\n` +
          `      <description>${xmlEscape(p.excerpt ?? "")}</description>\n` +
          `    </item>`
        );
      })
      .join("\n") +
    `\n  </channel>\n</rss>\n`;

  res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
  res.send(xml);
});
/**
 * Public Blog (published posts only)
 */

/**
 * Public: list tags (from published posts)
 */
app.get("/api/blog/tags", (_req, res) => {
  const state0 = readState(dataFile);
  const state = normalizeState(state0);

  const counts = new Map();
  for (const p of state.posts) {
    if (!p || !p.published) continue;
    const tags = Array.isArray(p.tags) ? p.tags : [];
    for (const t of tags) counts.set(t, (counts.get(t) || 0) + 1);
  }

  const items = Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, 100);

  res.json({ items });
});
app.get("/api/blog", (req, res) => {
  const q = String(req.query.q ?? "")
    .trim()
    .toLowerCase();
  const tag = String(req.query.tag ?? "")
    .trim()
    .toLowerCase();
  const sort = String(req.query.sort ?? "newest")
    .trim()
    .toLowerCase();
  const page = parseIntSafe(req.query.page, 1);
  const pageSize = clamp(parseIntSafe(req.query.pageSize, 10), 1, 50);

  const state0 = readState(dataFile);
  const state = normalizeState(state0);

  let published = state.posts.filter((p) => Boolean(p.published));
  if (q) published = published.filter((p) => postHaystack(p).includes(q));
  if (tag) published = published.filter((p) => Array.isArray(p.tags) && p.tags.includes(tag));

  published.sort((a, b) => {
    const at = new Date(a.publishedAt ?? a.createdAt).getTime();
    const bt = new Date(b.publishedAt ?? b.createdAt).getTime();
    return sort === "oldest" ? at - bt : bt - at;
  });

  const total = published.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = clamp(page, 1, pages);
  const start = (safePage - 1) * pageSize;

  const items = published.slice(start, start + pageSize).map(toPublicPost);

  res.json({ items, total, page: safePage, pageSize, pages });
});

app.get("/api/blog/:slug", (req, res) => {
  const slug = String(req.params.slug || "").toLowerCase();
  const state0 = readState(dataFile);
  const state = normalizeState(state0);

  const post = state.posts.find(
    (p) => String(p.slug || "").toLowerCase() === slug && Boolean(p.published),
  );
  if (!post) return res.status(404).json({ error: "not_found" });

  const tags = Array.isArray(post.tags) ? post.tags : [];
  const related = state.posts
    .filter((p) => Boolean(p.published) && p.id !== post.id)
    .map((p) => {
      const ptags = Array.isArray(p.tags) ? p.tags : [];
      const overlap = ptags.filter((t) => tags.includes(t)).length;
      const score = overlap * 10 + new Date(p.publishedAt ?? p.createdAt).getTime() / 1e12;
      return { p, overlap, score };
    })
    .filter((x) => x.overlap > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((x) => postSummary(x.p));

  res.json({
    post: {
      ...toPublicPost(post),
      contentMarkdown: post.contentMarkdown ?? "",
    },
    related,
  });
});

/**
 * Admin Blog (drafts + published)
 */
app.get("/api/admin/blog", requireAdmin({ secret: JWT_SECRET }), (req, res) => {
  const q = String(req.query.q ?? "")
    .trim()
    .toLowerCase();
  const tag = String(req.query.tag ?? "")
    .trim()
    .toLowerCase();
  const status = String(req.query.status ?? "all")
    .trim()
    .toLowerCase(); // all|published|draft
  const sort = String(req.query.sort ?? "newest")
    .trim()
    .toLowerCase();
  const page = parseIntSafe(req.query.page, 1);
  const pageSize = clamp(parseIntSafe(req.query.pageSize, 25), 1, 50);

  const state0 = readState(dataFile);
  const state = normalizeState(state0);

  let posts = state.posts.slice();

  if (q) posts = posts.filter((p) => postHaystack(p).includes(q));
  if (tag) posts = posts.filter((p) => Array.isArray(p.tags) && p.tags.includes(tag));
  if (status === "published") posts = posts.filter((p) => p.published);
  if (status === "draft") posts = posts.filter((p) => !p.published);

  posts.sort((a, b) => {
    const at = new Date(a.updatedAt ?? a.createdAt).getTime();
    const bt = new Date(b.updatedAt ?? b.createdAt).getTime();
    return sort === "oldest" ? at - bt : bt - at;
  });

  const total = posts.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = clamp(page, 1, pages);
  const start = (safePage - 1) * pageSize;

  const items = posts.slice(start, start + pageSize).map((p) => ({
    ...toPublicPost(p),
    // admin can see drafts too
    published: Boolean(p.published),
    updatedAt: p.updatedAt,
    createdAt: p.createdAt,
  }));

  res.json({ items, total, page: safePage, pageSize, pages });
});

app.post("/api/admin/blog", requireAdmin({ secret: JWT_SECRET }), (req, res) => {
  const v = validateBlogUpsert(req.body);
  if (!v.ok) return res.status(400).json({ error: "validation_error", details: v.errors });

  const state0 = readState(dataFile);
  const state = normalizeState(state0);

  const now = new Date().toISOString();
  const baseSlug = v.value.slug || slugify(v.value.title);
  const slug = uniqueSlug(state.posts, baseSlug);

  const newsletterRequested = Boolean(v.value.newsletter);
  const newsletterStatus = newsletterRequested && v.value.published ? "pending" : null;

  const post = {
    id: cryptoRandomId(),
    slug,
    title: v.value.title,
    excerpt: v.value.excerpt || v.value.contentMarkdown.trim().slice(0, 200),
    contentMarkdown: v.value.contentMarkdown,
    coverImageUrl: v.value.coverImageUrl,
    tags: v.value.tags,
    published: Boolean(v.value.published),
    createdAt: now,
    updatedAt: now,
    publishedAt: v.value.published ? now : null,
    newsletterRequested,
    newsletterStatus,
    newsletterSentAt: null,
  };

  const auditEntry = {
    id: cryptoRandomId(),
    at: now,
    actor: req.admin?.username ?? ADMIN_USER,
    action: "blog_create",
    userId: "",
    username: "",
    from: "",
    to: slug,
  };

  const newsletterEntries = [...state.newsletterLog];
  if (newsletterStatus === "pending") {
    newsletterEntries.push({
      id: cryptoRandomId(),
      postId: post.id,
      at: now,
      action: "newsletter_pending",
    });
  }

  const next = {
    ...state,
    posts: [post, ...state.posts],
    auditLog: [...state.auditLog, auditEntry].slice(-5000),
    newsletterLog: newsletterEntries.slice(-1000),
  };

  writeStateAtomic(dataFile, next);

  res.status(201).json({ post: { ...toPublicPost(post), contentMarkdown: post.contentMarkdown } });
});

app.patch("/api/admin/blog/:id", requireAdmin({ secret: JWT_SECRET }), (req, res) => {
  const id = String(req.params.id || "");
  const v = validateBlogUpsert({ ...req.body, title: req.body?.title ?? "" });
  if (!v.ok) return res.status(400).json({ error: "validation_error", details: v.errors });

  const state0 = readState(dataFile);
  const state = normalizeState(state0);

  const idx = state.posts.findIndex((p) => p.id === id);
  if (idx === -1) return res.status(404).json({ error: "not_found" });

  const prev = state.posts[idx];
  const now = new Date().toISOString();

  const desiredBase = v.value.slug || slugify(v.value.title);
  const slug = uniqueSlug(state.posts, desiredBase, id);

  const requestedPublished = v.value.published === true;
  const newsletterRequested = v.value.newsletter === true;

  const becamePublished = !prev.published && requestedPublished;
  const becameDraft = prev.published && !requestedPublished;

  const updated = {
    ...prev,
    slug,
    title: v.value.title,
    excerpt: v.value.excerpt || v.value.contentMarkdown.trim().slice(0, 200),
    contentMarkdown: v.value.contentMarkdown,
    coverImageUrl: v.value.coverImageUrl,
    tags: v.value.tags,
    published: requestedPublished,
    updatedAt: now,
    publishedAt: becamePublished ? now : prev.publishedAt,
    newsletterRequested,
  };

  if (becameDraft) {
    updated.publishedAt = null;
  }

  const shouldQueueNewsletter = newsletterRequested && requestedPublished;
  const newsletterStatus = shouldQueueNewsletter
    ? prev.newsletterStatus === "sent"
      ? "sent"
      : "pending"
    : null;
  updated.newsletterStatus = newsletterStatus;
  updated.newsletterSentAt = newsletterStatus === "sent" ? prev.newsletterSentAt : null;

  const action = becamePublished ? "blog_publish" : becameDraft ? "blog_unpublish" : "blog_update";
  const auditEntry = {
    id: cryptoRandomId(),
    at: now,
    actor: req.admin?.username ?? ADMIN_USER,
    action,
    userId: "",
    username: "",
    from: prev.slug,
    to: updated.slug,
  };

  const nextPosts = state.posts.slice();
  nextPosts[idx] = updated;

  const newsletterEntries = [...state.newsletterLog];
  if (newsletterStatus === "pending" && prev.newsletterStatus !== "pending") {
    newsletterEntries.push({
      id: cryptoRandomId(),
      postId: updated.id,
      at: now,
      action: "newsletter_pending",
    });
  }

  const next = {
    ...state,
    posts: nextPosts,
    auditLog: [...state.auditLog, auditEntry].slice(-5000),
    newsletterLog: newsletterEntries.slice(-1000),
  };
  writeStateAtomic(dataFile, next);

  res.json({ post: { ...toPublicPost(updated), contentMarkdown: updated.contentMarkdown } });
});

app.get("/api/admin/blog/notifications", requireAdmin({ secret: JWT_SECRET }), (_req, res) => {
  const state0 = readState(dataFile);
  const state = normalizeState(state0);
  const pending = state.posts.filter((p) => p.newsletterStatus === "pending");
  res.json({
    pending: pending.map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      newsletterRequested: Boolean(p.newsletterRequested),
      newsletterStatus: p.newsletterStatus,
      tags: p.tags,
      createdAt: p.createdAt,
    })),
  });
});

app.post("/api/admin/blog/:id/notify", requireAdmin({ secret: JWT_SECRET }), (req, res) => {
  const id = String(req.params.id || "");
  const state0 = readState(dataFile);
  const state = normalizeState(state0);
  const idx = state.posts.findIndex((p) => p.id === id);
  if (idx === -1) return res.status(404).json({ error: "not_found" });

  const now = new Date().toISOString();
  const post = state.posts[idx];
  if (post.newsletterStatus !== "pending") {
    return res.status(400).json({ error: "invalid_state", message: "Newsletter not pending" });
  }

  const updated = { ...post, newsletterStatus: "sent", newsletterSentAt: now };
  const nextPosts = state.posts.slice();
  nextPosts[idx] = updated;

  const newsletterEntry = {
    id: cryptoRandomId(),
    postId: updated.id,
    at: now,
    action: "newsletter_sent",
  };

  const next = {
    ...state,
    posts: nextPosts,
    newsletterLog: [...state.newsletterLog, newsletterEntry].slice(-1000),
  };
  writeStateAtomic(dataFile, next);

  res.json({ ok: true });
});

app.delete("/api/admin/blog/:id", requireAdmin({ secret: JWT_SECRET }), (req, res) => {
  const id = String(req.params.id || "");
  const state0 = readState(dataFile);
  const state = normalizeState(state0);

  const idx = state.posts.findIndex((p) => p.id === id);
  if (idx === -1) return res.status(404).json({ error: "not_found" });

  const now = new Date().toISOString();
  const removed = state.posts[idx];

  const nextPosts = state.posts.filter((p) => p.id !== id);

  const auditEntry = {
    id: cryptoRandomId(),
    at: now,
    actor: req.admin?.username ?? ADMIN_USER,
    action: "blog_delete",
    userId: "",
    username: "",
    from: removed.slug,
    to: "",
  };

  const next = {
    ...state,
    posts: nextPosts,
    auditLog: [...state.auditLog, auditEntry].slice(-5000),
  };
  writeStateAtomic(dataFile, next);

  res.json({ ok: true });
});
app.get("/api/admin/users", requireAdmin({ secret: JWT_SECRET }), (req, res) => {
  const q = String(req.query.q ?? "")
    .trim()
    .toLowerCase();
  const status = String(req.query.status ?? "")
    .trim()
    .toLowerCase();
  const sort = String(req.query.sort ?? "newest")
    .trim()
    .toLowerCase();

  const page = parseIntSafe(req.query.page, 1);
  const pageSize = clamp(parseIntSafe(req.query.pageSize, 25), 1, 100);

  const state0 = readState(dataFile);
  const state = normalizeState(state0);
  writeStateAtomic(dataFile, state);

  // Apply q filter first (for counts)
  let qFiltered = state.users;
  if (q) qFiltered = qFiltered.filter((u) => userHaystack(u).includes(q));

  const counts = statusCounts(qFiltered);

  // Apply status filter for list
  let filtered = qFiltered;
  if (status && ["pending", "approved", "rejected"].includes(status)) {
    filtered = filtered.filter((u) => String(u.status || "pending").toLowerCase() === status);
  }

  filtered.sort((a, b) => {
    const at = new Date(a.createdAt).getTime();
    const bt = new Date(b.createdAt).getTime();
    return sort === "oldest" ? at - bt : bt - at;
  });

  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = clamp(page, 1, pages);

  const start = (safePage - 1) * pageSize;
  const users = filtered.slice(start, start + pageSize).map(publicUser);

  res.json({ users, total, page: safePage, pageSize, pages, counts });
});

app.get("/api/admin/users/export.csv", requireAdmin({ secret: JWT_SECRET }), (req, res) => {
  const q = String(req.query.q ?? "")
    .trim()
    .toLowerCase();
  const status = String(req.query.status ?? "")
    .trim()
    .toLowerCase();
  const sort = String(req.query.sort ?? "newest")
    .trim()
    .toLowerCase();
  const exportStartMs = Date.now();

  const state0 = readState(dataFile);
  const state = normalizeState(state0);

  let qFiltered = state.users;
  if (q) qFiltered = qFiltered.filter((u) => userHaystack(u).includes(q));

  let filtered = qFiltered;
  if (status && ["pending", "approved", "rejected"].includes(status)) {
    filtered = filtered.filter((u) => String(u.status || "pending").toLowerCase() === status);
  }

  filtered.sort((a, b) => {
    const at = new Date(a.createdAt).getTime();
    const bt = new Date(b.createdAt).getTime();
    return sort === "oldest" ? at - bt : bt - at;
  });

  const rows = filtered.map((u) => ({
    id: u.id,
    username: u.username,
    email: u.email ?? "",
    mobileNumber: u.mobileNumber ?? "",
    whatsappNumber: u.whatsappNumber ?? "",
    telegramUsername: u.telegramUsername ?? "",
    status: u.status ?? "pending",
    statusChangedBy: u.statusChangedBy ?? "",
    statusChangedAt: u.statusChangedAt ?? "",
    createdAt: u.createdAt ?? "",
    updatedAt: u.updatedAt ?? "",
  }));

  const csv = toCsv(rows, [
    "id",
    "username",
    "email",
    "mobileNumber",
    "whatsappNumber",
    "telegramUsername",
    "status",
    "statusChangedBy",
    "statusChangedAt",
    "createdAt",
    "updatedAt",
  ]);

  setCsvHeaders(res, "users-export.csv");
  metrics.exportCounts.users += 1;
  metrics.lastExportDurationMs = Date.now() - exportStartMs;
  res.send(csv);
});

app.patch("/api/admin/users/:id", requireAdmin({ secret: JWT_SECRET }), (req, res) => {
  const id = String(req.params.id || "");
  const validation = validateAdminUserUpdate(req.body);
  if (!validation.ok) {
    return res.status(400).json({ error: "validation_error", details: validation.errors });
  }

  const state0 = readState(dataFile);
  const state = normalizeState(state0);

  const idx = state.users.findIndex((u) => u.id === id);
  if (idx === -1) return res.status(404).json({ error: "not_found" });

  const prev = state.users[idx];
  const now = new Date().toISOString();
  const actor = req.admin?.username ?? ADMIN_USER;
  const prevStatus = String(prev.status || "pending").toLowerCase();
  const nextStatus =
    typeof validation.value.status === "string" ? validation.value.status : prevStatus;

  const statusHistory = Array.isArray(prev.statusHistory) ? [...prev.statusHistory] : [];
  if (nextStatus !== prevStatus) {
    statusHistory.push({
      at: now,
      by: actor,
      from: prevStatus,
      to: nextStatus,
      note: "admin_update",
    });
  }

  const updated = {
    ...prev,
    email: validation.value.email ?? prev.email,
    mobileNumber: validation.value.mobileNumber ?? prev.mobileNumber,
    whatsappNumber:
      typeof validation.value.whatsappNumber !== "undefined"
        ? validation.value.whatsappNumber
        : prev.whatsappNumber,
    telegramUsername:
      typeof validation.value.telegramUsername !== "undefined"
        ? validation.value.telegramUsername
        : prev.telegramUsername,
    status: nextStatus,
    statusChangedBy: nextStatus !== prevStatus ? actor : prev.statusChangedBy,
    statusChangedAt: nextStatus !== prevStatus ? now : prev.statusChangedAt,
    statusHistory,
    updatedAt: now,
  };

  const auditEntry = {
    id: cryptoRandomId(),
    at: now,
    actor,
    action: nextStatus !== prevStatus ? "status_change" : "user_update",
    userId: id,
    username: updated.username,
    from: prevStatus,
    to: nextStatus,
  };

  const nextUsers = state.users.slice();
  nextUsers[idx] = updated;

  const auditLog = [...(Array.isArray(state.auditLog) ? state.auditLog : []), auditEntry].slice(
    -5000,
  );

  const next = { ...state, users: nextUsers, auditLog };
  writeStateAtomic(dataFile, next);

  return res.json({ user: publicUser(updated) });
});

app.delete("/api/admin/users/:id", requireAdmin({ secret: JWT_SECRET }), (req, res) => {
  const id = String(req.params.id || "");
  const state0 = readState(dataFile);
  const state = normalizeState(state0);

  const idx = state.users.findIndex((u) => u.id === id);
  if (idx === -1) return res.status(404).json({ error: "not_found" });

  const user = state.users[idx];
  const now = new Date().toISOString();
  const actor = req.admin?.username ?? ADMIN_USER;

  const nextUsers = state.users.slice();
  nextUsers.splice(idx, 1);

  const resetTokens = state.resetTokens.filter((t) => t.userId !== id);

  const auditEntry = {
    id: cryptoRandomId(),
    at: now,
    actor,
    action: "user_delete",
    userId: id,
    username: user.username,
    from: "",
    to: "",
  };

  const auditLog = [...(Array.isArray(state.auditLog) ? state.auditLog : []), auditEntry].slice(
    -5000,
  );

  const next = { ...state, users: nextUsers, resetTokens, auditLog };
  writeStateAtomic(dataFile, next);

  res.json({ ok: true });
});

app.post("/api/admin/users/:id/reset-token", requireAdmin({ secret: JWT_SECRET }), (req, res) => {
  const id = String(req.params.id || "");
  const state0 = readState(dataFile);
  const state = normalizeState(state0);

  const user = state.users.find((u) => u.id === id);
  if (!user) return res.status(404).json({ error: "not_found" });

  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = Date.now() + 15 * 60 * 1000;

  const resetTokens = state.resetTokens.filter((t) => t.userId !== id && t.expiresAt > Date.now());
  resetTokens.push({ token, userId: id, expiresAt });

  const next = { ...state, resetTokens };
  writeStateAtomic(dataFile, next);

  res.json({ token, resetUrl: `/reset?token=${token}`, expiresAt });
});

app.post("/api/reset-password", (req, res) => {
  const v = validateNewPassword(req.body);
  if (!v.ok) return res.status(400).json({ error: "validation_error", details: v.errors });

  const state0 = readState(dataFile);
  const state = normalizeState(state0);

  const nowMs = Date.now();
  const tokenRow = state.resetTokens.find((t) => t.token === v.value.token);
  if (!tokenRow || tokenRow.expiresAt <= nowMs) {
    return res.status(410).json({ error: "expired_or_invalid_token" });
  }

  const idx = state.users.findIndex((u) => u.id === tokenRow.userId);
  if (idx === -1) return res.status(410).json({ error: "expired_or_invalid_token" });

  const now = new Date().toISOString();
  const passwordHash = bcrypt.hashSync(v.value.newPassword, 10);

  const updated = { ...state.users[idx], passwordHash, updatedAt: now };

  const nextUsers = state.users.slice();
  nextUsers[idx] = updated;

  const resetTokens = state.resetTokens.filter((t) => t.token !== v.value.token);

  const next = { ...state, users: nextUsers, resetTokens };
  writeStateAtomic(dataFile, next);

  res.json({ ok: true });
});

app.get("/api/admin/audit", requireAdmin({ secret: JWT_SECRET }), (req, res) => {
  const page = parseIntSafe(req.query.page, 1);
  const pageSize = clamp(parseIntSafe(req.query.pageSize, 50), 1, 200);

  const state0 = readState(dataFile);
  const state = normalizeState(state0);

  const all = Array.isArray(state.auditLog) ? state.auditLog.slice() : [];
  all.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const total = all.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = clamp(page, 1, pages);

  const start = (safePage - 1) * pageSize;
  const items = all.slice(start, start + pageSize);

  res.json({ items, total, page: safePage, pageSize, pages });
});

app.get("/api/admin/audit/export.csv", requireAdmin({ secret: JWT_SECRET }), (req, res) => {
  const state0 = readState(dataFile);
  const state = normalizeState(state0);
  const exportStartMs = Date.now();

  const all = Array.isArray(state.auditLog) ? state.auditLog.slice() : [];
  all.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const rows = all.map((i) => ({
    at: i.at ?? "",
    actor: i.actor ?? "",
    action: i.action ?? "",
    userId: i.userId ?? "",
    username: i.username ?? "",
    from: i.from ?? "",
    to: i.to ?? "",
  }));

  const csv = toCsv(rows, ["at", "actor", "action", "userId", "username", "from", "to"]);
  setCsvHeaders(res, "audit-export.csv");
  metrics.exportCounts.audit += 1;
  metrics.lastExportDurationMs = Date.now() - exportStartMs;
  res.send(csv);
});

app.get("/api/openapi.json", requireAdmin({ secret: JWT_SECRET }), (_req, res) => {
  res.json(openapi);
});

app.use(
  "/api/docs",
  requireAdmin({ secret: JWT_SECRET }),
  swaggerUi.serve,
  swaggerUi.setup(openapi),
);

app.use((err, _req, _res, next) => {
  metrics.errorTotal += 1;
  next(err);
});

app.get("/metrics", requireAdmin({ secret: JWT_SECRET }), (_req, res) => {
  res.json(metrics);
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on :${PORT}`);
});

function cryptoRandomId() {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10)
  );
}
