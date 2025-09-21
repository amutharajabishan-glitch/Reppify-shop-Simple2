'use client';
import { useMemo, useState } from 'react';
import data from '@/public/products.json'; // passt, wenn products.json in public/ liegt

const LABELS = {
  alle: 'Alle',
  pullover: 'Pullover',
  hoodies: 'Hoodies',
  jackets: 'Jackets',
  shoes: 'Shoes',
  accessories: 'Accessories',
  bags: 'Bags',
  caps: 'Caps',
  pants: 'Pants',
  tees: 'Tees',
  'sweatpants & jeans': 'Sweatpants & Jeans',
};

export default function Page() {
  const products = data.items ?? [];

  // alle Kategorien aus JSON
  const allCats = Array.from(new Set(products.map(p => (p.category || '').toLowerCase())));

  // Tabs: "alle" + sortierte Kategorien
  const tabs = ['alle', ...allCats];

  const [tab, setTab] = useState('alle');

  const shown = useMemo(() => {
    if (tab === 'alle') return products;
    return products.filter(p => (p.category || '').toLowerCase() === tab);
  }, [products, tab]);

  return (
    <main className="max-w-6xl mx-auto p-4">
      {/* Tabs */}
      <nav className="flex gap-2 mb-6 flex-wrap">
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1 rounded-full border ${
              t === tab ? 'bg-white/10 border-white' : 'border-white/30'
            }`}
          >
            {LABELS[t] || t}
          </button>
        ))}
      </nav>

      {/* Produkte */}
      <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {shown.map((p, i) => (
          <li
            key={p.id ?? `${p.title}-${i}`}
            className="rounded-lg p-4 border border-white/10"
          >
            <img
              src={p.image}
              alt={p.title}
              className="w-full h-56 object-cover rounded-md mb-3"
              loading="lazy"
            />
            <div className="font-semibold">{p.title}</div>
            <div className="opacity-70 text-sm">{p.category}</div>
            <div className="mt-1">CHF {Number(p.price).toFixed(2)}</div>
          </li>
        ))}
      </ul>
    </main>
  );
}
