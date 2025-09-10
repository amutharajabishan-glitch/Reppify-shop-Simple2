'use client';

import Link from 'next/link';

export default function CancelPage() {
  return (
    <main style={{minHeight:'60vh', padding: '40px', color:'#e8eefc', background:'#0b0f1a'}}>
      <h1>Zahlung abgebrochen</h1>
      <p>Deine Zahlung wurde abgebrochen. Du kannst es jederzeit erneut versuchen.</p>
      <div style={{marginTop:24}}>
        <Link href="/" style={{color:'#8fe8ff', textDecoration:'underline'}}>Zurück zum Shop</Link>
      </div>
    </main>
  );
}
