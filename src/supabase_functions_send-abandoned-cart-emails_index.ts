// Save this file as: supabase/functions/send-abandoned-cart-emails/index.ts
// Deploy with: supabase functions deploy send-abandoned-cart-emails

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Must be an address on a domain you've verified in Resend.
// Until your domain is verified, Resend only lets you send to your own account email.
const FROM_EMAIL = "Fofo Deluxe <orders@yourdomain.com>";

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
      .map(([id, qty]) => `${qty} x ${id}`)
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
        subject: "You left something in your cart 🛍️",
        html: `
          <p>Hi,</p>
          <p>You still have items waiting in your Fofo Deluxe cart:</p>
          <p>${itemLines}</p>
          <p><a href="https://YOUR-SITE-URL/shop-all">Come back and finish your order</a></p>
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
