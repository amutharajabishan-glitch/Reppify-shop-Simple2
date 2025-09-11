// lib/resend.js
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendOrderEmails({
  customerEmail,
  amount,
  currency,
  shipping,
  itemsText,
  sessionId,
}) {
  const from = process.env.FROM_EMAIL;      // z.B. "shop@reppify.ch"
  const toStore = process.env.STORE_EMAIL;  // z.B. "shop@reppify.ch"

  const totalCHF = amount != null ? (amount / 100).toFixed(2) : "—";
  const addr = shipping
    ? `${shipping?.name || ""}\n${shipping?.address?.line1 || ""} ${
        shipping?.address?.line2 || ""
      }\n${shipping?.address?.postal_code || ""} ${shipping?.address?.city || ""}\n${
        shipping?.address?.country || ""
      }`
    : "—";

  const customerBody =
    `Danke für deine Bestellung 🎉\n\n` +
    `Bestellnummer: ${sessionId}\n` +
    `Summe: ${totalCHF} ${currency?.toUpperCase()}\n\n` +
    `Artikel:\n${itemsText || "—"}\n\n` +
    `Lieferadresse:\n${addr}\n\n` +
    `Wir melden uns, sobald dein Paket unterwegs ist.\n\n` +
    `Dein REPPIFY Team`;

  const storeBody =
    `Neue Bestellung!\n\n` +
    `Bestellnummer: ${sessionId}\n` +
    `Kunde: ${customerEmail || "—"}\n` +
    `Summe: ${totalCHF} ${currency?.toUpperCase()}\n\n` +
    `Artikel:\n${itemsText || "—"}\n\n` +
    `Lieferadresse:\n${addr}`;

  // an Kunde
  if (customerEmail) {
    await resend.emails.send({
      from,
      to: customerEmail,
      subject: "REPPIFY – Bestellbestätigung",
      text: customerBody,
    });
  }

  // an euch
  await resend.emails.send({
    from,
    to: toStore,
    subject: "REPPIFY – Neue Bestellung",
    text: storeBody,
  });
}
