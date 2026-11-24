# Running your store: admin guide

This guide explains how to look after the Rera Body store day to day. Sign in at **yourstore.com/admin/login** with your email and password. On a phone, the menu is behind the button at the top left.

What you see in the menu depends on your role. As the owner you see everything.

## Before you launch

The store was set up with **placeholder** content so it could be built and tested. Before customers arrive, replace or remove all of it:

1. **Products**: edit or delete the sample products, prices and stock.
2. **Homepage**: rewrite every section and add your photos.
3. **Pages**: write your real Terms, Privacy, and Shipping and returns text.
4. **FAQ**: replace every answer.
5. **Settings**: add your contact details, delivery prices, carriers and the email address that should receive alerts.

## Daily work

### The dashboard

The first page shows today's revenue and orders, orders waiting to be packed, low stock, reviews to approve and open messages. Click a tile to go straight to that list.

### Orders

1. A new paid order appears under **Orders** as *Paid*, and you receive a "New order" email.
2. Open the order. Check the items and the delivery address.
3. Click **Mark processing** while you pack. The customer gets an email.
4. Click **Packing slip** to print a list of items for the parcel.
5. When it leaves, click **Mark shipped** and enter the carrier and tracking number. The customer gets an email with a tracking link.
6. Click **Mark out for delivery**, then **Mark delivered**. The delivered email asks the customer for a review.

Every step sends exactly one email, even if you click twice. Use **Resend status email** if a customer says they did not get it.

**Orders marked "Review"** need a look from you. This happens when two people bought the last item at the same moment, or a payment arrived for an order that had been cancelled. The order page explains why. Contact the customer, then refund or restock as needed and click **Mark review done**.

**Internal notes** on the order page are for you and your team only.

### Cancelling and refunding

- **Cancel order** works until the order ships. If the customer has paid, the full amount is refunded automatically. Tick *Return the items to stock* if they are still on your shelf.
- **Refund** lets you refund all or part of the payment, for example for a return or a damaged item. Tick *Return the items to stock* if they came back in a sellable condition. A full refund marks the order *Refunded*. The customer gets an email for every refund.

Refunds go back to the customer's card and can take a few working days to show.

### Stock

**Inventory** lists every size and colour with its stock. Use the *Stock* filter to see low or sold-out items.

Click **Adjust** to change stock:

- **Add**: a delivery arrived (reason: Restock).
- **Remove**: damaged or lost (reason: Damage).
- **Set to**: after a stock count (reason: Correction).

Click **History** to see every change, including sales and refunds. Stock never goes below zero.

You receive a daily low stock email when anything reaches its alert level. Set the alert level per variant on the product page.

### Reviews

Customers can review a product only after their order is delivered, and only once per item. New reviews wait under **Reviews → Pending**.

- **Approve** publishes the review and updates the product's star rating.
- **Reject** hides it (you can note a reason for yourself).
- **Unpublish** takes a published review down again.
- **Feature on homepage** shows it in the testimonials section.

### Messages

The contact form creates a ticket under **Support**. Open it, type your reply and click **Send reply**. The customer receives it by email. If the customer answers by email, their reply arrives in your normal inbox, not in the admin. Close tickets when you are done.

## Products

1. Go to **Products → Add product**.
2. Enter the name and description.
3. Click **Add images**. Upload photos (JPEG, PNG or WebP, up to 8 MB each) or choose ones you uploaded before. Drag to reorder. Click **Cover** on the main photo.
4. Under **Options**, add sizes or colours, for example *Size* with values `S, M, L`. A row is created for every combination.
5. For each row, set the SKU, price, optional "compare at" price (shows the item as on sale) and opening stock.
6. Choose the category and collections on the right.
7. Fill in the search engine listing if you want a custom title and description.
8. Click **Save** to keep it as a draft, or **Publish** to put it in the shop. Use **Preview** to see a draft as customers will.

To stop selling something, set it to **Archived**. Its order history stays. Products that have never been ordered can be deleted.

