import fs from "fs";
import path from "path";

// Render-safe writable directory
const DATA_DIR =
  process.env.DATA_DIR ||
  path.join(process.cwd(), "data");

// Ensure directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export default DATA_DIR;
