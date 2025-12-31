import jwt from "jsonwebtoken";

const COOKIE_NAME = "admin_session";

export function getCookieName() {
  return COOKIE_NAME;
}

export function signAdminJwt({ username }, secret, expiresIn) {
  return jwt.sign({ sub: username, role: "admin" }, secret, { expiresIn });
}

export function extractToken(req) {
  const fromCookie = req.cookies?.[COOKIE_NAME];
  if (fromCookie) return fromCookie;

  const hdr = req.headers.authorization || "";
  const m = hdr.match(/^Bearer\s+(.+)$/i);
  if (m) return m[1];

  return null;
}

export function requireAdmin({ secret }) {
  return (req, res, next) => {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ error: "not_authenticated" });

    try {
      const payload = jwt.verify(token, secret);
      if (payload?.role !== "admin") return res.status(403).json({ error: "forbidden" });
      req.admin = { username: payload.sub };
      return next();
    } catch {
      return res.status(401).json({ error: "invalid_token" });
    }
  };
}

export function cookieOptions() {
  const isProd = process.env.NODE_ENV === "production";

  const rawSameSite = (process.env.COOKIE_SAMESITE || "lax").toLowerCase();
  const sameSite = rawSameSite === "none" || rawSameSite === "strict" || rawSameSite === "lax" ? rawSameSite : "lax";

  const secureFromEnv = process.env.COOKIE_SECURE;
  const secure =
    secureFromEnv != null ? secureFromEnv === "true" || secureFromEnv === "1" : isProd || sameSite === "none";

  return { httpOnly: true, sameSite, secure, path: "/" };
}
