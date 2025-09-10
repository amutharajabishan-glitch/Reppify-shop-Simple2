export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";

export default async function Success({ searchParams }) {
  const sessionId = searchParams?.session_id;
  let session = null;

  if (sessionId) {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || "";
    try {
      const r = await fetch(`${baseUrl}/api/checkout/success?session_id=${sessionId}`, { cache: "no-store" });
      if (r.ok) session = (await r.json())?.session || null;
    } catch {}
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
        <p className="mt-2">Details konnten nicht geladen werden – Mail kommt trotzdem.</p>
      )}
      <Link href="/" className="underline mt-4 inline-block">Weiter shoppen</Link>
    </main>
  );
}
