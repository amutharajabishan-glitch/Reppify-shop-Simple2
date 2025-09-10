// app/api/checkout/success/route.js
import { NextResponse } from "next/server";
import Stripe from "stripe";

// Stripe initialisieren (nutzt deine ENV-Var STRIPE_SECRET_KEY)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("session_id");
    if (!sessionId) {
      return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent", "line_items.data.price.product"],
    });

    // -------------------------------
    // OPTIONAL: Auto-E-Mail versenden
    // -------------------------------
    // Voraussetzungen:
    // 1) npm i resend
    // 2) ENV: RESEND_API_KEY=...
    // 3) Absenderdomain/Adresse bei Resend eingerichtet (z.B. shop@deinedomain.ch)
    //
    // Hinweis: Für 100% sichere Zustellung ist ein Stripe-Webhook besser.
    // Für "jetzt sofort" funktioniert es auch hier.
    /*
    if (session.payment_status === "paid" && session.customer_email) {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);

      const items = (session.line_items?.data || [])
        .map((li) => {
          const name =
            li.price?.product?.name ||
            li.description ||
            "Artikel";
          const qty = li.quantity || 1;
          const amount = (li.amount_total ?? 0) / 100;
          return `<li>${name} × ${qty} – CHF ${amount.toFixed(2)}</li>`;
        })
        .join("");

      const total = (session.amount_total ?? 0) / 100;

      await resend.emails.send({
        from: "shop@deinedomain.ch",
        to: session.customer_email,
        subject: "Bestellbestätigung",
        html: `
          <h1>Danke für deine Bestellung!</h1>
          <p>Bestellnummer: ${session.id}</p>
          <p>Status: ${session.payment_status}</p>
          <ul>${items}</ul>
          <p><strong>Total: CHF ${total.toFixed(2)}</strong></p>
        `,
      });
    }
    */

    return NextResponse.json({ session });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
