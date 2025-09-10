// app/api/stripe/webhook/route.js
import Stripe from "stripe";
import { NextResponse } from "next/server";

export const runtime = "nodejs";       // für raw body
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

export async function POST(req) {
  const signature = req.headers.get("stripe-signature");
  let event;

  try {
    const body = await req.text(); // RAW body, nicht JSON!
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return new NextResponse(`Webhook error: ${err.message}`, { status: 400 });
  }

  // Wir reagieren auf erfolgreiche Checkouts
  if (event.type === "checkout.session.completed") {
    const sess = event.data.object;

    try {
      // Details nachladen (Produkte/Zeilenpositionen)
      const full = await stripe.checkout.sessions.retrieve(sess.id, {
        expand: ["line_items.data.price.product", "customer", "payment_intent"],
      });

      // Empfänger ermitteln
      const to = full.customer_email
        || full.customer_details?.email
        || process.env.STORE_EMAIL;

      // Bestellübersicht als HTML
      const itemsHtml = (full.line_items?.data || [])
        .map(li => {
          const name = li.price?.product?.name || li.description || "Artikel";
          const qty = li.quantity || 1;
          const amt = ((li.amount_total ?? 0) / 100).toFixed(2);
          return `<li>${name} × ${qty} – CHF ${amt}</li>`;
        })
        .join("");

      const total = ((full.amount_total ?? 0) / 100).toFixed(2);

      // E-Mail via Resend senden
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);

      // an Kunde
      await resend.emails.send({
        from: process.env.FROM_EMAIL,
        to,
        subject: "Bestellbestätigung – Reppify",
        html: `
          <h1>Danke für deine Bestellung! 🎉</h1>
          <p>Bestellnummer: ${full.id}</p>
          <ul>${itemsHtml}</ul>
          <p><strong>Total: CHF ${total}</strong></p>
          <p>Wir melden uns, sobald die Bestellung versendet wurde.</p>
        `,
      });

      // Kopie an Shop (optional)
      if (process.env.STORE_EMAIL && process.env.STORE_EMAIL !== to) {
        await resend.emails.send({
          from: process.env.FROM_EMAIL,
          to: process.env.STORE_EMAIL,
          subject: `Neue Bestellung: ${full.id}`,
          html: `
            <h2>Neue Bestellung</h2>
            <p>Kunde: ${to}</p>
            <ul>${itemsHtml}</ul>
            <p><strong>Total: CHF ${total}</strong></p>
          `,
        });
      }
    } catch (e) {
      console.error("Email send error:", e);
      // trotzdem 200 zurückgeben, damit Stripe nicht endlos retried
    }
  }

  return NextResponse.json({ received: true });
}
