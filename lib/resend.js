// lib/resend.js
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Sendet E-Mails an Kunde + Shop nach Bestellung
 */
export async function sendOrderEmails({ session, items }) {
  const customerEmail = session.customer_details?.email;
  const customerName = session.customer_details?.name || "Kunde";
  const address = session.customer_details?.address;

  const products = items
    .map((item) => `- ${item.quantity} × ${item.description} (${(item.amount_total / 100).toFixed(2)} ${session.currency.toUpperCase()})`)
    .join("\n");

  const total = (session.amount_total / 100).toFixed(2) + " " + session.currency.toUpperCase();

  // ✉️ Mail an den Kunden
  await resend.emails.send({
    from: process.env.FROM_EMAIL,
    to: customerEmail,
    subject: "Bestellbestätigung – Reppify",
    text: `Hallo ${customerName},

vielen Dank für deine Bestellung bei Reppify! 🎉

Deine Bestellung:
${products}

Gesamtsumme: ${total}

Lieferadresse:
${address?.line1 || ""} ${address?.line2 || ""}
${address?.postal_code || ""} ${address?.city || ""}
${address?.country || ""}

Wir benachrichtigen dich, sobald deine Bestellung versendet wurde.

Viele Grüße,
dein Reppify-Team`,
  });

  // ✉️ Mail an den Shop (du)
  await resend.emails.send({
    from: process.env.FROM_EMAIL,
    to: process.env.STORE_EMAIL,
    subject: "Neue Bestellung eingegangen",
    text: `Neue Bestellung eingegangen ✅

Kunde: ${customerName}
E-Mail: ${customerEmail}

Produkte:
${products}

Gesamtsumme: ${total}

Lieferadresse:
${address?.line1 || ""} ${address?.line2 || ""}
${address?.postal_code || ""} ${address?.city || ""}
${address?.country || ""}`,
  });
}