**Categories** power the shop filter. **Collections** group products for menus and homepage banners; drag to reorder products inside a collection.

## Homepage

**Homepage** lists the sections on your homepage in order.

- Drag sections to reorder them.
- Click the eye to hide or show a section.
- Click **Edit** to change its text, images, links or products.
- Use **Duplicate** or **Delete** as needed, or add a new section at the bottom.

Nothing changes on the live site until you click **Publish**. Click **Preview** to see your draft first, or **Discard** to throw away unpublished changes.

## Pages and FAQ

**Pages** holds Terms, Privacy, Shipping and returns and any extra pages you add. Edit the text, click **Save draft**, check it with **Preview draft**, then **Publish**.

**FAQ** questions appear on the FAQ page grouped by topic. Changes are live as soon as you save. Drag to reorder.

## Sales tax

Sales tax is worked out by Stripe from the delivery address and added on the payment page. Customers see "Total before tax" at checkout, and the tax appears on their receipt, the order page and the emails.

1. Your accountant tells you which states you must collect tax in.
2. In the Stripe dashboard, go to **Tax → Registrations** and add each of those states. Stripe only collects tax in states listed there. Stripe also warns you when sales in another state get close to the point where you must register.
3. Under **Categories**, open each category and choose its **Sales tax category**: *Skin care products* for body butters, *Clothing and footwear* for loungewear. Products without a category are taxed as general goods.
4. Ask your developer to switch tax on.

**Reports** show revenue without tax, and the tax collected separately. Stripe's own tax reports (Stripe → Tax → Reports) are what you or your accountant file from.

## Coupons

1. **Coupons → New coupon**.
2. Choose a code (customers type it in the cart), a percentage or fixed amount, and optional start and end dates.
3. Optional limits: minimum spend, total uses, uses per customer, and specific products or categories.
4. Tick **Show on the offers page** to advertise it.

Open a coupon to see every order that used it. Click **Disable now** to stop a code immediately.

## Customers

**Customers** lists everyone with an account, their orders and total spend. Guest orders appear only under Orders. From a customer's page you can correct their name or phone, or deactivate the account.

## Media

**Media** holds every image you have uploaded. Add alt text (a short description) to each image: it helps customers using screen readers and search engines. Images that are in use cannot be deleted; the message tells you where they are used.

## Your team

**Staff → Invite someone**: enter their email and choose a role. They receive an email with a link valid for 7 days.

| Role | Can do |
| --- | --- |
| Owner | Everything |
| Manager | Products, stock, orders (not refunds), customers, reviews, coupons, content, support, reports |
| Inventory staff | Products, stock and image uploads |
| Fulfilment staff | View orders and update status and tracking |
| Content editor | Homepage, pages, FAQ and images |

Change what a role can do under **Roles**. The Owner role cannot be changed, and nobody else can remove your owner access.

**Deactivate** signs a person out and blocks them. **Remove** takes away admin access but keeps their customer account.

The **Audit log** records every admin action: who, what and when.

## Reports

**Reports** shows sales, best products, customers and coupon use for any date range. Revenue is after refunds. Use **Orders CSV** or **Customers CSV** to download a spreadsheet.

## Settings

- **Store**: name, logo, contact details, social links and footer links. Write footer links one per line as `Label | /link`.
- **Shipping**: delivery options and prices shown at checkout, and carriers with their tracking link pattern (use `{tracking}` where the tracking number goes).
- **Notifications**: the email that receives new orders, low stock and messages. **Send test email** checks it works.
- **SEO**: the default title and description for search engines.
- **Chat**: turn on a Tawk.to or Crisp chat bubble by pasting your account id.

## If something looks wrong

- **A customer paid but the order is still pending**: payment confirmations come from Stripe. Check the Stripe dashboard. Contact your developer if confirmations are failing.
- **Emails are not arriving**: use **Send test email** in Settings. Check the customer's spam folder.
- **A change does not show on the site**: refresh the page. Homepage changes need **Publish**; page text changes need **Publish** on the page.
