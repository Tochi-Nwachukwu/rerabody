/**
 * Rera Body storefront copy: product text, homepage sections, policy pages, FAQ and SEO.
 * Used by prisma/seed.ts for new databases and by prisma/apply-content.ts to replace
 * leftover placeholder text in an existing database.
 *
 * Facts still to confirm with the owner are listed in docs/decisions.md ("Store copy").
 */

type Mark = { type: "link"; attrs: { href: string } } | { type: "bold" };
type Inline = { type: "text"; text: string; marks?: Mark[] };
type Block =
  | { type: "paragraph"; content: Inline[] }
  | { type: "heading"; attrs: { level: 2 | 3 }; content: Inline[] }
  | { type: "bulletList"; content: { type: "listItem"; content: Block[] }[] };
export type RichDoc = { type: "doc"; content: Block[] };

/** Text with [label](href) links and **bold** runs. */
function inline(text: string): Inline[] {
  const out: Inline[] = [];
  const re = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) out.push({ type: "text", text: text.slice(last, m.index) });
    if (m[3]) out.push({ type: "text", text: m[3], marks: [{ type: "bold" }] });
    else out.push({ type: "text", text: m[1], marks: [{ type: "link", attrs: { href: m[2] } }] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last) });
  return out;
}

/**
 * Builds a rich text document. Lines starting "## " are headings, lines starting "- " are
 * bullet points, anything else is a paragraph.
 */
export function rich(...lines: string[]): RichDoc {
  const content: Block[] = [];
  for (const line of lines) {
    if (line.startsWith("## ")) {
      content.push({ type: "heading", attrs: { level: 2 }, content: inline(line.slice(3)) });
    } else if (line.startsWith("- ")) {
      const item = {
        type: "listItem" as const,
        content: [{ type: "paragraph" as const, content: inline(line.slice(2)) }],
      };
      const prev = content.at(-1);
      if (prev?.type === "bulletList") prev.content.push(item);
      else content.push({ type: "bulletList", content: [item] });
    } else {
      content.push({ type: "paragraph", content: inline(line) });
    }
  }
  return { type: "doc", content };
}

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

export const CATEGORY_COPY: Record<string, string> = {
  "body-butters":
    "Rich body butters in Vanilla, Lemon Dream, Cranberry Fig + Lavender and True Blue. Every scent comes in 3, 8 and 16 oz jars.",
  loungewear:
    "Long wrap robes in bold prints, with wide sleeves, a tie belt and deep pockets. One free size.",
};

export const COLLECTION_COPY: Record<string, string> = {
  ...CATEGORY_COPY,
  "gift-sets":
    "Easy presents. Pair a robe with a jar of body butter, or send either one on its own.",
};

const BUTTER_SPECS = rich(
  "- Sizes: 3 oz, 8 oz and 16 oz jars",
  "- For use on skin only. If your skin is sensitive, try a little on your inner arm first.",
  "- Keep the lid on and store somewhere cool, out of direct sun.",
);

const ROBE_SPECS = rich(
  "- One free size with a relaxed fit",
  "- Long wrap front with a tie belt",
  "- Wide sleeves, with an inside tab that buttons on the outside to hold them rolled up",
  "- Two deep side pockets",
  "- Neatly finished collar",
);

const ROBE_SIZE_GUIDE = rich(
  "Our robes come in one free size with a relaxed, loose fit. The wrap front and tie belt let you choose how close it sits.",
  "If you'd like exact measurements before you order, [send us a message](/contact) and we'll help.",
);

export type ProductCopy = {
  description: RichDoc;
  specs: RichDoc;
  sizeGuide?: RichDoc;
  metaDescription: string;
};

