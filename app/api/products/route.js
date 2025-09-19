// app/api/products/route.js
import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

const PUBLIC_DIR = path.join(process.cwd(), 'public', 'images');
const OVERRIDES_PATH = path.join(process.cwd(), 'public', 'price-overrides.v2.json');
const VALID_EXT = /\.(jpg|jpeg|png|webp|gif|png)$/i;

function isIgnored(name) {
  const b = path.basename(name).toLowerCase();
  return b.startsWith('.') || b === '.ds_store';
}

function folderToCategory(folder) {
  const f = String(folder).toLowerCase();
  switch (f) {
    case 'shoes': return 'Shoes';
    case 'slides': return 'Slides';
    case 'hoodies':
    case 'hoodies & zippers':
    case 'hoodies-zippers':
    case 'hoodies_zippers': return 'Hoodies & Zippers';
    case 'tees': return 'Tees';
    case 'pants':
    case 'sweatpants':
    case 'sweatpants & jeans':
    case 'sweatpants-jeans':
    case 'sweatpants_jeans':
    case 'jeans': return 'Sweatpants & Jeans';
    case 'caps':
    case 'beanies':
    case 'caps & beanies':
    case 'caps-beanies':
    case 'caps_beanies': return 'Caps & Beanies';
    case 'bags':
    case 'wallets':
    case 'bags & wallets':
    case 'bags-wallets':
    case 'bags_wallets': return 'Bags & Wallets';
    case 'accessories': return 'Accessories';
    case 'parfum': return 'Parfum';
    case 'jackets': return 'Jackets';
    case 'pullover': return 'Pullover';
    default: return f.charAt(0).toUpperCase() + f.slice(1);
  }
}

// Kategorie-Defaults: hier kannst du jederzeit anpassen
const CATEGORY_DEFAULTS = {
  Shoes: { price: 149, sizes: Array.from({ length: 11 }, (_, i) => String(36 + i)) },
  Slides: { price: 79, sizes: Array.from({ length: 7 }, (_, i) => String(38 + i)) },
  Jackets: { price: 129, sizes: ["S","M","L","XL","XXL"] },
  Pullover: { price: 99, sizes: ["S","M","L","XL","XXL"] },
  "Hoodies & Zippers": { price: 89, sizes: ["S","M","L","XL","XXL"] },
  Tees: { price: 49, sizes: ["S","M","L","XL","XXL"] },
  "Sweatpants & Jeans": { price: 89, sizes: ["S","M","L","XL","XXL"] },
  "Caps & Beanies": { price: 39, sizes: [] },
  "Bags & Wallets": { price: 149, sizes: [] },
  Accessories: { price: 29, sizes: [] },
  Parfum: { price: 69, sizes: [] }
};

function titleCase(str) {
  return str.replace(/\b\w/g, m => m.toUpperCase());
}

function titleFromFilename(file) {
  const base = path.basename(file).replace(/\.[^/.]+$/, '');
  return titleCase(
    base.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  );
}

// Farbwörter-Liste (erweiterbar)
const COLOR_WORDS = new Set((
  'black,white,grey,gray,beige,cream,brown,tan,ivory,' +
  'navy,blue,royal,teal,cyan,lightblue,darkblue,' +
  'red,maroon,pink,rose,magenta,' +
  'green,olive,lime,forest,' +
  'yellow,gold,orange,amber,' +
  'purple,violet,lilac,' +
  'silver,metallic,chrome,' +
  'bone,beige,khaki,sand,stone,smoke,offwhite,off_white,' +
  'sail,obsidian,unc,university,denim,eclipse,prism,monogram'
).split(',').map(s => s.trim()).filter(Boolean));

/**
 * Versucht, aus dem Dateinamen "Modell" und "Farbe" zu erkennen.
 * Strategie: Worte am Ende, die in COLOR_WORDS sind, als Farbe nehmen.
 * Rest = Modell.
 */
