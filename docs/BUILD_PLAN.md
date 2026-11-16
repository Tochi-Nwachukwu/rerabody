# Rera Body: build plan for Claude Code

This file is the working brief for building the Rera Body ecommerce store. Read all of it before writing code. Two companion files hold the detail and should sit beside it in `docs/`:

- `docs/build-plan.md`: stack decision, site map, operations, customer and admin flows, order lifecycle, data model.
- `docs/screen-map.md`: every screen (S1 to S31 storefront, A1 to A29 admin, G1 to G5 shared, A0 admin shell) with its contents, buttons and actions.

Screen codes in this file (S5, A11 and so on) refer to `docs/screen-map.md`. When this file and the screen map disagree, the screen map wins for UI behaviour and this file wins for architecture.

## 1. How to work

1. Build one phase at a time, in order. Do not start a phase until the previous one passes its checks.
2. At the start of each phase, write a short task list. At the end, run the checks listed for that phase, fix failures, then stop and summarise what was built and anything you assumed.
3. After every task run `pnpm typecheck` and `pnpm lint`. After every phase also run `pnpm test` and `pnpm build`.
4. Commit after each task with a clear message. Never commit secrets or `.env` files.
5. Use the current stable release of every dependency. Before scaffolding, read the current docs for Next.js, Prisma, Better Auth, Stripe, Resend and Tailwind, because their setup steps change between major versions. Do not rely on remembered APIs.
6. When something is ambiguous, check section 12 for the assumed default. If it is not covered, choose the simpler option, record it in `docs/decisions.md` and continue.
7. Never invent brand copy, prices or policies as if they were real. Seed data is placeholder content and must be labelled as such in `prisma/seed.ts`.
8. Do not add features that are not in this plan or the screen map.

## 2. What we are building

An online store for Rera Body, a brand selling body butters and ladies' nightwear. The page structure follows noorvanaskincare.com. The owner must be able to edit products, prices, homepage sections and policy pages herself, manage stock and orders, moderate reviews, issue coupons and invite staff with limited permissions. Customers browse, search, add to cart, pay, track orders and leave reviews. Every order status change sends an email.

## 3. Stack

| Concern | Choice |
| --- | --- |
| App | One Next.js app, App Router, TypeScript strict mode, React Server Components by default |
| Package manager | pnpm |
| Database | PostgreSQL through Prisma. Use a pooled connection string at runtime and a direct one for migrations |
| Auth | Better Auth with the Prisma adapter, email and password, email verification, database sessions |
| Payments | Stripe Checkout (hosted) plus a webhook route, wrapped behind a `PaymentProvider` interface |
| Images | Cloudflare R2 through the S3-compatible API with presigned PUT uploads. Public reads from a custom domain |
| Email | Resend with React Email templates |
| Styling | Tailwind CSS with shadcn/ui components |
| Forms and validation | React Hook Form with Zod. The same Zod schema validates on client and server |
| Rich text | Tiptap, stored as JSON, rendered on the server |
| Search | Postgres full text search plus `pg_trgm` for autocomplete |
| Scheduled jobs | Cron-triggered route handlers protected by a secret header |
| Tests | Vitest for unit and integration tests, Playwright for the purchase path |
| Hosting | Vercel, with a managed Postgres such as Neon |

## 4. Conventions

- Mutations are Server Actions in `src/server/actions/*`. Each action does four things in this order: parse input with Zod, check the session, check the permission, then call a service function.
- Business logic lives in `src/server/services/*` as plain functions that take a Prisma client. Server Actions and route handlers stay thin. Services are what the unit tests cover.
- Route handlers are used only for webhooks, cron jobs, the presign endpoint and search autocomplete.
- Money is an integer in minor units everywhere. Format only at the edge with one `formatMoney` helper. Currency comes from one config value.
- Every admin action checks a permission on the server with `requirePermission("orders.update")`. Hiding a button is not a security control.
- Storefront pages are cached and revalidated by tag (`products`, `product:{id}`, `home`, `collection:{id}`, `page:{slug}`). Every admin mutation revalidates the tags it affects.
- No client component fetches data directly from the database layer. Pass data down from server components or call a Server Action.
- Mobile first. Build every screen at 375px wide before widening.
- All user-facing strings sit in the component, in plain English. No i18n layer.

## 5. Repository layout