export const PRODUCT_COPY: Record<string, ProductCopy> = {
  "vanilla-body-butter": {
    description: rich(
      "Warm, sweet vanilla in a rich body butter with a light shimmer, so your skin catches the light a little.",
      "It's the easy one. If you can't decide, start here.",
    ),
    specs: BUTTER_SPECS,
    metaDescription:
      "Rera Vanilla body butter: warm, sweet vanilla with a light shimmer. In 3, 8 and 16 oz jars.",
  },
  "lemon-dream-body-butter": {
    description: rich(
      "Bright and clean, like a lemon you've just cut open. A rich body butter for mornings, or any time you want to feel a bit more awake.",
    ),
    specs: BUTTER_SPECS,
    metaDescription:
      "Rera Lemon Dream body butter: bright, clean lemon in a rich body butter. In 3, 8 and 16 oz jars.",
  },
  "cranberry-fig-lavender-body-butter": {
    description: rich(
      "Tart cranberry and ripe fig, softened with lavender. A rich body butter for the end of the day, when you're finally sitting down.",
    ),
    specs: BUTTER_SPECS,
    metaDescription:
      "Rera Cranberry Fig + Lavender body butter: tart cranberry, ripe fig and lavender. In 3, 8 and 16 oz jars.",
  },
  "true-blue-body-butter": {
    description: rich(
      "The jar with the blue label. True Blue is a rich body butter you can use every day, from your shoulders down to your heels.",
    ),
    specs: BUTTER_SPECS,
    metaDescription:
      "Rera True Blue body butter, a rich everyday body butter. In 3, 8 and 16 oz jars.",
  },
  "purple-geo-robe": {
    description: rich(
      "Deep navy with a lilac print set in neat blocks. A long wrap robe with wide sleeves, a tie belt and two deep pockets.",
      "Roll the sleeves up and button them in place when you're making breakfast.",
    ),
    specs: ROBE_SPECS,
    sizeGuide: ROBE_SIZE_GUIDE,
    metaDescription:
      "The Rera Purple Geo robe: a long navy wrap robe with a lilac print, wide sleeves and deep pockets. One free size.",
  },
  "green-leaf-robe": {
    description: rich(
      "Dark green, covered in big white leaves. It's long, it wraps and ties at the waist, and the pockets are deep enough to actually use.",
    ),
    specs: ROBE_SPECS,
    sizeGuide: ROBE_SIZE_GUIDE,
    metaDescription:
      "The Rera Green Leaf robe: a long dark green wrap robe with a white leaf print and deep pockets. One free size.",
  },
  "mustard-botanical-robe": {
    description: rich(
      "Warm mustard with a white botanical print. A long wrap robe that looks as good on a slow Sunday as it does when someone rings the doorbell.",
    ),
    specs: ROBE_SPECS,
    sizeGuide: ROBE_SIZE_GUIDE,
    metaDescription:
      "The Rera Mustard Botanical robe: a long mustard wrap robe with a white botanical print. One free size.",
  },
  "olive-floral-robe": {
    description: rich(
      "Olive green with large white flowers. A long wrap robe with wide sleeves that button up, a tie belt and two deep pockets.",
    ),
    specs: ROBE_SPECS,
    sizeGuide: ROBE_SIZE_GUIDE,
    metaDescription:
      "The Rera Olive Floral robe: a long olive wrap robe with a white floral print. One free size.",
  },
};

export const SHIPPING_METHODS = [
  {
    name: "Standard delivery",
    price: 395,
    region: "United States",
    estimate: "3 to 5 business days",
  },
  {
    name: "Express delivery",
    price: 795,
    region: "United States",
    estimate: "1 to 2 business days",
  },
];

// ---------------------------------------------------------------------------
// Homepage
// ---------------------------------------------------------------------------

