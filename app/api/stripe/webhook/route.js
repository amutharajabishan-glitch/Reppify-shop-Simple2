// app/api/stripe/webhook/route.js
import Stripe from "stripe";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { sendOrderEmails } from "@/lib/resend";

export const runtime = "nodejs";       // wichtig: Node runtime (kein Edge)
export const dynamic = "force-dynamic"; // nicht cachen

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

export async function POST(req) {
  // 1) Stripe-Signatur & Rohkörper einlesen
  const sig = headers().get("stripe-signature");
  const rawBody = await req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("❌ Webhook verify failed:", err?.message);
    return new NextResponse("Bad signature", { status: 400 });
  }

  // 2) Auf das Event reagieren
  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      // Line Items dazuladen (für Produkte, Summen, Mengen)
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
        limit: 100,
      });

      // 3) E-Mails senden (Kunde + Shop)
      await sendOrderEmails({
        session,
        items: lineItems.data || [],
      });
    }
  } catch (err) {
    // Wichtig: Stripe retryt bei Fehlern — wir loggen, antworten aber 200,
    // sonst kommt das gleiche Event zigmal. Details in Vercel Logs prüfen.
    console.error("⚠️ Webhook handler error:", err);
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
