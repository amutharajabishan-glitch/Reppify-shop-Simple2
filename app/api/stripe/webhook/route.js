import Stripe from "stripe";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req) {
  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature");

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Invalid signature:", err?.message);
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const items = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });

      const email = session.customer_details?.email || "(keine E-Mail)";
      const name  = session.customer_details?.name  || "(kein Name)";
      const addr  = session.customer_details?.address;

      const html = `
        <h2>Neue Bestellung</h2>
        <p><b>Kunde:</b> ${name} &lt;${email}&gt;</p>
        <p><b>Betrag:</b> ${(session.amount_total/100).toFixed(2)} ${session.currency.toUpperCase()}</p>
        <p><b>Adresse:</b><br>
          ${addr?.line1 ?? ""} ${addr?.line2 ?? ""}<br>
          ${addr?.postal_code ?? ""} ${addr?.city ?? ""}, ${addr?.country ?? ""}
        </p>
        <h3>Artikel</h3>
        <ul>
          ${items.data.map(it => `<li>${it.quantity} × ${it.description} — ${(it.amount_total/100).toFixed(2)} ${session.currency.toUpperCase()}</li>`).join("")}
        </ul>
        <p>Stripe Session: ${session.id}</p>
      `;

      await resend.emails.send({
        from: "Reppify <shop@reppify.ch>",
        to: "shop@reppify.ch",
        subject: `Neue Bestellung – ${session.id}`,
        html
      });
    }
    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("Webhook handler error:", err);
    return new Response("Webhook error", { status: 500 });
  }
}