```
prisma/
  schema.prisma
  seed.ts
src/
  app/
    (store)/            storefront routes, S1 to S31
    (auth)/             login, register, verify, forgot, reset
    admin/              admin routes, A1 to A29
    api/
      webhooks/stripe/route.ts
      webhooks/resend/route.ts
      cron/abandoned-carts/route.ts
      cron/low-stock/route.ts
      uploads/presign/route.ts
      search/suggest/route.ts
  components/
    store/  admin/  ui/
  emails/               React Email templates
  server/
    actions/  services/  auth/  permissions.ts  db.ts
    payments/           PaymentProvider interface, stripe.ts
    storage/r2.ts
    email/send.ts
  lib/                  money.ts, slug.ts, zod schemas
tests/
  unit/  e2e/
docs/
```

## 6. Environment variables

Create `.env.example` with these keys and validate them at startup with Zod in `src/env.ts`.

```
DATABASE_URL=
DIRECT_URL=
BETTER_AUTH_SECRET=
NEXT_PUBLIC_APP_URL=
STORE_CURRENCY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
NEXT_PUBLIC_MEDIA_URL=
RESEND_API_KEY=
RESEND_WEBHOOK_SECRET=
EMAIL_FROM_ORDERS=
EMAIL_FROM_MARKETING=
CRON_SECRET=
SEED_OWNER_EMAIL=
SEED_OWNER_PASSWORD=
```

## 7. Data model

Create these Prisma models. Add `id`, `createdAt` and `updatedAt` to all of them. Index every foreign key and every column used in a filter or sort.

| Model | Key fields and rules |
| --- | --- |
| User | name, email (unique), emailVerified, phone, roleId (null for customers), status (ACTIVE, INVITED, DEACTIVATED). Plus the tables Better Auth needs |
| Role | name (unique), isSystem. Seed: Owner, Manager, Inventory staff, Fulfilment staff, Content editor |
| RolePermission | roleId, permission (string). Unique on both |
| StaffInvite | email, roleId, tokenHash, expiresAt, acceptedAt |
| Address | userId, fullName, phone, line1, line2, city, state, postalCode, country, isDefault |
| Category | name, slug (unique), description, imageId, position |
| Collection | name, slug (unique), description, bannerImageId, position |
| CollectionProduct | collectionId, productId, position |
| Product | name, slug (unique), description (JSON), specs (JSON), sizeGuide (JSON), categoryId, status (DRAFT, PUBLISHED, ARCHIVED), metaTitle, metaDescription, ratingAverage, ratingCount, searchVector |
| ProductImage | productId, mediaId, position, isCover |
| ProductOption | productId, name (Size, Colour), values (string array), position |
| ProductVariant | productId, sku (unique), optionValues (JSON), price, compareAtPrice, stock, lowStockThreshold, imageId, isActive |
| InventoryMovement | variantId, delta, reason (RESTOCK, SALE, REFUND, DAMAGE, CORRECTION), note, orderId, actorId |
| Media | key (R2 object key, unique), url, width, height, bytes, mimeType, alt |
| Cart | userId or guestToken, email, couponId, abandonedEmailSentAt |
| CartItem | cartId, variantId, quantity. Unique on cart and variant |
| Order | number (unique, human readable), userId (nullable for guests), email, status, subtotal, discountTotal, shippingTotal, total, currency, couponCode, shippingAddress (JSON snapshot), shippingMethod (JSON snapshot), trackingCarrier, trackingNumber, guestAccessTokenHash |
| OrderItem | orderId, variantId, productName, variantLabel, sku, imageUrl, unitPrice, quantity, lineTotal. All copied at purchase time |
| OrderStatusEvent | orderId, fromStatus, toStatus, note, actorId (null for system) |
| OrderNote | orderId, authorId, body |
| Payment | orderId, provider, providerSessionId, providerPaymentId, amount, status, refundedAmount |
| ProcessedWebhookEvent | provider, eventId. Unique on both |
| ShippingMethod | name, price, region, estimate, isActive |
| Coupon | code (unique, stored uppercase), type (PERCENT, FIXED), value, startsAt, endsAt, minSpend, usageLimit, perCustomerLimit, isActive, showOnOffers, restricted product and category ids |
| CouponRedemption | couponId, orderId, userId, email, amount |
| Review | productId, orderItemId (unique), userId, rating (1 to 5), title, body, status (PENDING, APPROVED, REJECTED), rejectionReason, isFeatured |
| HomeSection | type, position, isVisible, data (JSON), draftData (JSON), isDraftDeleted |
| Page | slug (unique), title, body (JSON), draftBody (JSON), metaTitle, metaDescription, publishedAt |
| Faq | topic, question, answer, position |
| BlogPost | title, slug (unique), excerpt, coverImageId, body (JSON), status, publishedAt, metaTitle, metaDescription, linked product ids |
| SupportTicket | number, name, email, orderNumber, subject, status (OPEN, CLOSED) |
| TicketMessage | ticketId, authorId (null when from the customer), body |
| NewsletterSubscriber | email (unique), status (SUBSCRIBED, UNSUBSCRIBED, BOUNCED), tokenHash |
| EmailLog | to, template, dedupeKey (unique), providerId, status, error |
| SiteSetting | key (unique), value (JSON) |
| AuditLog | actorId, action, targetType, targetId, before (JSON), after (JSON) |