export const HOME_COPY = {
  hero: {
    headline: "Rich Body Butters & Elegant Women’s Loungewear.",
    subheadline:
      "Nourish and soften your skin with whipped botanical body butters, paired with breathable robes designed for everyday luxury and effortless gifting.",
    badge: "",
  },
  why: {
    heading: "Why Rera",
    body: "We care about what goes on your skin. Every jar is made at home from organic butters and natural oils, with over 15 years of hands-on experience behind it.",
    points: [
      "Rich organic butters and natural oils",
      "Made fresh when you order",
      "Breathable robes made for comfort",
    ],
  },
  ticker: [
    "Four scents: Vanilla, Lemon Dream, Cranberry Fig + Lavender and True Blue",
    "Every body butter comes in 3, 8 and 16 oz jars",
    "Robes in one free size, with deep pockets",
  ],
  featured: {
    "vanilla-body-butter": {
      badge: "With shimmer",
      body: "Our Vanilla body butter has a light shimmer in it, so your skin catches the light a little. Warm, sweet and easy to wear every day.",
    },
    "purple-geo-robe": {
      badge: "Just in",
      body: "Deep navy with a lilac print. A long wrap robe with wide sleeves, a tie belt and two deep pockets. One free size, cut loose.",
    },
  } as Record<string, { badge: string; body: string }>,
  shopAll: {
    heading: "Shop all",
    body: "Every scent in every size, plus the robes. Start anywhere.",
  },
  about: {
    heading: "About Rera",
    body: "Rera is a small brand with a short list: body butter for your skin, and robes for the hours you spend at home. We'd rather do a few things well than fill a page with products.\n\nIf you have a question about anything here, send us a message through the contact page.",
  },
  steps: {
    heading: "How to use",
    steps: [
      {
        title: "Start with damp skin",
        body: "Right after a shower or bath, pat yourself dry but leave your skin a little damp. The butter spreads further that way.",
      },
      {
        title: "Warm a little in your hands",
        body: "Scoop out a small amount and rub your palms together for a few seconds. It softens as it warms.",
      },
      {
        title: "Work it in",
        body: "Smooth it over your arms, legs and anywhere that feels dry. Elbows, knees and heels can take a bit more.",
      },
    ],
  },
  newsletter: {
    heading: "Join the list",
    body: "New scents, new prints and the occasional offer. We only email when there's something to say.",
  },
};

// Homepage title and the site's default search and share text.
export { SITE_DESCRIPTION as SEO_DESCRIPTION, SITE_TITLE as SEO_TITLE } from "../src/lib/seo";

// ---------------------------------------------------------------------------
// Pages and FAQ
// ---------------------------------------------------------------------------

