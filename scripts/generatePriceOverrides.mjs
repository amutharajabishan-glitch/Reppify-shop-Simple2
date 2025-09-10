// scripts/generatePriceOverrides.mjs
import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const IMAGES_DIR = path.join(ROOT, "public", "images");
const OUT_FILE = path.join(ROOT, "public", "price-overrides.json");

// Basispreise pro Kategorie (Ordner unter /public/images)
const BASE = {
  shoes: 189,
  "sweatpants-jeans": 90,
  hoodies: 85,
  tees: 45,
  caps: 69,
  bags: 179,
  accessories: 40,
  parfum: 99,
  default: 129,
};

const exts = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);

async function walk(dir) {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full)));
    else {
      const ext = path.extname(e.name).toLowerCase();
      if (exts.has(ext)) out.push(full);
    }
  }
  return out;
}

function guessCategory(absFile) {
  const rel = absFile.split(path.sep).join("/").split("/public/images/")[1] || "";
  const first = rel.split("/")[0]?.toLowerCase() || "";
  return first || "default";
}

function priceForCategory(cat) {
  return BASE[cat] ?? BASE.default;
}

(async () => {
  try {
    await fs.access(IMAGES_DIR);
    const files = await walk(IMAGES_DIR);
    if (files.length === 0) {
      console.log("Keine Bilder gefunden in public/images");
      process.exit(0);
    }

    const overrides = {};
    for (const abs of files) {
      const cat = guessCategory(abs);
      const price = priceForCategory(cat);
      const relFromPublic = abs
        .split(path.join(ROOT, "public"))
        .join("")
        .split(path.sep)
        .join("/");
      const key = relFromPublic.startsWith("/") ? relFromPublic : `/${relFromPublic}`;
      overrides[key] = price; // hier kannst du später einzelne Preise ändern
    }

    // existierende Datei (falls vorhanden) beibehalten – manuelle Werte haben Vorrang
    let existing = {};
    try {
      const raw = await fs.readFile(OUT_FILE, "utf8");
      existing = JSON.parse(raw);
    } catch {}
    const merged = { ...overrides, ...existing };

    await fs.writeFile(OUT_FILE, JSON.stringify(merged, null, 2), "utf8");
    console.log(`Fertig: ${OUT_FILE}`);
    console.log(`Einträge: ${Object.keys(merged).length}`);
  } catch (err) {
    console.error("Fehler:", err.message);
    process.exit(1);
  }
})();
