"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useState, useTransition } from "react";
import { toast } from "sonner";

import { type ImageValue, ImageField } from "@/components/admin/image-field";
import { MoneyInput } from "@/components/admin/money-input";
import { FormMessage, TextAreaField, TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatMoney } from "@/lib/money";
import type { SiteSettings } from "@/lib/settings";
import {
  deleteShippingMethodAction,
  saveSettingAction,
  saveShippingMethodAction,
  sendTestEmailAction,
} from "@/server/actions/settings";

type Method = {
  id?: string;
  name: string;
  price: number;
  region: string;
  estimate: string;
  isActive: boolean;
};

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="bg-card flex max-w-2xl flex-col gap-4 rounded-xl border p-4 sm:p-5">
      <div>
        <h2 className="font-semibold">{title}</h2>
        {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** "Label | /link" per line, for the footer columns. */
function linksToText(links: { label: string; href: string }[]) {
  return links.map((l) => `${l.label} | ${l.href}`).join("\n");
}
function textToLinks(text: string) {
  return text
    .split("\n")
    .map((line) => line.split("|").map((p) => p.trim()))
    .filter(([label, href]) => label && href)
    .map(([label, href]) => ({ label, href }));
}

// A28 settings
export function SettingsForms({
  settings,
  logo,
  methods,
  currency,
}: {
  settings: SiteSettings;
  logo: ImageValue;
  methods: Method[];
  currency: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [store, setStore] = useState(settings.store);
  const [logoValue, setLogoValue] = useState<ImageValue>(logo);
  const [social, setSocial] = useState(settings.social);
  const [footerNote, setFooterNote] = useState(settings.footer.note);
  const [columns, setColumns] = useState(
    settings.footer.columns.map((c) => ({ title: c.title, text: linksToText(c.links) })),
  );
  const [notifications, setNotifications] = useState(settings.notifications);
  const [seo, setSeo] = useState(settings.seo);
  const [carriers, setCarriers] = useState(settings.tracking.carriers);
  const [chat, setChat] = useState(settings.chatWidget);
  const [editing, setEditing] = useState<Method | null>(null);

  function save(parts: { key: keyof SiteSettings; value: unknown }[], message = "Settings saved") {
    setError(null);
    start(async () => {
      for (const p of parts) {
        const res = await saveSettingAction(p);
        if (!res.ok) return setError(res.error);
      }
      toast.success(message);
      router.refresh();
    });
  }

  return (
    <Tabs defaultValue="store">
      <TabsList className="mb-4 w-full justify-start overflow-x-auto">
        <TabsTrigger value="store">Store</TabsTrigger>
        <TabsTrigger value="shipping">Shipping</TabsTrigger>
        <TabsTrigger value="notifications">Notifications</TabsTrigger>
        <TabsTrigger value="seo">SEO</TabsTrigger>
        <TabsTrigger value="chat">Chat</TabsTrigger>
      </TabsList>
      {error ? (
        <div className="mb-4 max-w-2xl">
          <FormMessage>{error}</FormMessage>
        </div>
      ) : null}

      <TabsContent value="store" className="flex flex-col gap-6">
        <Panel title="Store details">
          <TextField
            id="s-name"
            label="Store name"
            value={store.name}
            onChange={(e) => setStore({ ...store, name: e.target.value })}
          />
          <ImageField
            label="Logo (shown in the header instead of the name)"
            value={logoValue}
            onChange={setLogoValue}
          />
          <TextField
            id="s-email"
            label="Contact email"
            type="email"
            value={store.contactEmail}
            onChange={(e) => setStore({ ...store, contactEmail: e.target.value })}
          />
          <TextField
            id="s-phone"
            label="Contact phone"
            value={store.contactPhone}
            onChange={(e) => setStore({ ...store, contactPhone: e.target.value })}
          />
          <TextAreaField
            id="s-address"
            label="Address (shown in the footer)"
            value={store.address}
            onChange={(e) => setStore({ ...store, address: e.target.value })}
          />
        </Panel>
        <Panel title="Social links">
          <TextField
            id="s-ig"
            label="Instagram URL"
            value={social.instagram}
            onChange={(e) => setSocial({ ...social, instagram: e.target.value })}
          />
          <TextField
            id="s-tt"
            label="TikTok URL"
            value={social.tiktok}
            onChange={(e) => setSocial({ ...social, tiktok: e.target.value })}
          />
          <TextField
            id="s-fb"
            label="Facebook URL"
            value={social.facebook}
            onChange={(e) => setSocial({ ...social, facebook: e.target.value })}
          />
        </Panel>
        <Panel title="Footer" description="One link per line, written as Label | /link.">
          {columns.map((c, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-lg border p-3">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <TextField
                    id={`col-${i}`}
                    label="Column title"
                    value={c.title}
                    onChange={(e) =>
                      setColumns(
                        columns.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)),
                      )
                    }
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remove column"
                  onClick={() => setColumns(columns.filter((_, j) => j !== i))}
                >
                  <Trash2 />
                </Button>
              </div>
              <TextAreaField
                id={`col-links-${i}`}
                label="Links"
                rows={5}
                value={c.text}
                onChange={(e) =>
                  setColumns(columns.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))
                }
              />
            </div>
          ))}
          {columns.length < 4 ? (
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => setColumns([...columns, { title: "", text: "" }])}
            >
              <Plus /> Add column
            </Button>
          ) : null}
          <TextField
            id="f-note"
            label="Small print (for example the company name)"
            value={footerNote}
            onChange={(e) => setFooterNote(e.target.value)}
          />
        </Panel>
        <Button
          className="self-start"
          disabled={pending}
          onClick={() =>
            save([
              { key: "store", value: { ...store, logoMediaId: logoValue?.id ?? null } },
              { key: "social", value: social },
              {
                key: "footer",
                value: {
                  note: footerNote,
                  columns: columns.map((c) => ({ title: c.title, links: textToLinks(c.text) })),
                },
              },
            ])
          }
        >
          Save store settings
        </Button>
      </TabsContent>

      <TabsContent value="shipping" className="flex flex-col gap-6">
        <Panel title="Delivery options" description="Flat-rate options shown at checkout.">
          <ul className="flex flex-col divide-y rounded-lg border">
            {methods.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">
                    {m.name}{" "}
                    {!m.isActive ? <span className="text-muted-foreground">(off)</span> : null}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {formatMoney(m.price, currency)}
                    {m.estimate ? ` · ${m.estimate}` : ""}
                    {m.region ? ` · ${m.region}` : ""}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => setEditing(m)}>
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        if (!window.confirm(`Delete ${m.name}?`)) return;
                        const res = await deleteShippingMethodAction({ id: m.id! });
                        if (!res.ok) return setError(res.error);
                        router.refresh();
                      })
                    }
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          {editing ? (
            <div className="flex flex-col gap-3 rounded-lg border p-3">
              <TextField
                id="m-name"
                label="Name"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
              <Field>
                <FieldLabel htmlFor="m-price">Price</FieldLabel>
                <MoneyInput
                  id="m-price"
                  currency={currency}
                  value={editing.price}
                  onChange={(v) => setEditing({ ...editing, price: v ?? 0 })}
                />
              </Field>
              <TextField
                id="m-estimate"
                label="Delivery estimate"
                placeholder="3 to 5 working days"
                value={editing.estimate}
                onChange={(e) => setEditing({ ...editing, estimate: e.target.value })}
              />
              <TextField
                id="m-region"
                label="Region"
                value={editing.region}
                onChange={(e) => setEditing({ ...editing, region: e.target.value })}
              />
              <Field orientation="horizontal">
                <Switch
                  id="m-active"
                  checked={editing.isActive}
                  onCheckedChange={(c) => setEditing({ ...editing, isActive: c })}
                />
                <FieldLabel htmlFor="m-active">Offer at checkout</FieldLabel>
              </Field>
              <div className="flex gap-2">
                <Button
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const res = await saveShippingMethodAction({
                        ...editing,
                        region: editing.region,
                        estimate: editing.estimate,
                      });
                      if (!res.ok) return setError(res.error);
                      toast.success("Delivery option saved");
                      setEditing(null);
                      router.refresh();
                    })
                  }
                >
                  Save option
                </Button>
                <Button variant="outline" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() =>
                setEditing({ name: "", price: 0, region: "", estimate: "", isActive: true })
              }
            >
              <Plus /> Add delivery option
            </Button>
          )}
        </Panel>
        <Panel
          title="Carriers"
          description="The tracking link is built from the URL pattern; {tracking} is replaced by the tracking number."
        >
          {carriers.map((c, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
              <TextField
                id={`c-name-${i}`}
                label="Carrier"
                value={c.name}
                onChange={(e) =>
                  setCarriers(
                    carriers.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)),
                  )
                }
              />
              <TextField
                id={`c-url-${i}`}
                label="Tracking URL pattern"
                placeholder="https://carrier.example/track/{tracking}"
                value={c.urlPattern}
                onChange={(e) =>
                  setCarriers(
                    carriers.map((x, j) => (j === i ? { ...x, urlPattern: e.target.value } : x)),
                  )
                }
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remove carrier"
                onClick={() => setCarriers(carriers.filter((_, j) => j !== i))}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCarriers([...carriers, { name: "", urlPattern: "" }])}
            >
              <Plus /> Add carrier
            </Button>
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                save(
                  [{ key: "tracking", value: { carriers: carriers.filter((c) => c.name.trim()) } }],
                  "Carriers saved",
                )
              }
            >
              Save carriers
            </Button>
          </div>
        </Panel>
      </TabsContent>

      <TabsContent value="notifications" className="flex flex-col gap-6">
        <Panel title="Notifications">
          <TextField
            id="n-email"
            label="Admin alert email"
            type="email"
            description="Receives new order, low stock and contact form alerts."
            value={notifications.adminAlertEmail}
            onChange={(e) =>
              setNotifications({ ...notifications, adminAlertEmail: e.target.value })
            }
          />
          <TextField
            id="n-low"
            label="Default low stock threshold for new variants"
            type="number"
            min={0}
            value={notifications.defaultLowStockThreshold}
            onChange={(e) =>
              setNotifications({
                ...notifications,
                defaultLowStockThreshold: Math.max(0, Math.floor(Number(e.target.value) || 0)),
              })
            }
          />
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={pending}
              onClick={() => save([{ key: "notifications", value: notifications }])}
            >
              Save
            </Button>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await sendTestEmailAction({});
                  if (!res.ok) return setError(res.error);
                  toast.success(`Test email sent to ${res.data.to}`);
                })
              }
            >
              Send test email
            </Button>
          </div>
        </Panel>
      </TabsContent>

      <TabsContent value="seo" className="flex flex-col gap-6">
        <Panel
          title="Search engines"
          description="Used for the homepage and wherever a page has no title or description of its own."
        >
          <TextField
            id="seo-title"
            label="Default title"
            maxLength={70}
            value={seo.defaultTitle}
            onChange={(e) => setSeo({ ...seo, defaultTitle: e.target.value })}
          />
          <TextAreaField
            id="seo-desc"
            label="Default description"
            maxLength={170}
            value={seo.defaultDescription}
            onChange={(e) => setSeo({ ...seo, defaultDescription: e.target.value })}
          />
          <Button
            className="self-start"
            disabled={pending}
            onClick={() => save([{ key: "seo", value: seo }])}
          >
            Save
          </Button>
        </Panel>
      </TabsContent>
      <TabsContent value="chat" className="flex flex-col gap-6">
        <Panel
          title="Chat widget"
          description="Shows a live chat bubble on the storefront. Paste the id from your Tawk.to or Crisp account."
        >
          <Field>
            <FieldLabel htmlFor="chat-provider">Provider</FieldLabel>
            <select
              id="chat-provider"
              className="bg-background h-8 rounded-lg border px-2 text-sm"
              value={chat.provider}
              onChange={(e) =>
                setChat({ ...chat, provider: e.target.value as typeof chat.provider })
              }
            >
              <option value="tawk">Tawk.to</option>
              <option value="crisp">Crisp</option>
            </select>
          </Field>
          <TextField
            id="chat-id"
            label={
              chat.provider === "tawk" ? "Property and widget id (property/widget)" : "Website id"
            }
            description={
              chat.provider === "tawk"
                ? "From the embed code: https://embed.tawk.to/THIS-PART"
                : "From Crisp settings, Website ID"
            }
            value={chat.siteId}
            onChange={(e) => setChat({ ...chat, siteId: e.target.value.trim() })}
          />
          <Field orientation="horizontal">
            <Switch
              id="chat-on"
              checked={chat.enabled}
              onCheckedChange={(v) => setChat({ ...chat, enabled: v })}
            />
            <FieldLabel htmlFor="chat-on">Show the chat widget</FieldLabel>
          </Field>
          <Button
            className="self-start"
            disabled={pending}
            onClick={() => save([{ key: "chatWidget", value: chat }])}
          >
            Save
          </Button>
        </Panel>
      </TabsContent>
    </Tabs>
  );
}
