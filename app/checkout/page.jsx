'use client';

import { useEffect, useState } from 'react';

export default function CheckoutPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  // E-Mail aus localStorage vorbefüllen (falls du die irgendwo speicherst)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('checkout_email');
      if (saved) setEmail(saved);
    } catch {}
  }, []);

  async function goStripe() {
    setMsg('');
    setLoading(true);
    try {
      // Warenkorb laden
      const raw = localStorage.getItem('cart');
      const cart = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(cart) || cart.length === 0) {
        setMsg('Dein Warenkorb ist leer.');
        setLoading(false);
        return;
      }

      // Email merken
      try { localStorage.setItem('checkout_email', email || ''); } catch {}

      // Session anfordern
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cart, email }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMsg(data?.error || 'Fehler beim Erstellen der Zahlung.');
        setLoading(false);
        return;
      }

      if (data?.url) {
        window.location.href = data.url; // zu Stripe weiterleiten
        return;
      }

      setMsg('Unerwartete Antwort vom Server.');
    } catch (e) {
      console.error(e);
      setMsg('Technischer Fehler.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', background: '#0b0f1a', color: '#e8eefc' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
        <h1>Checkout</h1>
        <p>Deine Zahlung läuft über Stripe. Adresse & Versand wählst du im nächsten Schritt.</p>

        <label style={{ display: 'block', margin: '16px 0 6px' }}>
          E-Mail (für Bestellbestätigung)
        </label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 10,
            background: '#0d1424',
            border: '1px solid #1f2b44',
            color: '#dfe8ff',
          }}
        />

        {!!msg && (
          <div style={{ marginTop: 12, color: '#ff9f9f' }}>
            {msg}
          </div>
        )}

        <button
          onClick={goStripe}
          disabled={loading}
          style={{
            marginTop: 16,
            padding: '10px 14px',
            borderRadius: 12,
            border: '1px solid rgba(0,200,255,.35)',
            background: 'linear-gradient(90deg, rgba(0,200,255,.25), rgba(0,200,255,.12))',
            color: '#e8f9ff',
          }}
        >
          {loading ? 'Lade…' : 'Zur Zahlung mit Stripe'}
        </button>
      </div>
    </main>
  );
}
