import Stripe from "stripe";

export const dynamic = "force-dynamic";

const stripeSecret = process.env.STRIPE_SECRET_KEY;

// ▲ Früh prüfen: Key vorhanden und SECRET?
if (!stripeSecret) {
  throw new Error(
    "Stripe: STRIPE_SECRET_KEY ist nicht gesetzt. Bitte in Vercel → Project Settings → Environment Variables hinterlegen und redeployen."
  );
}
if (stripeSecret.startsWith("pk_")) {
  throw new Error(
    "Stripe: STRIPE_SECRET_KEY enthält einen Publishable Key (pk_*). Bitte den SECRET Key (sk_*) eintragen."
  );
}

const stripe = new Stripe(stripeSecret, { apiVersion: "2024-06-20" });

export async function POST(req) {
  try {
    // Basis-URL ermitteln (Prod: deine Domain über ENV, sonst Origin/localhost)
    const origin = new URL(
      process.env.NEXT_PUBLIC_SITE_URL ||
        req.headers.get("origin") ||
        "http://localhost:3000"
    ).origin;

    const body = await req.json();
    const cart = Array.isArray(body?.cart) ? body.cart : [];
    const email = typeof body?.email === "string" ? body.email : undefined;

    if (!cart.length) {
      return new Response(JSON.stringify({ error: "Cart is empty" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    // Line Items sauber aufbereiten
    const line_items = cart.map((item) => {
      const qty = Number(item?.qty) > 0 ? Number(item.qty) : 1;
      const unitAmount = Math.round(Number(item?.price) * 100);

      // Bild-URL absolut machen (Stripe braucht http/https)
      let imageUrl;
      if (item?.image) {
        const tentative = item.image.startsWith("http")
          ? item.image
          : `${origin}${item.image.startsWith("/") ? "" : "/"}${item.image}`;
        if (/^https?:\/\//i.test(tentative)) imageUrl = tentative;
      }

      return {
        quantity: qty,
        price_data: {
          currency: "chf",
          unit_amount: unitAmount,
          product_data: {
            name: item?.title || "Artikel",
            ...(imageUrl ? { images: [imageUrl] } : {}),
          },
        },
      };
    });

    // Versandoptionen
    const subtotalCents = cart.reduce((sum, it) => {
      const qty = Number(it?.qty) > 0 ? Number(it.qty) : 1;
      const priceCents = Math.round(Number(it?.price) * 100);
      return sum + priceCents * qty;
    }, 0);

    const shipping_options =
      subtotalCents >= 10000
        ? [
            {
              shipping_rate_data: {
                display_name: "Gratis Versand",
                type: "fixed_amount",
                fixed_amount: { currency: "chf", amount: 0 },
                delivery_estimate: {
                  minimum: { unit: "business_day", value: 2 },
                  maximum: { unit: "business_day", value: 5 },
                },
              },
            },
          ]
        : [
            {
              shipping_rate_data: {
                display_name: "Standard (B-Post)",
                type: "fixed_amount",
                fixed_amount: { currency: "chf", amount: 700 },
                delivery_estimate: {
                  minimum: { unit: "business_day", value: 2 },
                  maximum: { unit: "business_day", value: 5 },
                },
              },
            },
            {
              shipping_rate_data: {
                display_name: "Priority (A-Post)",
                type: "fixed_amount",
                fixed_amount: { currency: "chf", amount: 1200 },
                delivery_estimate: {
                  minimum: { unit: "business_day", value: 1 },
                  maximum: { unit: "business_day", value: 2 },
                },
              },
            },
          ];

    // Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      // (robuster als feste Liste, Stripe wählt geeignete Methoden)
      automatic_payment_methods: { enabled: true },
      customer_email: email,
      billing_address_collection: "required",
      shipping_address_collection: {
        allowed_countries: ["CH", "DE", "AT", "FR", "IT", "LI"],
      },
      shipping_options,
      phone_number_collection: { enabled: true },
      line_items,
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout?canceled=1`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    const msg = err?.raw?.message || err?.message || "Server error";

    return new Response(
      JSON.stringify({
        error: msg,
        debug: process.env.NODE_ENV !== "production" ? err : undefined,
      }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}