export const PAGE_COPY: Record<string, { title: string; metaDescription: string; body: RichDoc }> =
  {
    "shipping-returns": {
      title: "Shipping and returns",
      metaDescription:
        "How Rera Body ships orders, how long delivery takes, and how to return something.",
      body: rich(
        "## Where we ship",
        "We ship within the United States.",
        "## How long it takes",
        "We pack orders within 1 to 3 business days. After that:",
        "- Standard delivery takes 3 to 5 business days",
        "- Express delivery takes 1 to 2 business days",
        "When your order ships, we email you a tracking link. You can also check on it any time from the [Track order](/orders/track) page.",
        "## Returns",
        "If something isn't right, you can return it within 30 days of delivery.",
        "- Robes need to be unworn and unwashed, with their tags still on.",
        "- Body butter can only be returned unopened, with the seal intact. Once a jar has been opened we can't take it back.",
        "To start a return, [send us a message](/contact) with your order number and what you'd like to send back. We'll reply with the return address.",
        "Return shipping is paid by you, unless we sent the wrong item or it arrived damaged.",
        "## Refunds",
        "Once your return reaches us and we've checked it, we refund the original payment method. It usually shows up within 5 to 10 business days, depending on your bank.",
        "## Damaged or wrong items",
        "If anything arrives damaged, or isn't what you ordered, [contact us](/contact) within 7 days of delivery with your order number and a photo. We'll send a replacement or refund you in full, and you won't pay for return shipping.",
        "## Changing or canceling an order",
        "Message us as soon as you can. If your order hasn't shipped yet, we can change or cancel it. Once it's on its way, you can return it instead.",
      ),
    },
    terms: {
      title: "Terms and conditions",
      metaDescription: "The terms that apply when you shop at Rera Body.",
      body: rich(
        "These terms apply when you browse the Rera Body website or place an order with us. By placing an order, you agree to them.",
        "## Orders",
        "When you place an order, we email you a confirmation. Your order is accepted once payment goes through.",
        "Sometimes we may need to cancel an order, for example if an item turns out to be out of stock or was listed at the wrong price. If that happens, we'll let you know and refund you in full.",
        "## Prices and payment",
        "Prices are in US dollars. Sales tax, where it applies, is worked out from your delivery address and added when you pay. Delivery costs are shown at checkout before you pay.",
        "Payments are handled by Stripe. We never see or store your full card number.",
        "## Delivery and returns",
        "How we ship, how long it takes and how returns work are set out on our [Shipping and returns](/shipping-returns) page.",
        "## Our products",
        "We do our best to show every product accurately, but colors can look a little different from screen to screen.",
        "Our body butters are for use on skin only. If your skin is sensitive, try a small amount on your inner arm first and stop using it if you notice any irritation.",
        "## Your account",
        "If you create an account, please keep your password to yourself. You're responsible for orders placed through your account.",
        "## Reviews",
        "Reviews should be honest and about the product. We read every review before it goes live and may decline ones that are abusive, off-topic or include personal details.",
        "## Our responsibility",
        "If something goes wrong with an order, our responsibility is limited to the amount you paid for it, as far as the law allows. Nothing in these terms affects your rights under consumer protection law.",
        "## Changes",
        "We may update these terms from time to time. The version on this page when you place an order is the one that applies to it.",
        "## Contact",
        "Questions about these terms? [Send us a message](/contact).",
      ),
    },
    privacy: {
      title: "Privacy policy",
      metaDescription: "What information Rera Body collects, why, and what you can do about it.",
      body: rich(
        "This policy explains what information we collect when you use the Rera Body website, what we do with it, and the choices you have.",
        "## What we collect",
        "- **Order details:** your name, email address, phone number, delivery address and what you bought.",
        "- **Account details:** if you create an account, your name, email address, saved addresses and order history.",
        "- **Messages and reviews:** anything you send us through the contact form, and reviews you write.",
        "- **Newsletter:** your email address, if you sign up.",
        "We don't collect your card details. Payments are handled by Stripe, and your card number goes straight to them.",
        "## How we use it",
        "- To process and deliver your order, and email you about it",
        "- To answer your messages",
        "- To run your account, if you have one",
        "- To send our newsletter, only if you've signed up",
        "## Who we share it with",
        "We share only what's needed with the services that help us run the store:",
        "- Stripe, to take payment and work out sales tax",
        "- Our email provider, to send order updates and the newsletter",
        "- Delivery carriers, to get your order to you",
        "We don't sell your information, and we don't use advertising trackers.",
        "## Cookies",
        "We use a small number of cookies that the site needs to work: one keeps track of your cart, and one keeps you signed in. We don't use cookies for advertising.",
        "## How long we keep it",
        "We keep order records for as long as we need them for accounting and tax. You can ask us to delete your account at any time.",
        "## Your choices",
        "- Every newsletter has an unsubscribe link at the bottom.",
        "- You can update your details and saved addresses in your account.",
        "- To see, correct or delete the information we hold about you, [send us a message](/contact).",
        "## Changes",
        "If we change this policy, we'll update this page.",
      ),
    },
  };

export const FAQ_COPY: { topic: string; question: string; answer: string }[] = [
  {
    topic: "Orders",
    question: "How do I track my order?",
    answer:
      "Your shipping email has a tracking link. You can also go to the Track order page and enter your order number with the email you used at checkout. If you have an account, your orders are listed there too.",
  },
  {
    topic: "Orders",
    question: "Can I change or cancel my order?",
    answer:
      "Message us as soon as you can with your order number. If it hasn't shipped yet, we can change or cancel it and refund you in full. Once it's on its way, you can return it instead.",
  },
  {
    topic: "Shipping",
    question: "How long does delivery take?",
    answer:
      "We pack orders within 1 to 3 business days. After that, Standard delivery takes 3 to 5 business days and Express takes 1 to 2. We'll email you a tracking link when it ships.",
  },
  {
    topic: "Shipping",
    question: "Where do you deliver?",
    answer: "We ship within the United States.",
  },
  {
    topic: "Products",
    question: "How should I store my body butter?",
    answer:
      "Keep the lid on and store it somewhere cool, out of direct sun. In hot weather it can soften or melt a little. Pop it somewhere cool and it will firm up again.",
  },
  {
    topic: "Returns",
    question: "What is your returns policy?",
    answer:
      "You can return items within 30 days of delivery. Robes need to be unworn and unwashed with the tags on, and body butter needs to be unopened. Our Shipping and returns page has the full details.",
  },
];
