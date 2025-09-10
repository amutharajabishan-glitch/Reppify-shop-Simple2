'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function SuccessPage() {
  const params = useSearchParams();
  const sessionId = params.get('session_id');

  return (
    <main style={{minHeight:'60vh', padding: '40px', color:'#e8eefc', background:'#0b0f1a'}}>
      <h1>Danke für deine Bestellung 🎉</h1>
      <p>Wir haben deine Zahlung erhalten. Du bekommst gleich eine Bestellbestätigung per E-Mail.</p>

      {sessionId && (
        <p style={{opacity:.8, marginTop:10}}>Stripe Session ID: <code>{sessionId}</code></p>
      )}

      <div style={{marginTop:24}}>
        <Link href="/" style={{color:'#8fe8ff', textDecoration:'underline'}}>Zurück zum Shop</Link>
      </div>
    </main>
  );
}
