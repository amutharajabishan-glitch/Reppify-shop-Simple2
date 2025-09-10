// app/api/stripe-webhook/route.js
import Stripe from 'stripe';
import { Resend } from 'resend';

export const config = {
  api: {
    bodyParser: false, // wichtig: Stripe verlangt den Roh-Body
  },
};

function buffer(readable) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readable.on('data', (chunk) => chunks.push(chunk));
    readable.on('end', () => resolve(Buffer.concat(chunks)));
    readable.on('error', reject);
  });
}

export async function POST(req) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-06-20',
  });
  const resend = new Resend(process.env.RESEND_API_KEY);

  const sig = req.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return new Response('Webhook signature missing', { status: 400 });
  }

  let event;
  try {
    const rawBody = await buffer(req.body);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // Nur auf erfolgreiche Zahlungen reagieren
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    // eMail ermitteln
    const customerEmail =
      session.customer_details?.email ||
      session.metadata?.email ||
      '';

    // Cart aus metadata lesen
    let cart = [];
    try {
      if (session.metadata?.cart) {
        cart = JSON.parse(session.metadata.cart);
      }
    } catch (_) {}

    // HTML-Inhalt bauen
    const itemsHtml = cart
      .map(
        (it) => `
      <li>
        ${it.qty}× ${it.title} (${it.size}) – CHF ${Number(it.price).toFixed(2)}
      </li>`
      )
      .join('');

    const orderHtml = `
      <h2>Danke für deine Bestellung bei Reppify</h2>
      <p>Wir haben deine Zahlung erhalten. Hier sind deine Bestelldetails:</p>
      <ul>${itemsHtml || '<li>(keine Positionen gefunden)</li>'}</ul>
      <p>Wir melden uns, sobald dein Paket versandt wurde.</p>
    `;

    // 1) Mail an Kunden
    if (customerEmail) {
      try {
        await resend.emails.send({
          from: process.env.FROM_EMAIL,
          to: customerEmail,
          subject: 'Bestellbestätigung – Reppify',
          html: orderHtml,
        });
      } catch (e) {
        console.error('Resend to customer failed:', e);
      }
    }

    // 2) Kopie an Shop
    try {
      await resend.emails.send({
        from: process.env.FROM_EMAIL,
        to: process.env.STORE_EMAIL,
        subject: 'Neue Bestellung – Reppify',
        html: `
          <h2>Neue Bestellung</h2>
          <p>Kunde: ${customerEmail || '(unbekannt)'}</p>
          <ul>${itemsHtml || '<li>(keine Positionen gefunden)</li>'}</ul>
        `,
      });
    } catch (e) {
      console.error('Resend to store failed:', e);
    }
  }

  return new Response('ok', { status: 200 });
}
