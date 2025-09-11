// /app/api/stripe/webhook/route.js
import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { sendOrderEmails } from '../../../../lib/email';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(req) {
  const sig = req.headers.get('stripe-signature');
  const body = await req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('❌ Webhook signature error:', err?.message);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const sessionId = event.data.object.id;

      // Session mitsamt Positionen laden
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['line_items', 'customer_details'],
      });

      const items = (session.line_items?.data || []).map((li) => ({
        name: li.description,
        quantity: li.quantity || 1,
        unit: (li.price?.unit_amount || 0) / 100,
        total: (li.amount_total || 0) / 100,
      }));

      const subtotal = (session.amount_subtotal || 0) / 100;
      const total = (session.amount_total || 0) / 100;
      const shipping = Math.max(0, total - subtotal);

      const order = {
        number: sessionId.slice(-8).toUpperCase(), // simple Kurznummer
        subtotal,
        total,
        shipping,
        items,
        note: session.customer_notes || '',
        customer: {
          email: session.customer_details?.email || '',
          name: session.customer_details?.name || '',
          address: {
            line1: session.customer_details?.address?.line1 || '',
            line2: session.customer_details?.address?.line2 || '',
            city: session.customer_details?.address?.city || '',
            postal_code: session.customer_details?.address?.postal_code || '',
            country: session.customer_details?.address?.country || '',
          },
        },
      };

      // Mails: an Kunde + an Admin
      await sendOrderEmails({ order, toEmail: order.customer.email });
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('❌ Webhook handler error:', err);
    return new NextResponse('Server error', { status: 500 });
  }
}
