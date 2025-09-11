// /lib/email.js
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Absender / Empfänger aus Env (du hast sie schon in Vercel)
const FROM = process.env.FROM_EMAIL || 'shop@reppify.ch';
const ADMIN = process.env.STORE_EMAIL || FROM;

function chf(n) {
  return `CHF ${Number(n || 0).toFixed(2)}`;
}

function renderItemsHtml(items = []) {
  if (!items.length) return '<p>(keine Positionen)</p>';
  const rows = items.map(it => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${it.name || it.description || 'Artikel'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${it.quantity || 1}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">${chf(it.unit)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">${chf(it.total)}</td>
    </tr>
  `).join('');
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #eee;">
      <thead>
        <tr style="background:#f8fafc">
          <th align="left" style="padding:10px 12px;">Artikel</th>
          <th align="center" style="padding:10px 12px;">Menge</th>
          <th align="right" style="padding:10px 12px;">Einzelpreis</th>
          <th align="right" style="padding:10px 12px;">Summe</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderOrderHtml(order) {
  const { number, customer, items, subtotal, shipping, total, note } = order || {};
  const addr = customer?.address || {};
  const addrHtml = `
    <div style="line-height:1.5">
      <div>${customer?.name || ''}</div>
      <div>${addr?.line1 || ''}</div>
      ${addr?.line2 ? `<div>${addr.line2}</div>` : ''}
      <div>${addr?.postal_code || ''} ${addr?.city || ''}</div>
      <div>${addr?.country || ''}</div>
      <div>${customer?.email || ''}</div>
    </div>
  `;

  return `
    <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
      <h2 style="margin:0 0 12px">Danke für deine Bestellung${customer?.name ? ', ' + customer.name : ''}!</h2>
      <p style="margin:0 0 16px;">Bestellnummer: <strong>${number || '-'}</strong></p>

      <h3 style="margin:24px 0 10px;">Bestellübersicht</h3>
      ${renderItemsHtml(items)}

      <div style="margin-top:12px;text-align:right">
        <div>Zwischensumme: <strong>${chf(subtotal)}</strong></div>
        <div>Versand/Fees: <strong>${chf(shipping)}</strong></div>
        <div style="font-size:18px;margin-top:6px">Gesamt: <strong>${chf(total)}</strong></div>
      </div>

      <h3 style="margin:24px 0 10px;">Lieferadresse</h3>
      ${addrHtml}

      ${note ? `<p style="margin-top:16px;"><em>Hinweis: ${note}</em></p>` : ''}
      <p style="margin-top:24px;">Wir melden uns, sobald das Paket unterwegs ist. 💙</p>
    </div>
  `;
}

function renderAdminHtml(order) {
  const { number, customer } = order || {};
  return `
    <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
      <h2 style="margin:0 0 12px">Neue Bestellung eingegangen</h2>
      <p style="margin:0 0 12px;">Bestellnummer: <strong>${number || '-'}</strong></p>
      <p style="margin:0 0 12px;">Kunde: <strong>${customer?.name || '-'}</strong> &lt;${customer?.email || '-'}&gt;</p>
      ${renderOrderHtml(order)}
    </div>
  `;
}

// Hauptfunktion: beide Mails schicken
export async function sendOrderEmails({ order, toEmail }) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY fehlt – keine Mails versendet');
    return;
  }

  const subjectNo = order?.number ? ` #${order.number}` : '';
  const subject = `Reppify – Bestellbestätigung${subjectNo}`;
  const adminSubject = `Neue Bestellung${subjectNo}`;

  // Kunde
  if (toEmail) {
    await resend.emails.send({
      from: FROM,
      to: toEmail,
      subject,
      html: renderOrderHtml(order),
      text: `Danke für deine Bestellung${subjectNo}. Gesamt: ${chf(order?.total)}.`,
      reply_to: ADMIN,
    });
  }

  // Admin
  await resend.emails.send({
    from: FROM,
    to: ADMIN,
    subject: adminSubject,
    html: renderAdminHtml(order),
    text: `Neue Bestellung${subjectNo} – Gesamt: ${chf(order?.total)} von ${order?.customer?.name || '-'} (${order?.customer?.email || '-'})`,
  });
}