## 8. Rules that must hold

These are the places where a shortcut causes real damage. Write tests for each.

1. An order becomes PAID only inside the Stripe webhook handler. The success page never changes order state. It reads the order and polls until it is paid.
2. The webhook verifies the Stripe signature, then inserts into `ProcessedWebhookEvent`. If the insert hits the unique constraint, return 200 and do nothing else.
3. Marking an order PAID, decrementing stock, writing inventory movements, recording the coupon redemption and clearing the cart happen in one database transaction. The stock update uses a conditional write (`stock >= quantity`) so it can never go negative. If stock ran out between checkout and payment, mark the order PAID with a flag for manual review and alert the admin. Do not auto-refund.
4. Order status moves follow this table only. Anything else throws.

   | From | Allowed next |
   | --- | --- |
   | PENDING_PAYMENT | PAID, CANCELLED |
   | PAID | PROCESSING, CANCELLED, REFUNDED |
   | PROCESSING | SHIPPED, CANCELLED, REFUNDED |
   | SHIPPED | OUT_FOR_DELIVERY, DELIVERED, REFUNDED |
   | OUT_FOR_DELIVERY | DELIVERED, REFUNDED |
   | DELIVERED | REFUNDED |

5. Every status move writes an `OrderStatusEvent` in the same transaction.
6. Emails are sent after the transaction commits, through `sendEmail({ template, to, dedupeKey, props })`. The dedupe key is `{orderId}:{status}` for order emails. `sendEmail` inserts the `EmailLog` row first and skips the send if the key already exists.
7. The server recomputes every price, discount and total from the database at checkout. Nothing from the client is trusted except variant ids, quantities, the coupon code, the address and the shipping method id.
8. A coupon is validated twice: when applied in the cart and again when the order is created.
9. A review can be created only by the buyer of that order item, only after the order is DELIVERED, and only once. Product `ratingAverage` and `ratingCount` are recalculated whenever a review is approved, unpublished or deleted.
10. Uploads: the presign route checks the session and the `media.upload` permission, restricts content type to JPEG, PNG and WebP, caps size at 8 MB and generates the object key on the server. The client never chooses the key.
11. A `Media` row cannot be deleted while a product, section, post, category or collection references it.
12. Guest order links carry a random token. Store only its hash.
13. Password reset and newsletter forms return the same response whether or not the email exists.
14. The Owner role cannot be edited, deleted or removed from the seeded owner by another user.

## 9. Permissions

Seed these permission strings and map them to roles as described in `docs/build-plan.md` under Admin flows.

```
products.read products.write
inventory.read inventory.adjust
orders.read orders.update orders.refund
customers.read customers.update
reviews.moderate
coupons.manage
content.manage media.upload media.delete
support.manage
reports.read
staff.manage roles.manage
settings.manage audit.read
```

## 10. Phases

### Phase 0: foundation

Tasks:
- Scaffold the Next.js app with TypeScript strict, Tailwind, shadcn/ui, ESLint and Prettier. Add `typecheck`, `lint`, `test`, `test:e2e`, `db:migrate`, `db:seed` scripts.
- Add `src/env.ts`, `.env.example`, the Prisma client singleton and the full schema from section 7. Create the first migration, including the `pg_trgm` extension and the product search vector with a GIN index.
- Write `prisma/seed.ts`: roles and permissions, the owner user from env vars, two categories (Body Butters, Nightwear), three collections, eight placeholder products with variants and stock, shipping methods, homepage sections matching S1, policy page stubs, six FAQ entries.
- Set up Vitest and Playwright with one passing smoke test each.

