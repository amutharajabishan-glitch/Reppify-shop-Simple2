// /app/api/stripe/webhook/route.js
import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { sendOrderEmails } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

export async function POST(req) {
  // RAW Body (für Signaturprüfung)
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

      // 1) Line-Items von Stripe holen (für Preise/Mengen)
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });
      const liData = Array.isArray(lineItems?.data) ? lineItems.data : [];

      // 2) Größen (u. a.) aus metadata holen (kommt von /api/checkout – dort schreiben wir order_items rein)
      let metaItems = [];
      const rawMeta = session.metadata?.order_items;
      if (rawMeta) {
        try {
          const parsed = JSON.parse(rawMeta);
          if (Array.isArray(parsed)) metaItems = parsed;
        } catch (e) {
          console.warn('metadata.order_items konnte nicht geparst werden:', e?.message);
        }
      }

      // 3) Items für die E-Mail bauen:
      //    - Wenn wir metaItems haben, nehmen wir deren title/size/qty
      //    - Preis ziehen wir bevorzugt aus Stripe lineItems (unit_amount), Fallback meta.price
      const items = (metaItems.length ? metaItems : liData.map(li => ({
        title: li.description || 'Artikel',
        size: undefined,
        qty: li.quantity || 1,
        price: (li.price?.unit_amount || 0) / 100,
      }))).map((m, i) => {
        const li = liData[i]; // nach Index gematcht (gleiche Reihenfolge)
        const unitPrice =
          typeof li?.price?.unit_amount === 'number'
            ? li.price.unit_amount / 100
            : (typeof m?.price === 'number' ? m.price : 0);

        const qty = Number(m?.qty) > 0 ? Number(m.qty) : (li?.quantity || 1);
        const nameWithSize = `${m?.title || 'Artikel'}${m?.size ? ` (Größe: ${m.size})` : ''}`;

        return {
          name: nameWithSize,
          qty,
          amount: unitPrice, // Einzelpreis in CHF (dein Template rechnet die Summe separat)
        };
      });

      const order = {
        id: session.id,
        total: (session.amount_total || 0) / 100,
        currency: (session.currency || 'chf').toUpperCase(),
        email: session.customer_details?.email || '',
        name: session.customer_details?.name || session.shipping_details?.name || '',
        address: session.shipping_details?.address || null,
        items,
      };

      // → Mails raus (Kunde + Shop)
      await sendOrderEmails({
        toCustomer: order.email,             // Kunde
        storeEmail: process.env.STORE_EMAIL, // z.B. shop@reppify.ch
        fromEmail: process.env.FROM_EMAIL,   // verifizierte Absenderadresse (Resend/SMTP)
        order,
      });
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    console.error('Webhook handler failed:', err);
    return new Response('Webhook handler failed', { status: 500 });
  }
}
