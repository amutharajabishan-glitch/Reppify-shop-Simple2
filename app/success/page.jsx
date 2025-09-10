// app/success/page.jsx
export const dynamic = "force-dynamic";  // verhindert SSG/Prerender
export const revalidate = 0;             // kein Cache

import Link from "next/link";

export default async function Success({ searchParams }) {
  const sessionId = searchParams?.session_id;

  if (!sessionId) {
    return (
      <main className="mx-auto max-w-xl p-6 text-center">
        <h1 className="text-3xl font-bold">Danke für deinen Einkauf! 🎉</h1>
        <p className="mt-2">Kein <code>session_id</code> Parameter gefunden.</p>
        <Link href="/" className="underline mt-4 inline-block">Zur Startseite</Link>
      </main>
    );
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL || "";

  const res = await fetch(
    `${baseUrl}/api/checkout/success?session_id=${sessionId}`,
    { cache: "no-store" }
  );

  let session = null;
  if (res.ok) {
    const data = await res.json();
    session = data?.session || null;
  }

  return (
    <main className="mx-auto max-w-xl p-6 text-center">
      <h1 className="text-3xl font-bold">Danke für deinen Einkauf! 🎉</h1>
      {session ? (
        <>
          <p className="mt-2">Bestellnummer: {session.id}</p>
          <p className="mt-1">Status: {session.payment_status}</p>
        </>
      ) : (
        <p className="mt-2">Zahlungsdetails konnten nicht geladen werden.</p>
      )}
      <Link href="/" className="underline mt-4 inline-block">Weiter shoppen</Link>
    </main>
  );
}