Checks: `pnpm db:migrate` and `pnpm db:seed` run clean on an empty database. Typecheck, lint, test and build pass.

### Phase 1: auth and permissions

Tasks:
- Configure Better Auth with email and password, email verification and password reset. Build S13 to S17.
- Add `getSession`, `requireUser`, `requireStaff` and `requirePermission` helpers in `src/server/auth`.
- Build A0 admin shell, A1 admin login and a placeholder A3. Protect `/admin` so customers and signed-out visitors are redirected. Sidebar links show by permission.
- Build `src/server/email/send.ts` with the dedupe behaviour from rule 6, a shared branded email layout, and the verify, reset and welcome templates.

Checks: a seeded owner can sign in to `/admin`. A customer account is refused at `/admin`. Unit tests cover `requirePermission` for allowed, denied and deactivated users.

### Phase 2: media and catalogue admin

Tasks:
- Build `src/server/storage/r2.ts` and the presign route (rule 10). Build the upload component with progress and the A24 media library, including picker mode.
- Build A4 products list, A5 product editor with options, generated variants, images and SEO, A6 categories and A7 collections.
- Build A8 inventory with the adjust modal and movement history.
- Write an `audit()` helper and call it from every admin mutation from here on.

Checks: an admin can create a product with two options, upload three images to R2, publish it and adjust its stock. Unit tests cover variant generation from options and inventory adjustment.

### Phase 3: storefront browsing

Tasks:
- Build the storefront layout: G1 header, G4 footer, mobile menu. Read links and contact details from `SiteSetting`.
- Build S2 shop with filters, sort and URL state, S3 and S4 collections, S5 product with gallery, zoom, variant selection, stock states and tabs.
- Build the search service, the suggest route, G2 search overlay and S6 results.
- Build S7 offers and S31 not found.
- Add `generateMetadata` per product, collection and page, product structured data, `sitemap.ts` and `robots.ts`.

Checks: published products appear and drafts do not. Search finds a product from a misspelt query. Lighthouse mobile scores for S2 and S5 are at least 90 for accessibility and SEO.

### Phase 4: cart and checkout

Tasks:
- Build the cart service: guest carts by cookie token, merge on login, stock and price revalidation, coupon validation. Build G3 cart drawer and S8 cart.
- Build the `PaymentProvider` interface with `createCheckout`, `parseWebhook` and `refund`, and the Stripe implementation.
- Build S9 checkout with address, shipping method and summary. "Pay now" creates the PENDING_PAYMENT order and redirects to Stripe.
- Build the Stripe webhook route following rules 1 to 3. Handle completed, expired and failed events.
- Build S11 success with polling and S12 cancelled.
- Add a fake payment provider, selected by env var, for tests and local work without Stripe.

Checks: unit tests cover totals, every coupon rule, cart merge, the webhook's idempotency and the stock conditional write under two simultaneous orders for the last unit. A Playwright test completes a purchase with the fake provider and sees the order as paid.

### Phase 5: orders, lifecycle and email

Tasks:
- Build the order service with the state machine from rule 4 and unit tests for every allowed and refused move.
- Build A10 orders list and A11 order detail with all buttons from the screen map, including the shipped modal, refund modal, notes, resend email and packing slip.
- Build React Email templates: order confirmation, admin new order alert, processing, shipped with tracking, out for delivery, delivered with review request, cancelled, refunded.
- Build customer screens S18 to S22 and S24 guest tracking.
- Build the Resend webhook route to mark bounced and complained addresses.

Checks: walking one order from PAID to DELIVERED in the admin writes five status events and logs one email per step with no duplicates when a button is double-clicked. A refund calls the payment provider and restocks when the box is ticked.

### Phase 6: content management

Tasks:
- Define a Zod schema per homepage section type: hero, collection banners, product grid, featured product, text and image, ticker, steps, testimonials, newsletter. Build a renderer component for each and compose S1 from visible sections in order.
- Build A19 homepage editor with drag reorder, show and hide, duplicate, delete, draft, preview and publish. Build A20 section editor forms generated from the section type.
- Build A21 pages with the rich text editor, A22 FAQ manager, and the storefront S27 and S29.
- Build A28 settings (store, shipping, notifications, SEO) with the test email button.
- Build newsletter signup, the welcome email and S30 unsubscribe.

Checks: reordering and hiding a section in the admin changes the live homepage after publish and not before. Invalid section data is rejected by the schema. Draft preview does not leak to public visitors.

### Phase 7: reviews, coupons, customers, support

