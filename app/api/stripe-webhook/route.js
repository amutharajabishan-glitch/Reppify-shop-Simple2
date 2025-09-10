import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { Resend } from "resend";

export const config = {
  api: {
    bodyParser: false,
  },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

// Raw-Body lesen (für Stripe-Signaturprüfung)
async function getRawBody(req) {
  const chunks = [];
  const reader = req.body.getReader();
  let done, value;
  while ((({ done, value } = await reader.read()), !done)) {
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export async function POST(req) {
  const sig = headers().get("stripe-signature");
  const buf = await getRawBody(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verify error:", err.message);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      // Optional: Line-Items holen
      const full = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ["line_items.data.price.product"],
      });

      const items = (full?.line_items?.data || []).map((li) => ({
        name: li.description || li.price?.product?.name || "Produkt",
        qty: li.quantity || 1,
        total: ((li.amount_total || 0) / 100).toFixed(2),
      }));

      const customerEmail = session.customer_details?.email || session.customer_email;
      const totalCHF = ((session.amount_total || 0) / 100).toFixed(2);

      // 1) Mail an Kunden
      if (customerEmail) {
        await resend.emails.send({
          from: process.env.FROM_EMAIL,
          to: customerEmail,
          subject: "Bestellbestätigung – Reppify",
          html: `
            <div style="font-family:system-ui,Arial,sans-serif">
              <h2>Danke für deine Bestellung! 🙌</h2>
              <p>Wir bereiten deine Bestellung vor.</p>
              <p><strong>Bestellsumme:</strong> CHF ${totalCHF}</p>
              <h3>Artikel:</h3>
              <ul>
                ${items.map(i => `<li>${i.qty}× ${i.name} – CHF ${i.total}</li>`).join("")}
              </ul>
              <p>Du bekommst eine weitere Mail, sobald die Ware versendet wurde.</p>
              <p>– Dein Reppify Team</p>
            </div>
          `,
        });
      }

      // 2) Mail an dich (Shop)
      await resend.emails.send({
        from: process.env.FROM_EMAIL,
        to: process.env.STORE_EMAIL,
        subject: "Neue Bestellung (Stripe bezahlt) – Reppify",
        html: `
          <div style="font-family:system-ui,Arial,sans-serif">
            <h2>Neue bezahlte Bestellung</h2>
            <p><strong>Kunde:</strong> ${customerEmail || "unbekannt"}</p>
            <p><strong>Gesamtsumme:</strong> CHF ${totalCHF}</p>
            <h3>Artikel:</h3>
            <ul>
              ${items.map(i => `<li>${i.qty}× ${i.name} – CHF ${i.total}</li>`).join("")}
            </ul>
            <p>Session-ID: ${session.id}</p>
          </div>
        `,
      });
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("Webhook handler error:", e);
    return new NextResponse("Webhook handler error", { status: 500 });
  }
}
