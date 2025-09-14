// /app/api/checkout/route.js
import Stripe from "stripe";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const stripeSecret = process.env.STRIPE_SECRET_KEY;
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

/* Preise aus JSON laden (public/price-overrides-v2.json) */
const overridesPath = path.join(process.cwd(), "public", "price-overrides-v2.json");
let priceOverrides = {};
try {
  priceOverrides = JSON.parse(fs.readFileSync(overridesPath, "utf8"));
} catch (e) {
  console.error("Konnte price-overrides-v2.json nicht laden:", e);
}

/* Preis per image-Pfad lookup */
function getServerPriceCHF(it) {
  const img = it?.image || "";
  if (!img) return null;
  const key = img.startsWith("/") ? img : `/${img}`;
  const val = priceOverrides[key];
  return typeof val === "number" ? val : null;
}

export async function POST(req) {
  try {
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

    // Subtotal berechnen
    const subtotalCents = cart.reduce((sum, it) => {
      const qty = Number(it?.qty) > 0 ? Number(it.qty) : 1;
      const serverPrice = getServerPriceCHF(it);
      const priceCHF = serverPrice ?? (Number(it?.price) || 0);
      return sum + Math.round(priceCHF * 100) * qty;
    }, 0);

    // Stripe Line Items vorbereiten
    const line_items = cart.map((it) => {
      const qty = Number(it?.qty) > 0 ? Number(it.qty) : 1;
      const serverPrice = getServerPriceCHF(it);
      const priceCHF = serverPrice ?? (Number(it?.price) || 0);
      const unitAmount = Math.round(priceCHF * 100);

      let imageUrl;
      if (it?.image) {
        const tentative = it.image.startsWith("http")
          ? it.image
          : `${origin}${it.image.startsWith("/") ? "" : "/"}${it.image}`;
        if (/^https?:\/\//i.test(tentative)) imageUrl = tentative;
      }

      return {
        quantity: qty,
        price_data: {
          currency: "chf",
          unit_amount: unitAmount,
          product_data: {
            name: `${it?.title || "Artikel"} (Größe: ${it?.size || "One Size"})`, // 👈 Größe im Produktnamen
            ...(imageUrl ? { images: [imageUrl] } : {}),
          },
        },
      };
    });

    // Stripe Checkout Session erstellen
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,

      // ✅ Adresse erfassen, aber keine Versandoptionen
      billing_address_collection: "required",
      shipping_address_collection: {
        allowed_countries: ["CH", "DE", "AT", "FR", "IT", "LI"],
      },

      phone_number_collection: { enabled: true },
      line_items,

      // 👇 Extra: gesamte Bestellung inkl. Größe ins Metadata packen
      metadata: {
        order_items: JSON.stringify(
          cart.map((it) => ({
            title: it.title,
            size: it.size,
            qty: it.qty,
            price: it.price,
          }))
        ),
      },

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
