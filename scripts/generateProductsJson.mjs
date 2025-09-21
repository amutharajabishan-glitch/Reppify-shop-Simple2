// scripts/generateProductsJson.mjs
import fs from "fs";
import path from "path";

// ---- Pfade ---------------------------------------------------------------
const ROOT = process.cwd();
const IMAGES_DIR = path.join(ROOT, "public", "images");
const OUT_FILE = path.join(ROOT, "public", "products.json");
const OVERRIDES_FILE = path.join(ROOT, "public", "price-overrides.v2.json");

// ---- Kategorien (Ordner -> Anzeigename) ----------------------------------
const CATEGORY_MAP = {
  shoes: "Shoes",
  hoodies: "Hoodies & Zippers",
  tees: "Tees",
  pants: "Sweatpants & Jeans",
  caps: "Caps & Beanies",
  bags: "Bags & Wallets",
  accessories: "Accessories",
  jackets: "Jackets",
  pullover: "Pullover"
};

// Default-Preise/Größen pro Kategorie (falls kein Override existiert)
const CATEGORY_DEFAULTS = {
  Shoes: { price: 149, sizes: ["40","41","42","43","44","45"] },
  "Hoodies & Zippers": { price: 89, sizes: ["S","M","L","XL","XXL"] },
  Tees: { price: 49, sizes: ["S","M","L","XL","XXL"] },
  "Sweatpants & Jeans": { price: 89, sizes: ["S","M","L","XL","XXL"] },
  "Caps & Beanies": { price: 39, sizes: [] },
  "Bags & Wallets": { price: 149, sizes: [] },
  Accessories: { price: 29, sizes: [] },
  Jackets: { price: 129, sizes: ["S","M","L","XL","XXL"] },
  Pullover: { price: 99, sizes: ["S","M","L","XL","XXL"] }
};

// ---- Hilfen ----------------------------------------------------------------
const VALID_IMG = /\.(jpe?g|png|webp|gif)$/i;
const IGNORED = new Set([".DS_Store"]);
const isIgnored = (name) => IGNORED.has(name) || name.startsWith(".");

const titleCase = (s) => s.replace(/\b\w/g, (m) => m.toUpperCase());

const COLOR_WORDS = new Set(
  [
    "black","white","offwhite","off_white","sail","cream","beige","brown","khaki",
    "grey","gray","silver","navy","blue","denim","red","pink","green","lime","olive",
    "yellow","gold","orange","purple","monogram","eclipse","obsidian","bone","storm","beam"
  ]
);

// aus Dateiname Modell/Color heuristisch extrahieren
function parseModelAndColor(filename) {
  const base = filename.replace(/\.[^.]+$/, "");
  const parts = base.split(/[-_]+/).filter(Boolean);

  if (parts.length <= 1) {
    const t = titleCase(base.replace(/[-_]+/g, " "));
    return { modelSlug: base.toLowerCase(), modelTitle: t, color: null };
  }

  // von rechts Farbwörter sammeln
  const color = [];
  for (let i = parts.length - 1; i >= 0; i--) {
    const w = parts[i].toLowerCase();
    if (COLOR_WORDS.has(w)) color.unshift(w);
    else break;
  }
  let modelParts = parts.slice(0, parts.length - color.length);
  if (!modelParts.length) modelParts = parts;

  return {
    modelSlug: modelParts.join(" ").toLowerCase(),
    modelTitle: titleCase(modelParts.join(" ")),
    color: color.length ? titleCase(color.join(" ")) : null
  };
}

function loadOverrides() {
  try {
    if (fs.existsSync(OVERRIDES_FILE)) {
      const raw = fs.readFileSync(OVERRIDES_FILE, "utf8");
      const json = JSON.parse(raw);
      return json && typeof json === "object" ? json : {};
    }
  } catch (e) {
    console.warn("Warnung: Konnte price-overrides.v2.json nicht lesen:", e.message);
  }
  return {};
}

function sortVariants(variants) {
  const priority = (c) => {
    const s = (c || "").toLowerCase();
    if (s === "black") return 0;
    if (s.includes("white")) return 1;
    return 2;
  };
  return variants
    .slice()
    .sort((a, b) => priority(a.color) - priority(b.color) || (a.color || "").localeCompare(b.color || ""));
}

// ---- Hauptlogik ------------------------------------------------------------
(function main() {
  if (!fs.existsSync(IMAGES_DIR)) {
    console.error("Fehler: public/images nicht gefunden.");
    process.exit(1);
  }

  const overrides = loadOverrides();
  /** Map key = `${category}|${modelSlug}` -> { title, category, variants: [] } */
  const groups = new Map();

  const categoryDirs = fs
    .readdirSync(IMAGES_DIR)
    .filter((d) => {
      const p = path.join(IMAGES_DIR, d);
      return !isIgnored(d) && fs.statSync(p).isDirectory();
    });

  for (const dir of categoryDirs) {
    const category = CATEGORY_MAP[dir.toLowerCase()] || titleCase(dir);
    const defaults = CATEGORY_DEFAULTS[category] || { price: 0, sizes: [] };
    const absDir = path.join(IMAGES_DIR, dir);

    const files = fs
      .readdirSync(absDir)
      .filter((f) => !isIgnored(f) && VALID_IMG.test(f));

    for (const file of files) {
      const rel = `/images/${dir}/${encodeURIComponent(file)}`;
      const { modelSlug, modelTitle, color } = parseModelAndColor(file);
      const key = `${category}|${modelSlug}`;

      const ov = overrides[rel] || {};
      const price = typeof ov.price === "number" ? ov.price : defaults.price;
      const sizes = Array.isArray(ov.sizes) ? ov.sizes : defaults.sizes;

      if (!groups.has(key)) {
        groups.set(key, { title: modelTitle, category, variants: [] });
      }
      groups.get(key).variants.push({ color, image: rel, price, sizes });
    }
  }

  const items = [];
  for (const [, g] of groups) {
    const variants = sortVariants(g.variants);
    const main = variants[0] || {};
    items.push({
      title: g.title,
      category: g.category,
      image: main.image || null,
      price: main.price ?? 0,
      sizes: main.sizes ?? [],
      variants
    });
  }

  items.sort(
    (a, b) =>
      (a.category || "").localeCompare(b.category || "") ||
      (a.title || "").localeCompare(b.title || "")
  );

  fs.writeFileSync(OUT_FILE, JSON.stringify({ items }, null, 2), "utf8");
  console.log(`✅ products.json erstellt: ${path.relative(ROOT, OUT_FILE)} (${items.length} Produkte)`);
})();
