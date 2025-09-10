// app/api/test-email/route.js
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);

    const result = await resend.emails.send({
      from: process.env.FROM_EMAIL,
      to: process.env.STORE_EMAIL,
      subject: "Resend Test – Reppify",
      html: "<h1>It works 🎉</h1><p>Smoke test via /api/test-email.</p>",
    });

    return NextResponse.json({ ok: true, result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
