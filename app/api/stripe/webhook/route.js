// app/api/stripe/webhook/route.js
import Stripe from "stripe";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { sendOrderEmails } from "@/lib/resend";

export const runtime = "nodejs";          // nicht edge!
export const dynamic = "force-dynamic";   // kein Cache
export const preferredRegion = "fra1";    // optional

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-11-20.acacia",
});

export async function POST(req) {
  const sig = headers().get("stripe-signature");
  const buf = Buffer.from(await req.arrayBuffer());

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      // Artikel abrufen
      let itemsText = "";
      try {
        const li = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });
        itemsText = li.data
          .map(
            (i) =>
              `${i.quantity} x ${i.description} – ${(i.amount_total / 100).toFixed(2)} ${i.currency.toUpperCase()}`
          )
          .join("\n");
      } catch {
        // optional ignorieren
      }

      await sendOrderEmails({
        customerEmail: session.customer_details?.email,
        amount: session.amount_total,
        currency: session.currency,
        shipping: {
          name: session.customer_details?.name,
          address: session.customer_details?.address,
        },
        itemsText,
        sessionId: session.id,
      });
    }

    // weitere Events falls nötig …
    return NextResponse.json({ received: true });
  } catch (e) {
    // swallow, damit Stripe nicht endlos retried, aber loggen:
    console.error("Webhook handler error:", e);
    return new NextResponse("ok", { status: 200 });
  }
}
