import fs from "node:fs";
import path from "node:path";

const DEFAULT_STATE = { users: [], resetTokens: [], auditLog: [], posts: [] };

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function ensureDataFile(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const filePath = path.join(dataDir, "users.json");
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(DEFAULT_STATE, null, 2), "utf8");
  }
  return filePath;
}

export function readState(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = safeJsonParse(raw);
  if (!parsed || typeof parsed !== "object") return { ...DEFAULT_STATE };
  if (!Array.isArray(parsed.users)) parsed.users = [];
  if (!Array.isArray(parsed.resetTokens)) parsed.resetTokens = [];
  if (!Array.isArray(parsed.auditLog)) parsed.auditLog = [];
  if (!Array.isArray(parsed.posts)) parsed.posts = [];
  return parsed;
}

export function writeStateAtomic(filePath, nextState) {
  const dir = path.dirname(filePath);
  const tmp = path.join(dir, `users.json.tmp.${process.pid}.${Date.now()}`);
  fs.writeFileSync(tmp, JSON.stringify(nextState, null, 2), "utf8");
  fs.renameSync(tmp, filePath);
}
