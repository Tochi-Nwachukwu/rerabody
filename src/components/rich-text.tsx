import Link from "@tiptap/extension-link";
import StarterKit from "@tiptap/starter-kit";
import { renderToReactElement } from "@tiptap/static-renderer/pm/react";

import { cn } from "@/lib/utils";

const extensions = [StarterKit.configure({ link: false }), Link];

function isDoc(value: unknown): value is { type: "doc"; content?: unknown[] } {
  return (
    typeof value === "object" && value !== null && (value as { type?: unknown }).type === "doc"
  );
}

/** Renders stored Tiptap JSON on the server. */
export function RichText({ value, className }: { value: unknown; className?: string }) {
  if (!isDoc(value) || !value.content?.length) return null;
  return (
    <div className={cn("prose-rera", className)}>
      {renderToReactElement({ content: value as never, extensions })}
    </div>
  );
}

export function hasRichText(value: unknown): boolean {
  return isDoc(value) && !!value.content?.length;
}

/** Plain text from Tiptap JSON, for meta descriptions and structured data. */
export function richTextToPlain(value: unknown, max = 300): string {
  const out: string[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const n = node as { text?: string; content?: unknown[] };
    if (typeof n.text === "string") out.push(n.text);
    n.content?.forEach(walk);
  };
  walk(value);
  const text = out.join(" ").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
