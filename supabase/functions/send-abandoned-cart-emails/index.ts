// Save this file as: supabase/functions/send-abandoned-cart-emails/index.ts
// Deploy with: supabase functions deploy send-abandoned-cart-emails

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FROM_EMAIL = "Fofo Deluxe <orders@fofodeluxe.com>";
const REPLY_TO_EMAIL = "fofodeluxebiz@gmail.com";
const SITE_URL = "https://www.fofodeluxe.com";

// Mirrors the product catalog in App.jsx so emails show real names, not IDs.
const PRODUCT_NAMES: Record<string, string> = {
  "a01": "Spot Remover Cleanser",
  "a02": "Lavender Cleanser",
  "a03": "Cleanser & Toner for Acne & Pimple",
  "a04": "Face Cleanser",
  "a05": "Facial Wash",
  "a06": "Aloe Vera Gel 500ml",
  "a07": "Whitening Face Serum",
  "a08": "Vitamin C Face Serum",
  "a09": "Sunscreen Spray",
  "a10": "Lip Set",
  "a11": "Lip Scrub",
  "a12": "Shower Gel 250ml",
  "a13": "Shower Gel 500ml",
  "a14": "Body Butter 500ml",
  "a15": "Body Butter 1 Litre",
  "a16": "Face & Body Milk 500ml",
  "a17": "Face & Body Milk 1 Litre",
  "a18": "Repairing Body Oil",
  "a19": "Snow White Oil 100ml",
  "a20": "Snow White Oil 250ml",
  "a21": "Glutathione & Collagen Body Soap 500ml",
  "a22": "Glutathione & Collagen Body Soap 1 Litre",
  "a23": "Moroccan Black Polish 500ml",
  "a24": "Moroccan Black Polish 1 Litre",
  "a27": "Hair Oil 100ml",
  "a28": "Hair Cream",
  "a29": "Lip Balm",
  "a30": "Lip Mask",
  "a31": "Lip Brush",
  "b1": "Acne and Pimple Solution Set",
  "b2": "Spot Remover Cleanser",
  "b3": "Hair Cream & Oil Duo",
  "b4": "Pink Lips Set",
  "b5": "Body Butter",
  "b6": "Moroccan Black Polish",
  "b7": "Whitening Face Serum",
  "b8": "Glutathione and Collagen Body Soap",
  "p1": "Sunburn Face Cream",
  "p2": "Turmeric & Lemon Body Scrub",
  "p3": "Snow White Oil",
  "p4": "Pink Salt Shower Gel",
  "p5": "Repairing Face Serum",
  "p6": "Snow White Oil - Sweet Vanilla",
  "s1": "Anti Ageing Set",
  "s2": "Hair Set",
  "s3": "Acne and Pimple Solution Set",
  "s4": "Pink Lips Set",
  "s5": "Knuckle Care Set",
  "s6": "Omo Pupa Set",
  "s7": "Snow White Set",
  "s8": "Face Set",
  "s9": "Sunscreen Set",
};

Deno.serve(async () => {
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  // Carts last touched 48h+ ago that we haven't already emailed about.
  const { data: carts, error } = await supabaseAdmin
    .from("carts")
    .select("user_id, email, items, updated_at")
    .lt("updated_at", cutoff)
    .is("reminder_sent_at", null);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const results = [];

  for (const cart of carts ?? []) {
    const itemIds = Object.keys(cart.items || {});
    if (itemIds.length === 0) continue; // empty cart, nothing to remind them about

    const itemLines = Object.entries(cart.items)
      .map(([id, qty]) => `${qty} x ${PRODUCT_NAMES[id] || id}`)
      .join("<br/>");

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: cart.email,
        reply_to: REPLY_TO_EMAIL,
        subject: "You left something in your cart 🛍️",
        html: `
          <p>Hi,</p>
          <p>You still have items waiting in your Fofo Deluxe cart:</p>
          <p>${itemLines}</p>
          <p><a href="${SITE_URL}/shop-all">Come back and finish your order</a></p>
        `,
      }),
    });

    const sent = emailRes.ok;
    results.push({ user_id: cart.user_id, email: cart.email, sent });

    if (sent) {
      await supabaseAdmin
        .from("carts")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("user_id", cart.user_id);
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { "Content-Type": "application/json" },
  });
});