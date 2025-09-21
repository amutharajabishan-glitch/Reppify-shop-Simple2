import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const IMG_ROOT = path.join(ROOT, "public", "images");
const OUT_FILE = path.join(ROOT, "public", "products.json");

// Mappe alte / unsaubere Ordnernamen auf hübsche Kategorienamen
const categoryAliases = {
  "bags_wallets": "bags",
  "bags-and-wallets": "bags",
  "sweatpants&jeans": "sweatpants & jeans",
  "sweatpants_jeans": "sweatpants & jeans",
  "pullover": "pullover",
  "hoodies": "hoodies",
  "jackets": "jackets",
  "pants": "pants",
  "tees": "tees",
  "shoes": "shoes",
  "caps": "caps",
  "accessories": "accessories",
  "bags": "bags",
};

// Default-Größen pro Kategorie (Schuhe ≠ Kleidung)
const sizesByCategory = {
  pullover: ["S", "M", "L", "XL"],
  hoodies: ["S", "M", "L", "XL"],
  jackets: ["S", "M", "L", "XL"],
  pants: ["28", "30", "32", "34"],
  "sweatpants & jeans": ["28", "30", "32", "34"],
  tees: ["S", "M", "L", "XL"],
  shoes: ["38", "39", "40", "41", "42", "43", "44", "45"],
  caps: ["One Size"],
  accessories: ["One Size"],
  bags: ["One Size"],
};

// Default-Preise pro Kategorie (kannst du jederzeit anpassen)
const defaultPrice = {
  accessories: 30,
  bags: 60,
  caps: 35,
  hoodies: 65,
  jackets: 120,
  pants: 90,
  pullover: 80,
  shoes: 120,
  "sweatpants & jeans": 85,
  tees: 45,
};

function makeTitle(fileName) {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());
}

function listImageFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isFile() && d.name.match(/\.(png|jpe?g|webp)$/i))
    .map(d => path.join(dir, d.name));
}

function normalizeCategory(raw) {
  const key = raw.toLowerCase().replace(/\s+/g, "_");
  return categoryAliases[key] || raw.toLowerCase();
}

// alle Unterordner (= rohe Kategorien)
const rawDirs = fs.existsSync(IMG_ROOT)
  ? fs.readdirSync(IMG_ROOT, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)
  : [];

const items = [];

for (const rawCat of rawDirs) {
  const category = normalizeCategory(rawCat);
  const dir = path.join(IMG_ROOT, rawCat);
  const files = listImageFiles(dir);

  for (const abs of files) {
    const relPublic = "/" + path.relative(path.join(ROOT, "public"), abs).replace(/\\/g, "/");
    const title = makeTitle(path.basename(abs));
    items.push({
      title,
      category,
      image: relPublic,
      price: defaultPrice[category] ?? 50,
      sizes: sizesByCategory[category] ?? [],
    });
  }
}

// sortiere fürs Auge: erst Kategorie, dann Name
items.sort((a, b) =>
  (a.category || "").localeCompare(b.category || "") ||
  (a.title || "").localeCompare(b.title || "")
);

fs.writeFileSync(OUT_FILE, JSON.stringify({ items }, null, 2), "utf8");
console.log(`✅ products.json erstellt: ${items.length} Produkte, Kategorien: ${[
  ...new Set(items.map(i => i.category))
].join(", ")}`);