Tasks:
- Build S23 review form with the signed link from the delivered email, the reviews block on S5 and A14 moderation, following rule 9.
- Build A15 and A16 coupons with redemptions.
- Build A12 and A13 customers.
- Build S28 contact, A17 and A18 support inbox with reply by email.
- Add the chat widget script behind a `SiteSetting` value so it can be switched on without a deploy.

Checks: a review stays hidden until approved, and approval changes the product's rating. A customer who did not buy the product cannot post a review by calling the action directly.

### Phase 8: staff, dashboard, reports

Tasks:
- Build A25 staff with invites, A2 accept invite, A26 roles with the permission grid and A29 audit log.
- Build A3 dashboard with live figures and A27 reports with the four tabs and CSV export.
- Build the low stock cron route and admin alert email.

Checks: a Fulfilment staff user can update an order but receives a refusal when calling a product action directly. Report totals match a hand-calculated sum from seed orders in a unit test.

### Phase 9: hardening and launch

Tasks:
- Add rate limiting to login, register, password reset, contact, newsletter, coupon apply and review submit.
- Add security headers and a content security policy that allows Stripe, R2 media and the chat widget.
- Add loading, empty and error states to every screen. Add `error.tsx` and `not-found.tsx` per route group.
- Run an accessibility pass: keyboard navigation, focus states, labels, alt text, colour contrast.
- Extend Playwright to cover: register and verify, guest purchase, coupon purchase, admin fulfils an order, customer leaves a review, admin approves it.
- Write `docs/deploy.md` (env vars, database, R2 bucket and custom domain, Stripe webhook endpoint, Resend domain records, cron schedule) and `docs/admin-guide.md` for the owner.

Checks: the full Playwright suite passes. `pnpm build` has no warnings. No route under `/admin` or `/api` is reachable without the right session or secret.

### Phase 10: after launch

Build only when asked: A9 CSV import and export, abandoned cart emails with the cron route, S25 and S26 journal with A23, wishlist, back-in-stock alerts.

## 11. Email catalogue

| Template | Trigger | To | Dedupe key |
| --- | --- | --- | --- |
| verify-email | Registration | Customer | none, always send |
| password-reset | Reset request | Customer | none, always send |
| welcome | Email verified | Customer | `welcome:{userId}` |
| order-confirmation | Order becomes PAID | Customer | `{orderId}:PAID` |
| admin-new-order | Order becomes PAID | Admin alert address | `{orderId}:PAID:admin` |
| order-processing | PROCESSING | Customer | `{orderId}:PROCESSING` |
| order-shipped | SHIPPED | Customer | `{orderId}:SHIPPED` |
| order-out-for-delivery | OUT_FOR_DELIVERY | Customer | `{orderId}:OUT_FOR_DELIVERY` |
| order-delivered-review | DELIVERED | Customer | `{orderId}:DELIVERED` |
| order-cancelled | CANCELLED | Customer | `{orderId}:CANCELLED` |
| order-refunded | Refund issued | Customer | `{orderId}:REFUND:{refundId}` |
| staff-invite | Staff invited | Staff member | `invite:{inviteId}` |
| ticket-received | Contact form sent | Customer and admin | `ticket:{ticketId}` |
| ticket-reply | Admin replies | Customer | `ticket-msg:{messageId}` |
| low-stock | Cron finds variants under threshold | Admin alert address | `low-stock:{variantId}:{date}` |
| newsletter-welcome | Newsletter signup | Subscriber | `newsletter:{subscriberId}` |

Marketing templates include an unsubscribe link. Order templates include the order number, items, totals and a link to S20 or S24.

## 12. Assumed defaults for open questions

These are not confirmed by the client. Build to the default and keep each one easy to change.

| Question | Default to build |
| --- | --- |
| Payment provider | Stripe. Keep all provider code behind `PaymentProvider` so Paystack can replace it |
| Currency | One currency from `STORE_CURRENCY` |
| Guest checkout | Allowed, with an offer to create an account on S11 |
| Shipping | Flat-rate methods managed in A28. No live carrier rates |
| Tax | Prices are tax inclusive. No tax calculation |
| Tracking | Carrier name and tracking number typed by the admin. The link is built from a per-carrier URL pattern in settings |
| Returns | Handled by support and a manual refund. No self-service returns flow |
| Brand design | Warm neutral palette and a serif display font as placeholders in Tailwind theme tokens, to be replaced when brand assets arrive |
