// /lib/email.js
import { sendMail } from "./mailer";
import { Resend } from "resend";

// Optionaler Resend-Client (nur wenn RESEND_API_KEY gesetzt ist)
const resend =
  process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

function fmtAmount(a, currency = "CHF") {
  try {
    return new Intl.NumberFormat("de-CH", { style: "currency", currency }).format(a);
  } catch {
    return `${a?.toFixed ? a.toFixed(2) : a} ${currency}`;
  }
}

function addressToLines(addr = {}) {
  if (!addr) return [];
  const lines = [];
  if (addr.name) lines.push(addr.name);
  const line = [addr.line1, addr.line2].filter(Boolean).join(", ");
  if (line) lines.push(line);
  const city = [addr.postal_code, addr.city].filter(Boolean).join(" ");
  if (city) lines.push(city);
  if (addr.state) lines.push(addr.state);
  if (addr.country) lines.push(addr.country);
  return lines;
}

function itemsTableHTML(items = [], currency = "CHF") {
  if (!items?.length) return "<p>(keine Positionsdaten verfügbar)</p>";
  const rows = items.map(it => `
      <tr>
        <td style="padding:6px 8px;border:1px solid #eee;">${it.name}</td>
        <td style="padding:6px 8px;border:1px solid #eee;text-align:center;">${it.qty}</td>
        <td style="padding:6px 8px;border:1px solid #eee;text-align:right;">${fmtAmount(it.amount, currency)}</td>
      </tr>
  `).join("");
  return `
    <table style="border-collapse:collapse;border:1px solid #eee;width:100%;max-width:640px;">
      <thead>
        <tr>
          <th style="padding:6px 8px;border:1px solid #eee;text-align:left;">Artikel</th>
          <th style="padding:6px 8px;border:1px solid #eee;text-align:center;">Menge</th>
          <th style="padding:6px 8px;border:1px solid #eee;text-align:right;">Betrag</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

export async function sendOrderEmails({ toCustomer, storeEmail, order }) {
  const {
    id,
    total = 0,
    currency = "CHF",
    email,
    name,
    address,
    items = [],
  } = order || {};

  const addressLines = addressToLines({ ...(address || {}), name });

  const orderSummaryHTML = `
    <p><b>Bestellnummer:</b> ${id || "-"}</p>
    <p><b>Summe:</b> ${fmtAmount(total, currency)}</p>
    ${itemsTableHTML(items, currency)}
    <p style="margin-top:10px;"><b>Lieferadresse</b><br>${addressLines.join("<br>")}</p>
  `;

  const customerHtml = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
      <h2>Danke für deine Bestellung bei REPPIFY 🎉</h2>
      <p>Wir haben deine Bestellung erhalten und bearbeiten sie schnellstmöglich.</p>
      ${orderSummaryHTML}
      <p style="margin-top:14px;">Fragen? Antworte einfach auf diese E-Mail.</p>
    </div>
  `;
  const customerText =
    `Danke für deine Bestellung bei REPPIFY!\n\n` +
    `Bestellnummer: ${id || "-"}\n` +
    `Summe: ${fmtAmount(total, currency)}\n\n` +
    (addressLines.length ? `Lieferadresse:\n${addressLines.join("\n")}\n\n` : "") +
    `Viele Grüße\nREPPIFY`;

  const adminHtml = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
      <h2>Neue Bestellung</h2>
      <p><b>Kunde:</b> ${name || "-"} &lt;${email || toCustomer || "-"}&gt;</p>
      ${orderSummaryHTML}
    </div>
  `;
  const adminText =
    `Neue Bestellung\n\n` +
    `Bestellnummer: ${id || "-"}\n` +
    `Kunde: ${name || "-"} <${email || toCustomer || "-"}>\n` +
    `Summe: ${fmtAmount(total, currency)}\n\n` +
    (addressLines.length ? `Lieferadresse:\n${addressLines.join("\n")}\n\n` : "") +
    `— Ende —`;

  // Absender: bevorzugt FROM_EMAIL (für Resend verifiziert), sonst SMTP_FROM/SMTP_USER
  const fromAddr =
    process.env.FROM_EMAIL ||
    process.env.SMTP_FROM ||
    process.env.SMTP_USER ||
    "shop@reppify.ch";

  // Hilfsfunktion: über Resend senden (wenn verfügbar), sonst SMTP-Fallback
  async function sendEither({ to, subject, html, text, replyTo, headers }) {
    if (resend) {
      // → Resend: erscheint im Resend-Dashboard inkl. Header/Reply-To
      return resend.emails.send({
        from: fromAddr,   // z.B. "Reppify <shop@reppify.ch>"
        to,
        subject,
        html,
        text,
        reply_to: replyTo,
        headers,          // X-Order-ID etc. für Suche/Filter
      });
    }
    // → SMTP-Fallback
    return sendMail({
      to,
      subject,
      html,
      text,
      replyTo,
      headers, // viele SMTP-Server akzeptieren Custom-Header
    });
  }

  // Kunde (Bestellbestätigung)
  if (toCustomer) {
    await sendEither({
      to: toCustomer,
      subject: `REPPIFY – Bestellbestätigung ${id ? `#${id}` : ""}`,
      html: customerHtml,
      text: customerText,
      replyTo: fromAddr, // Kunde antwortet an shop@
      headers: {
        "X-Order-ID": id || "",
        "X-Customer-Email": email || toCustomer || "",
        "X-Order-Total": `${total} ${currency}`,
      },
    });
  }

  // Team/Admin (an dein Postfach)
  if (storeEmail) {
    await sendEither({
      to: storeEmail,
      subject: `Neue Bestellung ${id ? `#${id}` : ""} – ${fmtAmount(total, currency)}`,
      html: adminHtml,
      text: adminText,
      replyTo: email || toCustomer || fromAddr, // Antwort geht an den Kunden
      headers: {
        "X-Order-ID": id || "",
        "X-Customer-Email": email || toCustomer || "",
        "X-Order-Total": `${total} ${currency}`,
      },
    });
  }

  return { ok: true };
}
