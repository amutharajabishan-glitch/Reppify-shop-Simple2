// /app/api/stripe/webhook/route.js
import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { sendOrderEmails } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

export async function POST(req) {
  // Stripe braucht den RAW Body für die Signaturprüfung
  const rawBody = await req.text();
  const sig = req.headers.get('stripe-signature');

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('⚠️  Invalid signature:', err?.message);
    return new Response('Invalid signature', { status: 400 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;

      // Line Items holen → damit Artikel/Mengen in die Mail kommen
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });

      const items = (lineItems?.data || []).map((li) => ({
        name: li.description,
        qty: li.quantity,
        amount:
          typeof li.amount_total === 'number'
            ? li.amount_total / 100
            : (li.price?.unit_amount || 0) / 100,
      }));

      const order = {
        id: session.id,
        total: (session.amount_total || 0) / 100,
        currency: (session.currency || 'chf').toUpperCase(),
        email: session.customer_details?.email || '',
        name: session.customer_details?.name || session.shipping_details?.name || '',
        address: session.shipping_details?.address || null,
        items,
      };

      // ←— HIER werden beide Mails verschickt (Kunde + Shop)
      await sendOrderEmails({
        toCustomer: order.email,                   // Kunde
        storeEmail: process.env.STORE_EMAIL,       // z.B. shop@reppify.ch
        fromEmail: process.env.FROM_EMAIL,         // verifizierte Absenderadresse (Resend)
        order,
      });
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    console.error('Webhook handler failed:', err);
    return new Response('Webhook handler failed', { status: 500 });
  }
}
