import { NextResponse } from 'next/server';
import { Resend } from 'resend';

export async function POST(req) {
  try {
    const { customer, cart, subtotal, freeShip } = await req.json();

    if (!customer?.email || !Array.isArray(cart) || cart.length === 0) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const resendKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.FROM_EMAIL || 'Reppify <noreply@reppify.ch>';
    const storeEmail = process.env.STORE_EMAIL || 'orders@reppify.ch';

    if (!resendKey) {
      return NextResponse.json({ error: 'Missing RESEND_API_KEY' }, { status: 500 });
    }

    const resend = new Resend(resendKey);

    const lines = cart.map(
      (i) =>
        `<tr>
           <td style="padding:8px 12px;border-bottom:1px solid #eee">${escapeHtml(i.title)} (${escapeHtml(
            i.size
          )}) ×${i.qty}</td>
           <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right">CHF ${(i.price * i.qty).toFixed(
             2
           )}</td>
         </tr>`
    ).join('');

    const table = `
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-family:Arial,sans-serif">
        <tbody>${lines}</tbody>
        <tfoot>
          <tr>
            <td style="padding:8px 12px;text-align:right;font-weight:bold">Zwischensumme</td>
            <td style="padding:8px 12px;text-align:right;font-weight:bold">CHF ${Number(subtotal).toFixed(2)}</td>
          </tr>
          ${
            freeShip
              ? `<tr><td colspan="2" style="padding:8px 12px;color:#2e7d32">Gratis Versand 🎉</td></tr>`
              : ``
          }
        </tfoot>
      </table>
    `;

    const addr = `
      ${escapeHtml(customer.firstName)} ${escapeHtml(customer.lastName)}<br/>
      ${escapeHtml(customer.street)}<br/>
      ${escapeHtml(customer.zip)} ${escapeHtml(customer.city)}<br/>
      ${escapeHtml(customer.country)}<br/>
      E-Mail: ${escapeHtml(customer.email)}${customer.phone ? `<br/>Tel: ${escapeHtml(customer.phone)}` : ''}${
      customer.notes ? `<br/><br/>Hinweise: ${escapeHtml(customer.notes)}` : ''
    }
    `;

    // Mail an Kund*in
    await resend.emails.send({
      from: fromEmail,
      to: customer.email,
      subject: 'Deine Reppify Bestellung – Bestätigung',
      html: `
        <div style="font-family:Arial,sans-serif">
          <h2>Vielen Dank für deine Bestellung!</h2>
          <p>Wir haben deine Bestellung erhalten und melden uns, sobald sie versendet wurde.</p>
          <h3>Bestellübersicht</h3>
          ${table}
          <h3>Lieferadresse</h3>
          <p>${addr}</p>
        </div>
      `,
    });

    // Mail an Shop
    await resend.emails.send({
      from: fromEmail,
      to: storeEmail,
      subject: 'Neue Bestellung (Reppify)',
      html: `
        <div style="font-family:Arial,sans-serif">
          <h2>Neue Bestellung</h2>
          ${table}
          <h3>Kundendaten</h3>
          <p>${addr}</p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// simple HTML escape
function escapeHtml(s = '') {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
