# Deploying Rera Body

This guide takes the store from this repository to a live site on Vercel with Neon Postgres, Cloudflare R2, Stripe and Resend. Do the steps in order. Allow about two hours the first time, plus waiting for DNS.

## 1. What you need

- A Vercel account and the repository on GitHub.
- A Neon (or any managed Postgres 16+) project.
- A Cloudflare account with R2 enabled, and access to the store's domain DNS.
- A Stripe account in the country the business is registered in (see the open questions in `build-plan.md`; Paystack would replace Stripe behind the `PaymentProvider` interface).
- A Resend account and DNS access for a sending subdomain such as `mail.<domain>`.

## 2. Database (Neon)

1. Create a project and a database, region close to the Vercel region.
2. Copy two connection strings:
   - **Pooled** (host contains `-pooler`): use for `DATABASE_URL`.
   - **Direct**: use for `DIRECT_URL`. Prisma Migrate and the seed use it.
3. The first migration creates the `pg_trgm` extension. Neon allows it; on other hosts make sure the database user may run `CREATE EXTENSION`.

## 3. Images (Cloudflare R2)

1. Create a bucket, for example `rerabody-media`.
2. Connect a custom domain to the bucket (R2 → bucket → Settings → Custom Domains), for example `media.<domain>`. This becomes `NEXT_PUBLIC_MEDIA_URL=https://media.<domain>`.
3. Create an R2 API token with **Object Read & Write** on that bucket. Note the access key id, secret and the account id.
4. Add a CORS policy to the bucket so the admin can upload straight from the browser:

   ```json
   [
     {
       "AllowedOrigins": ["https://<store domain>"],
       "AllowedMethods": ["PUT"],
       "AllowedHeaders": ["content-type"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

## 4. Email (Resend)

1. Add the domain `mail.<domain>` in Resend and create the SPF, DKIM and (recommended) DMARC records it shows. Wait until Resend reports it verified.
2. Create an API key with sending access: `RESEND_API_KEY`.
3. Choose the senders, for example `EMAIL_FROM_ORDERS="Rera Body <orders@mail.<domain>>"` and `EMAIL_FROM_MARKETING="Rera Body <hello@mail.<domain>>"`.
4. Add a webhook in Resend pointing at `https://<store domain>/api/webhooks/resend` with the events `email.delivered`, `email.bounced`, `email.complained` and `email.failed`. Copy its signing secret: `RESEND_WEBHOOK_SECRET`.

## 5. Payments (Stripe)

1. In the Stripe dashboard, copy the secret key: `STRIPE_SECRET_KEY` (use test keys for a staging deploy).
2. Add a webhook endpoint `https://<store domain>/api/webhooks/stripe` with these events:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   - `checkout.session.expired`
3. Copy the endpoint's signing secret: `STRIPE_WEBHOOK_SECRET`.
4. The webhook is the only place an order becomes paid. If it is misconfigured, customers see "Confirming your payment" on the success page and orders stay pending.

## 6. Environment variables (Vercel)

Set these for Production (and Preview with test values). `src/env.ts` refuses to start if any is missing or malformed.

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Neon pooled connection string |
| `DIRECT_URL` | Neon direct connection string |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` (keep it stable: it also signs email links) |
| `NEXT_PUBLIC_APP_URL` | `https://<store domain>` (no trailing slash) |
| `STORE_CURRENCY` | ISO code, for example `GBP` or `NGN` |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | From step 5 |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | From step 3 |
| `NEXT_PUBLIC_MEDIA_URL` | `https://media.<domain>` |
| `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `EMAIL_FROM_ORDERS`, `EMAIL_FROM_MARKETING` | From step 4 |
| `CRON_SECRET` | `openssl rand -hex 24`. Vercel Cron sends it automatically |
| `SEED_OWNER_EMAIL`, `SEED_OWNER_PASSWORD` | The owner's email and a strong first password (12+ characters). Remove after seeding |

Leave `EMAIL_TRANSPORT`, `PAYMENT_PROVIDER` and `STORAGE_DRIVER` unset in production. Their defaults are `resend`, `stripe` and `r2`. The `fake`, `log` and `local` values are for development and tests only.

## 7. First deploy

1. Import the repository in Vercel. The build command is the default `pnpm build`; the install step runs `prisma generate`.
2. Before (or right after) the first deploy, apply migrations and seed from your machine with the production values:

   ```bash
   DATABASE_URL="<direct url>" DIRECT_URL="<direct url>" pnpm db:migrate
   DATABASE_URL="<direct url>" DIRECT_URL="<direct url>" SEED_OWNER_EMAIL=... SEED_OWNER_PASSWORD=... pnpm db:seed
   ```

   The seed creates roles, the owner account and **placeholder** catalogue and content. Replace the placeholder products, prices, homepage text, policies and FAQ before launch (see `docs/admin-guide.md`), or delete them.
3. Redeploy so the static pages are built from the seeded database. Later content edits revalidate automatically.
4. On every later release that adds a migration, run `pnpm db:migrate` against the direct URL before or during the deploy.

## 8. Scheduled jobs

`vercel.json` schedules `/api/cron/low-stock` daily at 07:00 UTC. Vercel Cron sends `Authorization: Bearer $CRON_SECRET`; the route refuses anything else. To trigger it by hand:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<store domain>/api/cron/low-stock
```

## 9. After going live

1. Sign in at `/admin/login` as the owner and change the password from the profile page if the seed password was shared.
2. In **Settings**, set the admin alert email, contact details, delivery options, carriers (with tracking URL patterns) and SEO defaults. Use **Send test email**.
3. Place a real order with a small amount, refund it from the order page, and check the emails arrive.
4. Check the Stripe webhook delivery log shows `200` responses.

## Security notes

- Every response carries a Content Security Policy (`src/lib/security-headers.ts`). If you add a new third-party script, image host or iframe, add its origin there.
- Rate limits are stored in the `RateLimit` table. Better Auth limits sign in, sign up, password reset and verification emails; the app limits contact, newsletter, coupon, review and order lookup forms.
- Rotating `BETTER_AUTH_SECRET` signs everyone out and invalidates tracking, review, unsubscribe and upload links already sent.
