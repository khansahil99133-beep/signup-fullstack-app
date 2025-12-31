import fs from "fs";
import path from "path";

const DATA_DIR = process.env.DATA_DIR || "/tmp/data";
const DATA_FILE = path.join(DATA_DIR, "data.json");

export function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ users: [] }, null, 2));
  }
}

export function readState() {
  ensureDataFile();
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
}

export function writeStateAtomic(state) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
}