function extractModelAndColor(filenameBase) {
  // base ohne Extension, _ und - zu Space
  const base = filenameBase.replace(/\.[^/.]+$/, '');
  const words = base.split(/[-_]+/).filter(Boolean);
  if (words.length <= 1) {
    return { modelSlug: base.toLowerCase(), modelTitle: titleFromFilename(base), color: null };
  }
  // von hinten Farbe sammeln, solange Wort in COLOR_WORDS
  const colorWords = [];
  for (let i = words.length - 1; i >= 0; i--) {
    const w = words[i].toLowerCase();
    if (COLOR_WORDS.has(w)) colorWords.unshift(w);
    else break;
  }
  let modelWords = words.slice(0, words.length - colorWords.length);
  if (modelWords.length === 0) modelWords = words; // fallback
  const modelSlug = modelWords.join(' ').toLowerCase();
  const modelTitle = titleCase(modelWords.join(' '));
  const color = colorWords.length ? titleCase(colorWords.join(' ')) : null;
  return { modelSlug, modelTitle, color };
}

function safeLoadOverrides() {
  try {
    if (fs.existsSync(OVERRIDES_PATH)) {
      const raw = fs.readFileSync(OVERRIDES_PATH, 'utf-8');
      const json = JSON.parse(raw);
      return json && typeof json === 'object' ? json : {};
    }
  } catch {}
  return {};
}

// sortiert Varianten: black -> white -> rest alphabetisch
function sortVariants(variants) {
  const score = (c) => {
    const s = (c || '').toLowerCase();
    if (s === 'black') return 0;
    if (s === 'white' || s === 'white grey' || s === 'white gray' || s === 'off white' || s === 'offwhite') return 1;
    return 2;
  };
  return variants.slice().sort((a, b) => {
    const d = score(a.color) - score(b.color);
    if (d !== 0) return d;
    return (a.color || '').localeCompare(b.color || '');
  });
}

export async function GET() {
  const overrides = safeLoadOverrides();
  const itemsByModel = new Map(); // key: `${category}|${modelSlug}` -> { title, category, variants: [] }

  if (!fs.existsSync(PUBLIC_DIR)) {
    return NextResponse.json({ items: [] });
  }

  const catFolders = fs.readdirSync(PUBLIC_DIR)
    .filter(d => !isIgnored(d) && fs.statSync(path.join(PUBLIC_DIR, d)).isDirectory());

  for (const catFolder of catFolders) {
    const absFolder = path.join(PUBLIC_DIR, catFolder);
    const files = fs.readdirSync(absFolder).filter(f => !isIgnored(f) && VALID_EXT.test(f));

    for (const file of files) {
      const relImagePath = `/images/${catFolder}/${encodeURIComponent(file)}`;
      const category = folderToCategory(catFolder);

      const defaults = CATEGORY_DEFAULTS[category] || { price: 0, sizes: [] };

      const { modelSlug, modelTitle, color } = extractModelAndColor(file);
      const modelKey = `${category}|${modelSlug}`;

      // Per-BILD Override (fein-granular)
      const ov = overrides[relImagePath] || {};
      const price = ov.price ?? defaults.price;
      const sizes = ov.sizes ?? defaults.sizes;

      if (!itemsByModel.has(modelKey)) {
        itemsByModel.set(modelKey, {
          title: modelTitle,
          category,
          // Ein "Basispreis" und "Basissizes" vom ersten Variant (kannst du im Frontend verwenden)
          price,
          sizes,
          variants: []
        });
      }

      const entry = itemsByModel.get(modelKey);
      entry.variants.push({
        color,                    // z. B. "Black" / "White Grey" / null
        image: relImagePath,      // konkreter Pfad
        price,                    // Variante kann eigenen Preis haben (Override pro Bild)
        sizes                     // Variante kann eigene Sizes haben
      });
    }
  }

  // Endliste bauen: Hauptvariante sinnvoll wählen
  const items = [];
  for (const [, group] of itemsByModel) {
    const variantsSorted = sortVariants(group.variants);
    const main = variantsSorted[0];
    items.push({
      title: group.title,
      category: group.category,
      // Hauptbild/Preis/Sizes aus der bevorzugten Variante
      image: main.image,
      price: main.price,
      sizes: main.sizes,
      variants: variantsSorted
    });
  }

  return NextResponse.json({ items });
}
