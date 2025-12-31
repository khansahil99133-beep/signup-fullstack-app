/**
 * Vercel Serverless Function: proxies /uploads/* to your backend.
 *
 * Set env var BACKEND_ORIGIN on Vercel, e.g. https://your-service.onrender.com
 */
function getBackendOrigin() {
  const raw = process.env.BACKEND_ORIGIN || process.env.RENDER_BACKEND_ORIGIN || "";
  const trimmed = String(raw).trim().replace(/\/$/, "");
  return trimmed || null;
}

export default async function handler(req, res) {
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
  const targetUrl = `${backend}/uploads/${rest}${qs}`;

  const headers = {};
  for (const [k, v] of Object.entries(req.headers || {})) {
    if (!v) continue;
    const key = k.toLowerCase();
    if (key === "host" || key === "connection" || key === "content-length") continue;
    headers[key] = Array.isArray(v) ? v.join(",") : String(v);
  }

  const upstream = await fetch(targetUrl, { method: req.method, headers });

  res.statusCode = upstream.status;
  upstream.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (k === "transfer-encoding") return;
    res.setHeader(key, value);
  });

  const buf = Buffer.from(await upstream.arrayBuffer());
  res.end(buf);
}
