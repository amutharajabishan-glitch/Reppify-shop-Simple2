// scripts/verifyImages.mjs
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const JSON_FILE = path.join(ROOT, "public", "products.json");
const IMG_ROOT  = path.join(ROOT, "public"); // wir erwarten Pfade wie /images/...

function exists(rel) {
  if (!rel || typeof rel !== "string") return false;
  const p = path.join(IMG_ROOT, rel.replace(/^\//, "")); // "/images/..." -> "images/..."
  return fs.existsSync(p);
}

function collectImages(item) {
  const list = [];
  if (item.image) list.push(item.image);
  if (Array.isArray(item.variants)) {
    for (const v of item.variants) {
      if (v?.image) list.push(v.image);
    }
  }
  return list;
}

function byCatCount(items) {
  const map = new Map();
  for (const it of items) {
    const c = it.category || "Uncategorized";
    map.set(c, (map.get(c) || 0) + 1);
  }
  return [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
}

try {
  const raw = fs.readFileSync(JSON_FILE, "utf8");
  const data = JSON.parse(raw);
  const items = data.items || [];

  console.log(`\nproducts.json geladen: ${items.length} Produkte\n`);
  console.log("Produkte je Kategorie:");
  for (const [cat, cnt] of byCatCount(items)) {
    console.log(`  - ${cat}: ${cnt}`);
  }

  const missing = [];
  for (const it of items) {
    for (const rel of collectImages(it)) {
      if (!exists(rel)) {
        missing.push({ title: it.title, category: it.category, image: rel });
      }
    }
  }

  if (missing.length === 0) {
    console.log("\n✅ Alle Bildpfade existieren. Bilder sollten angezeigt werden.\n");
  } else {
    console.log(`\n❌ Es fehlen ${missing.length} Bilddateien:\n`);
    for (const m of missing.slice(0, 50)) {
      console.log(`- [${m.category}] ${m.title}\n  fehlend: ${m.image}`);
    }
    if (missing.length > 50) {
      console.log(`... und noch ${missing.length - 50} weitere`);
    }

    console.log(`
Tipps:
- Pfade müssen exakt wie im products.json stehen (Groß-/Kleinschreibung wichtig).
- Ordnernamen in /public/images müssen genau so heißen wie referenziert:
  accessories, bags, caps, hoodies, jackets, pants, pullover, shoes, tees
- Im Browser lautet der Pfad /images/... (niemals /public/images/...).
`);
  }
} catch (e) {
  console.error("Fehler beim Prüfen:", e);
  process.exit(1);
}
