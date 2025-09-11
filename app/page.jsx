'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

/* ==============================
   Einstellungen
   ============================== */
const MIN_ORDER_CHF = 40;       // Mindestbestellwert
const FREE_SHIP_FROM_CHF = 100; // Gratis-Versand ab

const FALLBACK_PRICE = {
  shoes: 189,
  'sweatpants-jeans': 90,
  hoodies: 85,
  tees: 45,
  caps: 69,
  bags: 179,
  accessories: 40,
  parfum: 99,
  default: 129,
};

/* ==============================
   Helpers
   ============================== */
function formatLabel(key) {
  const map = {
    shoes: 'Schuhe & Slides',
    caps: 'Caps & Beanies',
    hoodies: 'Hoodies & Zippers',
    tees: 'Tees (T-Shirts)',
    'sweatpants-jeans': 'Sweatpants & Jeans',
    bags: 'Bags & Wallet',
    accessories: 'Accessoires',
    parfum: 'Parfum',
  };
  if (map[key]) return map[key];
  return String(key)
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function keyFromLabel(label) {
  const known = {
    'Schuhe & Slides': 'shoes',
    'Caps & Beanies': 'caps',
    'Hoodies & Zippers': 'hoodies',
    'Tees (T-Shirts)': 'tees',
    'SWEATPANTS & JEANS': 'sweatpants-jeans',
    'Sweatpants & Jeans': 'sweatpants-jeans',
    'Bags & Wallet': 'bags',
    Accessoires: 'accessories',
    Parfum: 'parfum',
  };
  if (known[label]) return known[label];
  return label.toLowerCase().replace(/\s+/g, '-');
}

/* Größen automatisch je Kategorie/Produkt ableiten */
function inferSizes(category, title = '') {
  const t = (title || '').toLowerCase();

  if (category === 'shoes') {
    return ['39', '40', '41', '42', '43', '44', '45', '46'];
  }
  if (['hoodies', 'tees', 'sweatpants-jeans'].includes(category)) {
    return ['S', 'M', 'L', 'XL'];
  }
  if (category === 'accessories' && (t.includes('belt') || t.includes('gürtel'))) {
    return ['80', '85', '90', '95', '100', '105', '110', '115'];
  }
  return ['One Size'];
}

function priceOf(p) {
  const cat = String(p.category || '').toLowerCase();
  const fall = FALLBACK_PRICE[cat] ?? FALLBACK_PRICE.default;
  return typeof p.price === 'number' && p.price > 0 ? p.price : fall;
}

/* ========== Clerk Helper (noch im Code, aber nicht mehr genutzt) ========== */
function getClerk() {
  if (typeof window === 'undefined') return null;
  const c = window.Clerk ?? null;
  return c && c.loaded ? c : null;
}
function isSignedIn() {
  try {
    const c = getClerk();
    return !!(c?.user || c?.session);
  } catch {
    return false;
  }
}
function safeOpenClerk(kind = 'signIn') {
  const c = getClerk();
  if (!c) {
    alert('Login/Registrieren ist noch nicht aktiviert (Clerk fehlt oder lädt noch).');
    return;
  }
  if (c.user) return;
  if (kind === 'signUp' && c.openSignUp) c.openSignUp();
  else if (c.openSignIn) c.openSignIn();
}

/* ==============================
   Seite
   ============================== */
export default function Home() {
  const router = useRouter();

  const [items, setItems] = useState([]);
  const [tabs, setTabs] = useState(['Alle']);
  const [active, setActive] = useState('Alle');
  const [sort, setSort] = useState('new');
  const [q, setQ] = useState('');

  const [cartOpen, setCartOpen] = useState(false);
  const [cart, setCart] = useState([]); // {id,title,price,size,qty,image}
  const [signedIn, setSignedIn] = useState(false);

  // ▼ NEU: Preis-Overrides laden
  const [priceMap, setPriceMap] = useState({});

  // Größe pro Produkt (Index) gemerkt
  const [selectedSize, setSelectedSize] = useState({}); // {idx: 'M'}

  /* Produkte laden */
  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await fetch('/api/products', { cache: 'no-store' });
      const json = await res.json();
      const raw = Array.isArray(json?.items) ? json.items : [];

      const normalized = raw.map((p) => {
        const title =
          p.title ||
          (p.image || '')
            .split('/')
            .pop()
            ?.replace(/\.[a-z0-9]+$/i, '')
            .replace(/[-_]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        const category = String(p.category || '').toLowerCase();
        const sizes =
          Array.isArray(p.sizes) && p.sizes.length > 0
            ? p.sizes
            : inferSizes(category, title);

        return {
          ...p,
          title,
          category,
          sizes,
        };
      });

      const setOfCats = new Set(normalized.map((p) => p.category).filter(Boolean));
      const dynamicTabs = ['Alle', ...Array.from(setOfCats).map(formatLabel)];

      if (alive) {
        setItems(normalized);
        setTabs(dynamicTabs);
        if (dynamicTabs.length === 2) setActive(dynamicTabs[1]);
      }
    })().catch(console.error);
    return () => { alive = false; };
  }, []);

  // ▼ NEU: price-overrides.json laden (einmal)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/price-overrides.json', { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          setPriceMap(json || {});
        }
      } catch (e) {
        console.warn('price-overrides.json nicht geladen:', e);
      }
    })();
  }, []);

  // ▼ NEU: einheitliche Preisfunktion
  function getPrice(p) {
    const k1 = p.image;
    const k2 = decodeURI(p.image || '');
    const k3 = encodeURI(p.image || '');
    const override =
      (k1 && priceMap[k1]) ??
      (k2 && priceMap[k2]) ??
      (k3 && priceMap[k3]);
    return typeof override === 'number' ? override : priceOf(p);
  }

  /* Cart ↔ localStorage */
  useEffect(() => {
    try {
      const raw = localStorage.getItem('cart');
      if (raw) setCart(JSON.parse(raw));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem('cart', JSON.stringify(cart));
    } catch {}
  }, [cart]);

  /* Clerk-Status (optional, kann später weg) */
  useEffect(() => {
    const update = () => setSignedIn(isSignedIn());
    update();
    const t = setInterval(update, 800);
    window.addEventListener('focus', update);
    return () => {
      clearInterval(t);
      window.removeEventListener('focus', update);
    };
  }, []);

  /* Filter + Sort */
  const filtered = useMemo(() => {
    let list = items;
    if (active !== 'Alle') {
      const key = keyFromLabel(active);
      list = list.filter((p) => p.category === key);
    }
    if (q.trim()) {
      const s = q.toLowerCase();
      list = list.filter((p) => (p.title || '').toLowerCase().includes(s));
    }
    if (sort === 'price_asc') list = list.slice().sort((a, b) => getPrice(a) - getPrice(b));
    if (sort === 'price_desc') list = list.slice().sort((a, b) => getPrice(b) - getPrice(a));
    return list;
  }, [items, active, sort, q, priceMap]);

  /* Cart-Berechnungen */
  const subtotal = cart.reduce((sum, it) => sum + it.price * it.qty, 0);
  const meetsMin = subtotal >= MIN_ORDER_CHF;
  const freeShip = subtotal >= FREE_SHIP_FROM_CHF;

  /* Aktionen */
  function addToCart(p, idx) {
    const size = selectedSize[idx] || (p.sizes?.[0] ?? 'One Size');
    const price = getPrice(p);
    setCart((prev) => {
      const key = `${p.image}__${size}`;
      const found = prev.find((x) => x.key === key);
      if (found) {
        return prev.map((x) => (x.key === key ? { ...x, qty: Math.max(1, x.qty + 1) } : x));
      }
      return [
        ...prev,
        {
          key,
          id: key,
          title: p.title,
          price,
          size,
          qty: 1,
          image: p.image,
        },
      ];
    });
    setCartOpen(true);
  }

  function changeQty(key, delta) {
    setCart((prev) =>
      prev
        .map((x) => (x.key === key ? { ...x, qty: Math.max(1, x.qty + delta) } : x))
        .filter((x) => x.qty > 0)
    );
  }

  function removeFromCart(key) {
    setCart((prev) => prev.filter((x) => x.key !== key));
  }

  /* ==============================
     Render
     ============================== */
  return (
    <main style={{ background: '#0b0f1a', minHeight: '100vh', color: '#e8eefc' }}>
      {/* NAVBAR */}
      <div style={{ position:'sticky', top:0, zIndex:50, backdropFilter:'blur(6px)', background:'rgba(0,0,0,.45)', borderBottom:'1px solid #1b253b' }}>
        <div className="container" style={{ height:56, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ fontWeight:700, letterSpacing:1.5, color:'#8fe8ff' }}>REPPIFY</div>

          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <button className="neon" onClick={() => setCartOpen(true)}>
              Warenkorb {cart.length ? `(${cart.reduce((n, x) => n + x.qty, 0)})` : ''}
            </button>

            <SignedOut>
              <SignInButton mode="modal">
                <button className="neon">Login</button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="neon">Registrieren</button>
              </SignUpButton>
            </SignedOut>

            <SignedIn>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </div>
        </div>
      </div>

      {/* Rest deiner Seite bleibt unverändert (Produkte, Warenkorb usw.) */}
      {/* ... */}
    </main>
  );
}
