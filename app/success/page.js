'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function SuccessPage() {
  const sp = useSearchParams();
  const sessionId = sp.get('session_id');
  const [msg, setMsg] = useState('Danke! Deine Bestellung war erfolgreich.');

  useEffect(() => {
    if (!sessionId) return;
    // Optional: Hier könntest du /api/confirm?session_id=... aufrufen,
    // um z.B. E-Mails zu versenden oder DB zu aktualisieren.
  }, [sessionId]);

  return (
    <main style={{ padding: '40px', color: '#e8eefc', background: '#0b0f1a', minHeight: '100vh' }}>
      <h1 style={{ fontSize: '28px', marginBottom: '16px' }}>Bestellung erfolgreich 🎉</h1>
      <p>{msg}</p>
      {sessionId && <p style={{ opacity: .8, marginTop: 8 }}>Stripe Session ID: {sessionId}</p>}
    </main>
  );
}
