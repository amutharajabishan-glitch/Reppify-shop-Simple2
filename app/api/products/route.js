// app/api/products/route.js
import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

const PUBLIC_DIR = path.join(process.cwd(), 'public', 'images');
const VALID_EXT = /\.(jpg|jpeg|png|webp|gif)$/i;

function isIgnored(name) {
  const base = path.basename(name);
  if (base.startsWith('.')) return true;            // .DS_Store, ._resource, …
  if (base.toLowerCase() === '.ds_store') return true;
  return false;
}

function folderToCategory(folderName) {
  // Unsere Kategorien-Schlüssel
  const m = {
    shoes: 'shoes',
    caps: 'caps',
    hoodies: 'hoodies',
    tees: 'tees',
    pants: 'sweatpants-jeans',
    'sweatpants-jeans': 'sweatpants-jeans',
    bags: 'bags',
    accessories: 'accessories',
    parfum: 'parfum',
  };
  return m[folderName] || folderName;
}

export async function GET() {
  const items = [];

  if (!fs.existsSync(PUBLIC_DIR)) {
    return NextResponse.json({ items: [] });
  }

  const categories = fs.readdirSync(PUBLIC_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const cat of categories) {
    const catDir = path.join(PUBLIC_DIR, cat);
    const files = fs.readdirSync(catDir, { withFileTypes: true });

    for (const f of files) {
      const fullname = path.join(catDir, f.name);
      const base = f.name;

      if (isIgnored(base)) continue;
      if (!f.isFile() || !VALID_EXT.test(base)) continue;

      // saubere Titel aus Dateinamen
      const title = base
        .replace(/\.[a-z0-9]+$/i, '')
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      items.push({
        title,
        image: `/images/${cat}/${encodeURIComponent(base)}`,
        category: folderToCategory(cat),
        price: 0, // optional
        sizes: [], // optional
      });
    }
  }

  return NextResponse.json({ items });
}
