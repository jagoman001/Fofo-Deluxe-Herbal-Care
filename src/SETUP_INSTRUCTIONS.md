# Setting up Accounts + Abandoned Cart Emails

## 1. Install the Supabase client library
```powershell
cd ~\Desktop\fofo-deluxe-site
npm install @supabase/supabase-js
```

## 2. Create the carts table
In the Supabase Dashboard (project `vswmuulplauogngowwk`) → **SQL Editor** → New query.
Paste the contents of `1_carts_table.sql` and click **Run**.

## 3. Turn on email confirmations (should be on by default)
Dashboard → **Authentication** → **Providers** → Email → make sure
"Confirm email" is switched ON. This is what makes Supabase send the
verification email on Register, and the reset-link email on Forgot Password —
you don't need to write any of that email-sending code yourself, Supabase
handles it.

## 4. Set your site URL + redirect (needed for the password reset link to work)
Dashboard → **Authentication** → **URL Configuration**:
- Site URL: your live domain (e.g. `https://fofodeluxe.co.uk`)
- Redirect URLs: add `https://fofodeluxe.co.uk/reset-password`
  (and `http://localhost:3000/reset-password` or whatever port you use locally, for testing)

## 5. Verify a sending domain in Resend
You said your Resend domain isn't verified yet — do that first:
Resend Dashboard → **Domains** → Add your domain → add the DNS records it
gives you (at your domain registrar) → wait for it to show "Verified".
Until it's verified, Resend will only let you send test emails to your own
account email, not to real customers.

## 6. Deploy the Edge Function
Install the Supabase CLI if you don't have it, then from your project folder:
```powershell
npm install -g supabase
supabase login
supabase link --project-ref vswmuulplauogngowwk
```
Create the function folder and file exactly as named below, then paste in
the contents of `supabase_functions_send-abandoned-cart-emails_index.ts`:
```powershell
supabase functions new send-abandoned-cart-emails
# then paste the code into: supabase/functions/send-abandoned-cart-emails/index.ts
```
Before deploying, open that file and:
- Replace `orders@yourdomain.com` with a real address on your verified Resend domain
- Replace `YOUR-SITE-URL` with your real site URL

Set your Resend key as a secret (this keeps it out of your code entirely):
```powershell
supabase secrets set RESEND_API_KEY=your_resend_api_key_here
```
Then deploy:
```powershell
supabase functions deploy send-abandoned-cart-emails
```

## 7. Schedule it to run automatically (every hour)
Dashboard → **Database** → **Cron Jobs** → **Create a new cron job**
- Name: `abandoned-cart-check`
- Schedule: `0 * * * *` (every hour)
- Type: HTTP request
- Method: POST
- URL: `https://vswmuulplauogngowwk.supabase.co/functions/v1/send-abandoned-cart-emails`
- Headers: `Authorization: Bearer <your service_role key, from Settings → API>`

That's it — every hour it checks for carts untouched for 48+ hours and
haven't been emailed yet, sends the reminder through Resend, and marks
them so they don't get emailed twice.

## Known limitation, worth knowing
Because checkout currently happens via WhatsApp or an external PayPal.me
link (not a payment webhook back to your site), there's no automatic way
to know "this customer already paid" — so someone could still get an
abandoned-cart email after they've already bought via WhatsApp. If that
becomes annoying, the fix is to add a "mark as purchased" step (e.g. you
manually clear their cart in the dashboard, or we wire up a proper PayPal
webhook later).
