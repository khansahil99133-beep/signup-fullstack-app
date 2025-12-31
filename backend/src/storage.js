import fs from "node:fs";
import path from "node:path";

/**
 * Ensure data directory + data.json exists
 */
export function ensureDataFile(dataDir) {
  const dir = dataDir || "/data";
  fs.mkdirSync(dir, { recursive: true });

  const filePath = path.join(dir, "data.json");

  if (!fs.existsSync(filePath)) {
    const initialState = {
      users: [],
      posts: [],
      auditLog: [],
      resetTokens: [],
      newsletterLog: []
    };
    fs.writeFileSync(filePath, JSON.stringify(initialState, null, 2));
  }

  return filePath;
}

/**
 * Read JSON state safely
 */
export function readState(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

/**
 * Atomic write (prevents corruption on Render)
 */
export function writeStateAtomic(filePath, state) {
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, filePath);
}
