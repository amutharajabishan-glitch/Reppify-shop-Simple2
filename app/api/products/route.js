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
  const f = String(folderName).toLowerCase();
  switch (f) {
    case 'shoes': return 'Shoes';
    case 'slides': return 'Slides';
    case 'hoodies': 
    case 'hoodies & zippers':
    case 'hoodies-zippers':
    case 'hoodies_zippers':
      return 'Hoodies & Zippers';
    case 'tees': return 'Tees';
    case 'pants':
    case 'sweatpants':
    case 'sweatpants & jeans':
    case 'sweatpants-jeans':
    case 'sweatpants_jeans':
    case 'jeans':
      return 'Sweatpants & Jeans';
    case 'caps':
    case 'beanies':
    case 'caps & beanies':
    case 'caps-beanies':
    case 'caps_beanies':
      return 'Caps & Beanies';
    case 'bags':
    case 'wallets':
    case 'bags & wallets':
    case 'bags-wallets':
    case 'bags_wallets':
      return 'Bags & Wallets';
    case 'accessories': return 'Accessories';
    case 'parfum': return 'Parfum';
    case 'jackets': return 'Jackets';
    case 'pullover': return 'Pullover';
    default:
      // Fallback: Capitalize first letter
      return f.charAt(0).toUpperCase() + f.slice(1);
  }
}

function titleFromFilename(file) {
  const base = path.basename(file).replace(/\.[^/.]+$/, '');
  return base
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

export async function GET() {
  const items = [];
  if (!fs.existsSync(PUBLIC_DIR)) {
    return NextResponse.json({ items });
  }

  const cats = fs.readdirSync(PUBLIC_DIR).filter(d => !isIgnored(d) && fs.statSync(path.join(PUBLIC_DIR, d)).isDirectory());
  for (const cat of cats) {
    const folder = path.join(PUBLIC_DIR, cat);
    const files = fs.readdirSync(folder).filter(f => !isIgnored(f) && VALID_EXT.test(f));

    for (const base of files) {
      const title = titleFromFilename(base);
      items.push({
        title,
        image: `/images/${cat}/${encodeURIComponent(base)}`,
        category: folderToCategory(cat),
        price: 0,      // optional: you can set defaults here or enrich elsewhere
        sizes: [],     // optional
      });
    }
  }
  return NextResponse.json({ items });
}
