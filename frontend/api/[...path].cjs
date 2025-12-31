/**
 * Vercel Serverless Function: proxies /api/* to your backend.
 *
 * Set env var BACKEND_ORIGIN on Vercel, e.g. https://your-service.onrender.com
 */
function getBackendOrigin() {
  const raw = process.env.BACKEND_ORIGIN || process.env.RENDER_BACKEND_ORIGIN || "";
  const trimmed = String(raw).trim().replace(/\/$/, "");
  return trimmed || null;
}

function readBody(req) {
  const method = String(req.method || "GET").toUpperCase();
  if (method === "GET" || method === "HEAD") return Promise.resolve(undefined);

  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function toHeaders(h) {
  const out = {};
  for (const [k, v] of Object.entries(h || {})) {
    if (!v) continue;
    const key = k.toLowerCase();
    if (key === "host" || key === "connection" || key === "content-length") continue;
    out[key] = Array.isArray(v) ? v.join(",") : String(v);
  }
  return out;
}

module.exports = async (req, res) => {
  const backend = getBackendOrigin();
  if (!backend) {
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: "missing_backend_origin", hint: "Set BACKEND_ORIGIN on Vercel." }));
    return;
  }

  const rest = Array.isArray(req.query.path) ? req.query.path.join("/") : String(req.query.path || "");
  const qsIndex = (req.url || "").indexOf("?");
  const qs = qsIndex >= 0 ? (req.url || "").slice(qsIndex) : "";
  const targetUrl = `${backend}/api/${rest}${qs}`;

  const headers = toHeaders(req.headers);
  const body = await readBody(req);

  const upstream = await fetch(targetUrl, { method: req.method, headers, body });

  res.statusCode = upstream.status;

  // Copy headers (except set-cookie which needs special handling)
  upstream.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (k === "transfer-encoding") return;
    if (k === "set-cookie") return;
    res.setHeader(key, value);
  });

  // Preserve multiple Set-Cookie headers (Node 20+ / Undici)
  if (typeof upstream.headers.getSetCookie === "function") {
    const cookies = upstream.headers.getSetCookie();
    if (cookies && cookies.length) res.setHeader("set-cookie", cookies);
  } else {
    const cookie = upstream.headers.get("set-cookie");
    if (cookie) res.setHeader("set-cookie", cookie);
  }

  const buf = Buffer.from(await upstream.arrayBuffer());
  res.end(buf);
};
