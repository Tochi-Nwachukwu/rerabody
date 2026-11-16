# Rera Body ecommerce build plan

Nov 15, 2026 · @Tochi

Every screen, button and action: Screen map

## Stack decision

Keep the monolith. One Next.js app with Postgres and Prisma covers every item in the planning document, and it is the fastest route for a two-week build with one developer. The reference site appears to run on Next.js too (its images load through `/_next/image`).

The monolith needs six things around it that the planning document does not name.

| Need | Choice | Why |
| --- | --- | --- |
| Auth and roles | Auth.js or Better Auth with the Prisma adapter | Customer accounts and staff accounts share one User table, separated by role |
| Payments | Stripe Checkout (hosted page) plus a webhook route | The webhook is the only place an order becomes paid. Never trust the success redirect |
| Media | Cloudflare R2 with presigned uploads, served from a custom domain | A serverless Next.js deploy has no disk, so product and CMS images cannot live in the app |
| Email | Resend with React Email templates | One `sendEmail` module, called after the database commit |
| Scheduled work | A cron-triggered route (Vercel Cron or EventBridge) | Abandoned cart emails and low stock alerts need a clock, and a monolith has no worker |
| Search | Postgres full text search with `pg_trgm` | Enough for autocomplete on a small catalogue. No Algolia needed |

Two details matter with Prisma on serverless hosting. Use a pooled connection string (Neon, Supabase pooler or PgBouncer) so functions do not exhaust Postgres connections. Store money as integers in minor units and copy the product name and price onto each order item, so later price edits never change past orders.

### What I would do differently

The one alternative worth a look is Payload CMS. It installs inside the same Next.js app, runs on Postgres, and ships an admin panel, media library, drafts and role-based access out of the box. That is roughly a third of this build. The cost is that Payload owns its schema through Drizzle, so you would drop Prisma or run two data layers. If Prisma is a firm choice, build the admin yourself and keep the CMS small: homepage sections stored as typed JSON blocks, plus simple rich text pages.

I would not build live chat. Embed a widget such as Tawk.to or Crisp and spend the time on checkout and the order lifecycle. I would also avoid a separate commerce backend like Medusa, because it breaks the monolith and adds a second deploy for a catalogue this size.

## Site map

