// app/checkout/page.jsx
'use client';

import { useEffect, useState } from 'react';

export default function CheckoutPage() {
  const [email, setEmail] = useState('');
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  // Warenkorb aus localStorage laden
  useEffect(() => {
    try {
      const raw = localStorage.getItem('cart');
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) setCart(parsed);
    } catch (e) {
      console.warn('Konnte cart nicht laden:', e);
    }
  }, []);

  async function startCheckout() {
    setErr('');
    if (!cart.length) {
      setErr('Warenkorb ist leer.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cart, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Checkout fehlgeschlagen');
      if (data?.url) {
        // zu Stripe weiterleiten
        window.location.href = data.url;
      } else {
        throw new Error('Keine Checkout-URL erhalten.');
      }
    } catch (e) {
      setErr(e.message || 'Fehler beim Checkout');
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', background: '#0b0f1a', color: '#e8eefc' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 16px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: .3 }}>Checkout</h1>
        <p style={{ opacity: .85, marginTop: 6 }}>
          Deine Zahlung läuft über Stripe. Adresse &amp; Versand wählst du im nächsten Schritt.
        </p>

        <label style={{ display: 'block', marginTop: 18, marginBottom: 8, opacity: .9 }}>
          E-Mail (für Bestellbestätigung)
        </label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="dein@mail.ch"
          type="email"
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 10,
            background: '#0d1424', border: '1px solid #1f2b44', color: '#dfe8ff'
          }}
        />

        {!!err && (
          <div style={{ marginTop: 12, color: '#ffb3b3' }}>{err}</div>
        )}

        <button
          onClick={startCheckout}
          disabled={loading}
          style={{
            marginTop: 16, padding: '10px 14px', borderRadius: 12, cursor: 'pointer',
            background: 'linear-gradient(90deg, rgba(0,200,255,.25), rgba(0,200,255,.12))',
            border: '1px solid rgba(0,200,255,.35)', color: '#e8f9ff'
          }}
        >
          {loading ? 'Weiter zu Stripe…' : 'Zur Zahlung mit Stripe'}
        </button>
      </div>
    </main>
  );
}
