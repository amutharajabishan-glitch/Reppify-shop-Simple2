import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req) {
  try {
    const { email, orderId, items } = await req.json();

    await resend.emails.send({
      from: process.env.FROM_EMAIL,
      to: email, // Kunde
      subject: `Bestellbestätigung #${orderId}`,
      html: `
        <h1>Danke für deine Bestellung bei Reppify</h1>
        <p>Deine Bestellnummer: <b>${orderId}</b></p>
        <p>Produkte:</p>
        <ul>
          ${items.map(it => `<li>${it.qty}x ${it.title} (${it.size})</li>`).join('')}
        </ul>
        <p>Wir melden uns, sobald dein Paket versandt wurde.</p>
      `,
    });

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Mail konnte nicht gesendet werden' }), { status: 500 });
  }
}
