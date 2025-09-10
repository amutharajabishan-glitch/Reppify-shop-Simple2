export const runtime = "nodejs";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // ENV-Hardcheck (liefert klare Meldungen)
    if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY missing");
    if (!process.env.FROM_EMAIL)     throw new Error("FROM_EMAIL missing");
    if (!process.env.STORE_EMAIL)    throw new Error("STORE_EMAIL missing");

    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);

    const sent = await resend.emails.send({
      from: process.env.FROM_EMAIL,      // z.B. shop@reppify.ch (Domain verified)
      to: process.env.STORE_EMAIL,       // deine echte Adresse
      subject: "Resend Test – Reppify",
      html: "<h1>It works 🎉</h1><p>/api/test-email</p>",
    });

    return NextResponse.json({ ok: true, id: sent?.data?.id ?? null });
  } catch (e) {
    console.error("TEST-EMAIL ERROR:", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
