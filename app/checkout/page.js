'use client';

import { useEffect, useState } from 'react';

export default function CheckoutPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function startCheckout() {
    setError('');
    setBusy(true);
    try {
      const raw = localStorage.getItem('cart');
      const cart = raw ? JSON.parse(raw) : [];

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cart, email: email || undefined }),
      });

      const data = await res.json();
      if (!res.ok || !data?.url) {
        setError(data?.error || 'Checkout konnte nicht gestartet werden.');
        setBusy(false);
        return;
      }
      // Weiter zu Stripe
      window.location.href = data.url;
    } catch (e) {
      console.error(e);
      setError('Unerwarteter Fehler beim Checkout.');
      setBusy(false);
    }
  }

  useEffect(() => {
    // E-Mail vorfüllen, falls du später Clerk-User nutzt
    try {
      const c = globalThis?.Clerk;
      const userEmail = c?.user?.primaryEmailAddress?.emailAddress;
      if (userEmail) setEmail(userEmail);
    } catch {}
  }, []);

  return (
    <main style={{ padding: '40px', color: '#e8eefc', background: '#0b0f1a', minHeight: '100vh' }}>
      <h1 style={{ fontSize: '28px', marginBottom: '16px' }}>Checkout</h1>

      <div style={{ maxWidth: 540 }}>
        <p style={{ opacity: .8, marginBottom: 12 }}>
          Deine Zahlung läuft über Stripe. Adresse & Versand wählst du im nächsten Schritt.
        </p>

        <label style={{ display: 'block', marginBottom: 6 }}>E-Mail (für Bestellbestätigung)</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="dein@email.ch"
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 10,
            background: '#0d1424', border: '1px solid #1f2b44', color: '#dfe8ff', marginBottom: 12
          }}
        />

        {error && <div style={{ color: '#ffb3b3', marginBottom: 12 }}>{error}</div>}

        <button
          disabled={busy}
          onClick={startCheckout}
          style={{
            padding: '12px 16px', borderRadius: 12,
            background: 'linear-gradient(90deg, rgba(0,200,255,.25), rgba(0,200,255,.12))',
            border: '1px solid rgba(0,200,255,.35)', color: '#e8f9ff',
            boxShadow: '0 0 18px rgba(0,200,255,.35), inset 0 0 8px rgba(0,200,255,.25)',
            cursor: 'pointer'
          }}
        >
          {busy ? 'Weiter zu Stripe…' : 'Zur Zahlung mit Stripe'}
        </button>
      </div>
    </main>
  );
}
