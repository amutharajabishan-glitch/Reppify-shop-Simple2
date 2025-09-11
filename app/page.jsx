'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs';

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

  // ▼ Preis-Overrides laden
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

  // price-overrides.json laden (einmal)
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

  // Einheits-Preisfunktion (nutzt Overrides, sonst Fallback)
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
      {/* Styles */}
      <style>{`
        .container { max-width: 1280px; margin: 0 auto; padding: 0 16px; }
        .neon { background: rgba(0,200,255,.18); color:#c7f6ff; border:1px solid rgba(0,200,255,.5);
                border-radius:10px; padding:8px 12px; box-shadow:0 0 18px rgba(0,200,255,.4);
                cursor:pointer; transition:.2s }
        .neon:hover { background: rgba(0,200,255,.28); }
        .chip { padding:8px 14px; border-radius:999px; border:1px solid #1f2b44; background:transparent; color:#dfe8ff; }
        .chip.active { background: rgba(0,200,255,.12); box-shadow:0 0 12px rgba(0,200,255,.35); }
        .grid-5 { display:grid; gap:16px; grid-template-columns:1fr; }
        @media (min-width:640px){ .grid-5{ grid-template-columns:repeat(2,1fr);} }
        @media (min-width:900px){ .grid-5{ grid-template-columns:repeat(3,1fr);} }
        @media (min-width:1200px){ .grid-5{ grid-template-columns:repeat(4,1fr);} }
        @media (min-width:1450px){ .grid-5{ grid-template-columns:repeat(5,1fr);} }
        .card{ background:#0f1629; border:1px solid #1f2b44; border-radius:16px; overflow:hidden; box-shadow:0 0 18px rgba(0,0,0,.35); }
        .imgwrap{ width:100%; height:220px; overflow:hidden; border-bottom:1px solid #1f2b44; background:#0b1222; }
        .img{ width:100%; height:100%; object-fit:cover; display:block; }
        .price{ margin-top:6px; font-weight:700; }
        .drawer { position: fixed; top:0; right:0; height:100%; width: 360px; max-width: 90vw; background:#0f1629; border-left:1px solid #1f2b44; box-shadow:-10px 0 40px rgba(0,0,0,.4); transform: translateX(100%); transition: transform .25s; z-index:80; display:flex; flex-direction:column; }
        .drawer.open { transform: translateX(0%); }
        .backdrop { position:fixed; inset:0; background:rgba(0,0,0,.45); z-index:70; }
        .row { display:flex; gap:10px; align-items:center; }
        .btn { width:100%; padding:10px 12px; background:linear-gradient(90deg, rgba(0,200,255,.25), rgba(0,200,255,.12)); border:1px solid rgba(0,200,255,.35); color:#e8f9ff; border-radius:12px; box-shadow:0 0 18px rgba(0,200,255,.35), inset 0 0 8px rgba(0,200,255,.25); cursor:pointer; }
        .btn:disabled { opacity:.6; cursor:not-allowed; }
      `}</style>

      {/* NAVBAR */}
      <div style={{ position:'sticky', top:0, zIndex:50, backdropFilter:'blur(6px)', background:'rgba(0,0,0,.45)', borderBottom:'1px solid #1b253b' }}>
        <div className="container" style={{ height:56, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ fontWeight:700, letterSpacing:1.5, color:'#8fe8ff' }}>REPPIFY</div>

          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <button className="neon" onClick={() => setCartOpen(true)}>
              Warenkorb {cart.length ? `(${cart.reduce((n, x) => n + x.qty, 0)})` : ''}
            </button>

            {/* Clerk: signed out → zeigen SignIn/SignUp Buttons (Modal) */}
            <SignedOut>
              <SignInButton mode="modal">
                <button className="neon">Login</button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="neon">Registrieren</button>
              </SignUpButton>
            </SignedOut>

            {/* Clerk: signed in → UserButton + Profil */}
            <SignedIn>
              <UserButton />
              <button
                className="neon"
                onClick={() => {
                  const c = window.Clerk;
                  if (c?.user) {
                    alert(`Eingeloggt als: ${c.user?.primaryEmailAddress?.emailAddress || c.user?.username || 'User'}`);
                  }
                }}
              >
                Profil
              </button>
            </SignedIn>
          </div>
        </div>
      </div>

      {/* BANNER */}
      <div className="container" style={{ paddingTop:16 }}>
        <img
          src="/reppify-banner.jpg"
          alt="Banner"
          style={{
            width: '100%',
            height: 320,
            objectFit: 'cover',
            borderRadius: 18,
            border: '1px solid #162238',
            display: 'block',
            boxShadow: '0 0 26px rgba(0,200,255,.12)',
          }}
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      </div>

      {/* TOOLBAR */}
      <div className="container" style={{ marginTop: 12, display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
        {tabs.map((t) => (
          <button
            key={t}
            className={'chip' + (active === t ? ' active' : '')}
            onClick={() => setActive(t)}
          >
            {t}
          </button>
        ))}

        <input
          placeholder="Suche nach Produkt…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{
            marginLeft: 'auto',
            padding: '8px 12px',
            borderRadius: 10,
            background: '#0d1424',
            border: '1px solid #1f2b44',
            color: '#dfe8ff',
            minWidth: 220,
          }}
        />

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="chip"
          style={{ borderRadius:10 }}
        >
          <option value="new">Sortieren: Neu</option>
          <option value="price_asc">Preis ↑</option>
          <option value="price_desc">Preis ↓</option>
        </select>
      </div>

      {/* PRODUKTE */}
      <div className="container" style={{ padding: '12px 0 40px' }}>
        <div className="grid-5">
          {filtered.map((p, idx) => (
            <div className="card" key={p.image + idx}>
              <div className="imgwrap">
                <img
                  className="img"
                  src={encodeURI(p.image)}
                  alt={p.title}
                  onError={(e) => (e.currentTarget.src = '/images/placeholder.jpg')}
                />
              </div>
              <div style={{ padding: 12 }}>
                <div style={{ fontWeight: 700, lineHeight: 1.25 }}>{p.title}</div>
                <div style={{ opacity: .7, fontSize: 13, marginTop: 6 }}>{formatLabel(p.category)}</div>

                <div className="price">CHF {getPrice(p).toFixed(2)}</div>

                {!!(p.sizes?.length) && (
                  <div style={{ marginTop:10 }}>
                    <select
                      className="chip"
                      value={selectedSize[idx] || p.sizes[0]}
                      onChange={(e) => setSelectedSize((s) => ({ ...s, [idx]: e.target.value }))}
                      style={{ width:'100%' }}
                    >
                      {p.sizes.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={{ marginTop: 12 }}>
                  <button className="btn" onClick={() => addToCart(p, idx)}>In den Warenkorb</button>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ opacity:.7, padding: 12 }}>Keine Produkte gefunden.</div>
          )}
        </div>
      </div>

      {/* CART DRAWER */}
      {cartOpen && <div className="backdrop" onClick={() => setCartOpen(false)} />}
      <aside className={'drawer' + (cartOpen ? ' open' : '')} role="dialog" aria-label="Warenkorb">
        <div style={{ padding:12, borderBottom:'1px solid #1f2b44', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ fontWeight:700 }}>Warenkorb</div>
          <button className="neon" onClick={() => setCartOpen(false)}>Schließen</button>
        </div>

        <div style={{ padding:12, overflow:'auto', flex:1, display:'flex', flexDirection:'column', gap:10 }}>
          {cart.length === 0 && <div style={{ opacity:.7 }}>Dein Warenkorb ist leer.</div>}

          {cart.map((it) => (
            <div key={it.key} style={{ display:'grid', gridTemplateColumns:'64px 1fr auto', gap:10, alignItems:'center', border:'1px solid #1f2b44', borderRadius:10, padding:8 }}>
              <img src={encodeURI(it.image)} alt={it.title} style={{ width:64, height:64, objectFit:'cover', borderRadius:8 }} />
              <div>
                <div style={{ fontWeight:600 }}>{it.title}</div>
                <div style={{ fontSize:12, opacity:.8 }}>Größe: {it.size}</div>
                <div style={{ marginTop:4, fontWeight:700 }}>CHF {it.price.toFixed(2)}</div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6, alignItems:'flex-end' }}>
                <div className="row">
                  <button className="neon" onClick={() => changeQty(it.key, -1)}>-</button>
                  <div style={{ width:36, textAlign:'center' }}>{it.qty}</div>
                  <button className="neon" onClick={() => changeQty(it.key, +1)}>+</button>
                </div>
                <button className="neon" onClick={() => removeFromCart(it.key)}>Entfernen</button>
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding:12, borderTop:'1px solid #1f2b44' }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
            <div>Zwischensumme</div>
            <div style={{ fontWeight:700 }}>CHF {subtotal.toFixed(2)}</div>
          </div>

          {!meetsMin && (
            <div style={{ marginBottom:8, color:'#ffd28c' }}>
              Mindestbestellwert: CHF {MIN_ORDER_CHF.toFixed(2)} (es fehlen CHF {(MIN_ORDER_CHF - subtotal).toFixed(2)})
            </div>
          )}

          {freeShip ? (
            <div style={{ marginBottom:8, color:'#7cfdaa' }}>
              🎉 Gratis Versand erreicht (ab CHF {FREE_SHIP_FROM_CHF.toFixed(2)})
            </div>
          ) : (
            <div style={{ marginBottom:8, opacity:.8 }}>
              Gratis Versand ab CHF {FREE_SHIP_FROM_CHF.toFixed(2)} – es fehlen CHF {(FREE_SHIP_FROM_CHF - subtotal).toFixed(2)}
            </div>
          )}

          <button
            className="btn"
            disabled={!meetsMin}
            onClick={() => router.push('/checkout')}
          >
            Zur Kasse
          </button>
        </div>
      </aside>
    </main>
  );
}