Rera takes the [Noorvana](https://noorvanaskincare.com/) page structure almost one for one, minus the skin quiz. Every route below was read from the Noorvana homepage links on 15 Nov 2026.

| Noorvana route | Rera route | What it holds |
| --- | --- | --- |
| `/` | `/` | Homepage built from CMS sections |
| `/shop` | `/shop` | Full catalogue with category filter, sort and pagination |
| `/collections` | `/collections` and `/collections/[slug]` | Body Butters, Nightwear, plus bundles or gift sets |
| `/products/[slug]` | `/products/[slug]` | Gallery with zoom, variant picker, stock, specs, size guide, reviews |
| `/search` | `/search` | Results page, fed by the header autocomplete |
| `/cart` | `/cart` | Line items, quantity, coupon field, totals |
| none visible | `/checkout`, `/checkout/success` | Address and shipping, then the Stripe hosted page |
| `/account` | `/account`, `/account/orders/[id]`, `/account/addresses` | Profile, order history and tracking, saved addresses |
| `/wishlist` | `/account/wishlist` | Saved products. Phase 2 |
| `/waitlist` | Back-in-stock button on the product page | Email capture per variant. Phase 2 |
| `/offer` | `/offers` | Products on sale and active promo codes |
| `/blog` | `/journal` and `/journal/[slug]` | Blog posts for SEO |
| `/faq` | `/faq` | CMS-managed questions |
| `/contact` | `/contact` | Contact form that opens a support ticket |
| `/policies` | `/terms`, `/privacy`, `/shipping-returns` | CMS rich text pages |
| `/quiz` | not built | A skin quiz does not fit body butter and nightwear |
| none | `/admin/*` | The dashboard, behind a role check |

### Homepage sections

Each section is one CMS block that the admin can edit, reorder, hide or show. The order follows Noorvana.

1. Hero with headline, button, rotating images and a customer count badge
2. Three collection banners: Body Butters, Nightwear, Gift Sets
3. Best sellers grid of six products, picked by hand or by sales
4. Why Rera, a brand statement with four points
5. Text ticker strip
6. Two featured product spotlights with badges such as "Most loved" and "Just in"
7. New arrivals with category tabs
8. Shop all callout
9. Brand story
10. How to use or what to expect, three steps
11. Testimonials carousel, drawn from approved reviews
12. Newsletter signup
13. Footer with Shop, Help and About columns and contact details

## Operations

The planning document breaks down into 15 modules. The last column points back to its numbered items.

| Module | Operations | Doc items |
| --- | --- | --- |
| Accounts | Register, verify email, log in, log out, reset password, edit profile, add and edit addresses, delete account | 2 |
| Catalogue | Create, edit, archive and publish products. Manage categories and collections. Upload and reorder images. Add variants with size, colour, SKU and own price. Set specs and size guide | 1, 5, 10 |
| Inventory | Set stock per variant, adjust stock with a reason, record every movement, set a low stock threshold, alert on low stock, mark out of stock, bulk import and export by CSV | 5 |
| Navigation and search | List by category, filter, sort by price, newest and rating, paginate, autocomplete as the user types, full results page | 3, 9 |
| Cart | Add, change quantity, remove, persist for guests by cookie, merge into the account cart on login, validate stock and price on every load, apply and remove a coupon | 4 |
| Checkout and payment | Collect address, choose shipping, compute totals, create the pending order, create the Stripe session, handle the webhook for paid, failed and expired, decrement stock, issue refunds | 19 |
| Orders | List and filter orders, view detail, move status, add tracking number and carrier, add internal notes, cancel, refund, record each status change with who and when | 17 to 24 |
| Notifications | Send an email on each lifecycle event, alert the admin on a new order, log every send, retry failures | 17, 20 to 24 |
| Reviews | Submit a star rating and text for a purchased product, hold as pending, approve or reject, publish, recompute the product average, show a verified buyer badge | 12, 15 |
| CMS | Edit, reorder, show and hide homepage sections. Edit Terms, Privacy and Shipping pages. Manage FAQ. Write and publish blog posts. Media library. Site settings such as logo, footer links and the ticker text | 13, 14 |
| Coupons | Create percent or fixed codes, set start and end dates, minimum spend, usage limit in total and per customer, restrict to products or categories, disable, view redemptions | 6 |
| Staff and permissions | Invite a staff user by email, assign a role, edit role permissions, deactivate a user, keep an audit log of admin actions | 16 |
| Dashboard and analytics | Revenue by day, week and month, order count, average order value, top products, low stock list, new customers, coupon usage, CSV export | 6 |
| Customers and support | Customer list with order history and total spend, contact form to ticket, reply to a ticket by email, close a ticket, FAQ page, chat widget embed | 6, 7 |
| SEO and marketing | Meta title and description per product, page and post. Sitemap, robots file, Open Graph images, product structured data, newsletter signup and unsubscribe, abandoned cart emails | 8 |

Mobile layout (item 11) is a constraint on every screen, not a module. Design each page at phone width first.

## Customer flows

A customer touches eight flows. The purchase flow is the one that must work on day one.

### Discover and browse

1. Lands on the homepage, a collection or a product from a link or search engine.
2. Opens a category from the menu, or types in the search bar and picks an autocomplete suggestion.
3. Filters and sorts the grid, then opens a product.
4. On the product page, views images with zoom, picks a size or colour, sees price and stock for that variant, and reads the specs, size guide and approved reviews.

### Cart

1. Adds a variant to the cart. A guest cart is stored against a cookie.
2. Opens the cart, changes quantities or removes items.
3. Enters a coupon code. The server validates dates, limits and minimum spend, then shows the discount.
4. The server rechecks stock and price each time the cart loads and flags any line that changed.

### Checkout and payment

1. Clicks checkout. Signs in, registers, or continues as a guest with an email (see the open question on guest checkout).
2. Enters or selects a delivery address and picks a shipping option.
3. Reviews totals: subtotal, discount, shipping, total.
4. The server creates the order as Pending payment and redirects to Stripe.
5. Pays on Stripe. The webhook marks the order Paid, decrements stock, records the coupon redemption and clears the cart.
6. Lands on the success page with the order number and receives the confirmation email.
7. If payment fails or the session expires, the order is marked Cancelled, nothing is deducted, and the cart stays intact.

### Account

1. Registers with email and password, then verifies by an emailed link.
2. Logs in. Any guest cart merges into the account cart.
3. Views order history, opens an order and sees its status timeline and tracking number.
4. Edits profile, addresses and password. Resets a forgotten password by email.

### Order tracking

1. Receives an email at each status change.
2. Follows the link in the email to the order page. Guests use a signed link that needs no login.

### Review

1. Receives the review request email after delivery.
2. Opens the link, gives a star rating and written feedback for each product bought.
3. Sees a message that the review is awaiting approval.
4. The review shows on the product page once the admin approves it.

### Support

1. Reads the FAQ page.
2. Sends a message through the contact form or the chat widget.
3. Receives a ticket confirmation email, then the admin's reply by email.

### Marketing

1. Signs up for the newsletter in the footer and receives a welcome email.
2. Leaves items in the cart without paying, then receives a reminder email with a link back to the cart.
3. Unsubscribes with one click from any marketing email.

## Admin flows

The admin side has ten flows, all under `/admin` and all gated by permission checks on the server.

### Sign in and staff

1. The owner account is seeded at deploy. She signs in at `/admin/login`.
2. She invites a staff member by email and assigns a role.
3. The staff member opens the invite link, sets a password and lands in the dashboard with only the menus their role allows.
4. She can change a role, edit what a role may do, or deactivate a user. Every admin action is written to the audit log.

Suggested starting roles:

| Role | Can do |
| --- | --- |
| Owner | Everything, including staff, roles, refunds and settings |
| Manager | Products, inventory, orders, coupons, reviews, CMS, customers, reports |
| Inventory staff | Products and stock only |
| Fulfilment staff | View orders, update status and tracking |
| Content editor | CMS pages, homepage sections, blog, FAQ |

### Products

1. Creates a product with name, description, category, collections, specs and SEO fields.
2. Uploads images, drags them into order and sets the cover.
3. Adds variants. Each has options such as size and colour, a SKU, a price, an optional compare-at price and a stock count.
4. Saves as draft, previews, then publishes. Archiving hides a product without deleting its order history.

### Inventory

1. Opens the stock table, filtered by low stock or category.
2. Adjusts a variant's stock and picks a reason: restock, damage, correction.
3. Exports the catalogue to CSV, edits it in a spreadsheet and imports it back. The import shows a preview with row errors before anything is saved.
4. Receives a low stock email when a variant crosses its threshold.

### Orders

1. Receives the new order email and sees the order in the dashboard as Paid.
2. Opens it, checks items and address, and marks it Processing while packing.
3. Marks it Shipped and enters the carrier and tracking number.
4. Marks it Out for delivery, then Delivered.
5. Each change sends the matching customer email and adds a line to the order timeline.
6. Can cancel or refund from the order page. A refund calls Stripe and restocks the items if she ticks that option.

### Reviews

1. Opens the pending queue and reads each review with its product and order.
2. Approves or rejects. Approved reviews go live and the product's average rating updates.
3. Can unpublish a live review later or feature one in the homepage testimonials.

### Homepage and content

1. Opens the homepage editor and sees the list of sections.
2. Edits a section's text, images, button link or chosen products.
3. Drags sections into a new order, hides one, or adds another from the block library.
4. Previews, then publishes. The live page revalidates at once.
5. Edits Terms, Privacy and Shipping pages in a rich text editor. Manages FAQ entries and blog posts the same way.
6. Uploads images to the media library and reuses them anywhere.

### Coupons

1. Creates a code with a percent or fixed discount.
2. Sets the active dates, minimum spend, usage limits and any product or category restriction.
3. Watches redemptions and revenue per code, and disables a code when needed.

### Customers and support

1. Searches the customer list and opens a profile with orders and total spend.
2. Opens the ticket inbox, reads a message and replies. The reply goes out by email.
3. Closes the ticket.

### Dashboard and reports

1. Sees today's revenue, orders awaiting fulfilment, low stock and pending reviews on the home screen.
2. Picks a date range for revenue, order count, average order value and top products.
3. Exports orders or customers to CSV.

### Settings

1. Sets store name, logo, contact email, social links and footer content.
2. Sets shipping options and rates.
3. Sets the admin notification email and the low stock threshold.

## Order lifecycle and emails

An order moves through six states on the normal path, and each move sends one email through Resend. This covers items 17 to 24 of the planning document.

| State | Trigger | Who moves it | Customer email | Admin email |
| --- | --- | --- | --- | --- |
| Pending payment | Customer clicks pay | System | none | none |
| Paid | Stripe webhook confirms payment | System | Order confirmation with items and total | New order alert |
| Processing | Admin starts packing | Admin | Your order is being prepared | none |
| Shipped | Admin adds carrier and tracking number | Admin | Shipped, with tracking link | none |
| Out for delivery | Admin updates status | Admin | Out for delivery today | none |
| Delivered | Admin updates status | Admin | Delivered, please rate and review | none |
| Cancelled | Payment failed or expired, or admin cancels | System or admin | Order cancelled | none |
| Refunded | Admin issues refund | Admin | Refund confirmation | none |

Allow only forward moves plus Cancelled and Refunded, and enforce that on the server. Write each move to an `OrderStatusEvent` row, and build the customer's tracking timeline from those rows.

### Other emails

| Email | Trigger | Type |
| --- | --- | --- |
| Verify your email | Registration | Transactional |
| Password reset | Forgot password request | Transactional |
| Staff invite | Admin invites a user | Transactional |
| Review approved | Admin approves a review. Optional | Transactional |
| Ticket received and ticket reply | Contact form, admin reply | Transactional |
| Low stock alert | Variant crosses threshold. Goes to admin | Transactional |
| Newsletter welcome | Footer signup | Marketing |
| Abandoned cart | Cart with an email untouched for a set time, checked by cron | Marketing |

### Resend setup

1. Fade grants DNS access. Add the Resend SPF and DKIM records on a sending subdomain such as `mail.` so store email reputation stays separate from her inbox.
2. Send order mail from `orders@` and marketing from `hello@`, with replies routed to her real inbox.
3. Write each template as a React Email component in the repo, sharing one branded layout.
4. Put all sends behind one `sendEmail` function. Call it after the database transaction commits, never inside it.
5. Record each send in an `EmailLog` table with a unique key per order and event, so a retried webhook cannot send the same email twice.
6. Add a Resend webhook route to capture bounces and complaints, and stop sending marketing mail to those addresses.
7. Give every marketing email an unsubscribe link. Order emails do not need one.

## Data model

The Prisma schema needs about 28 models in seven groups.

| Group | Models | Notes |
| --- | --- | --- |
| Identity | `User`, `Role`, `Permission`, `Address`, `AuditLog` | One User table for customers and staff. Permissions are strings such as `orders.update`, checked in every server action |
| Catalogue | `Category`, `Collection`, `Product`, `ProductImage`, `ProductVariant` | Price and stock live on the variant. A product with no options still has one default variant |
| Inventory | `InventoryMovement` | One row per stock change with quantity, reason and actor. Stock on the variant is the running total |
| Cart | `Cart`, `CartItem` | Cart belongs to a user or a guest token. `updatedAt` plus an email drives abandoned cart reminders |
| Orders | `Order`, `OrderItem`, `OrderStatusEvent`, `Payment`, `Shipment` | Order items snapshot name, variant, price and image. Payment stores the Stripe session and payment intent ids |
| Promotion and trust | `Coupon`, `CouponRedemption`, `Review` | Review links to user, product and order item, with a status of pending, approved or rejected |
| Content and comms | `HomeSection`, `Page`, `BlogPost`, `Faq`, `Media`, `SiteSetting`, `SupportTicket`, `TicketMessage`, `NewsletterSubscriber`, `EmailLog` | `HomeSection` has a type, a position, a visible flag and a JSON `data` field validated with Zod per type |

Three rules protect the data. Decrement stock inside the same transaction that marks the order Paid, with a check that stock does not go below zero. Make the Stripe webhook idempotent by storing the event id. Add a unique constraint on one review per order item.

## Build order and open questions

The full list is more than two weeks of work for one developer. Ship the purchase path and the admin core in the two weeks, and move the items marked Phase 2 into the support period.

| Days | Work |
| --- | --- |
| 1 to 2 | Project setup, Prisma schema, auth with roles, seed data, storefront layout and design tokens |
| 3 to 4 | Admin products, variants, images, categories. Storefront shop, collection and product pages |
| 5 to 6 | Search and autocomplete, cart, coupons, checkout, Stripe session and webhook |
| 7 to 8 | Orders admin, status moves, Resend templates for the whole lifecycle, customer account and order pages |
| 9 to 10 | Homepage section editor, policy pages, FAQ, media library, site settings |
| 11 to 12 | Reviews with moderation, staff invites and permissions, dashboard metrics, inventory adjustments |
| 13 to 14 | SEO fields, sitemap, mobile pass, contact form and chat widget, testing with Stripe test mode, deploy |

Phase 2: CSV import and export, abandoned cart emails, blog, wishlist, back-in-stock alerts, deeper reports.

### Questions for Fade

- [ ] Which country is the Stripe account registered in, and which currency will the store charge? Stripe needs a business in a supported country. If Rera sells in naira from Nigeria, Paystack is the swap, and only the checkout module changes.
- [ ] Is guest checkout allowed? The planning document says users create an account. Forcing registration usually costs sales, so I suggest guest checkout with an offer to create an account afterwards.
- [ ] How is shipping priced: flat rate, by region, or free above a threshold? Which carrier, and does it give tracking links?
- [ ] What sizes and colours does the nightwear come in, and is there a size chart?
- [ ] What is the returns and refund policy, and who writes the Terms and Privacy text?
- [ ] Which email address should receive new order and low stock alerts?
- [ ] Product photos, logo files and brand colours.
