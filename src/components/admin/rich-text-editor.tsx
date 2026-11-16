"use client";

import Link from "@tiptap/extension-link";
import { EditorContent, type JSONContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Undo2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type RichTextValue = JSONContent | null;

export function RichTextEditor({
  value,
  onChange,
  label,
  id,
  minHeight = "8rem",
}: {
  value: RichTextValue;
  onChange: (v: RichTextValue) => void;
  label: string;
  id: string;
  minHeight?: string;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ link: false }),
      Link.configure({ openOnClick: false, autolink: true }),
    ],
    content: value ?? undefined,
    editorProps: {
      attributes: {
        id,
        "aria-label": label,
        "aria-multiline": "true",
        role: "textbox",
        class: "prose-rera max-w-none px-3 py-2 outline-none",
        style: `min-height:${minHeight}`,
      },
    },
    onUpdate({ editor }) {
      onChange(editor.isEmpty ? null : editor.getJSON());
    },
  });

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            h2: e.isActive("heading", { level: 2 }),
            h3: e.isActive("heading", { level: 3 }),
            bullet: e.isActive("bulletList"),
            ordered: e.isActive("orderedList"),
            quote: e.isActive("blockquote"),
            link: e.isActive("link"),
          }
        : null,
  });

  const tools = [
    {
      label: "Bold",
      icon: Bold,
      active: state?.bold,
      run: () => editor?.chain().focus().toggleBold().run(),
    },
    {
      label: "Italic",
      icon: Italic,
      active: state?.italic,
      run: () => editor?.chain().focus().toggleItalic().run(),
    },
    {
      label: "Heading",
      icon: Heading2,
      active: state?.h2,
      run: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      label: "Subheading",
      icon: Heading3,
      active: state?.h3,
      run: () => editor?.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      label: "Bulleted list",
      icon: List,
      active: state?.bullet,
      run: () => editor?.chain().focus().toggleBulletList().run(),
    },
    {
      label: "Numbered list",
      icon: ListOrdered,
      active: state?.ordered,
      run: () => editor?.chain().focus().toggleOrderedList().run(),
    },
    {
      label: "Quote",
      icon: Quote,
      active: state?.quote,
      run: () => editor?.chain().focus().toggleBlockquote().run(),
    },
    {
      label: "Link",
      icon: Link2,
      active: state?.link,
      run: () => {
        if (!editor) return;
        const previous = editor.getAttributes("link").href as string | undefined;
        const href = window.prompt("Link address (leave empty to remove)", previous ?? "https://");
        if (href === null) return;
        if (href.trim() === "") editor.chain().focus().unsetLink().run();
        else editor.chain().focus().extendMarkRange("link").setLink({ href: href.trim() }).run();
      },
    },
    { label: "Undo", icon: Undo2, active: false, run: () => editor?.chain().focus().undo().run() },
    { label: "Redo", icon: Redo2, active: false, run: () => editor?.chain().focus().redo().run() },
  ];

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium" onClick={() => editor?.commands.focus()}>
        {label}
      </label>
      <div className="bg-background focus-within:ring-ring/50 rounded-lg border focus-within:ring-3">
        <div
          role="toolbar"
          aria-label={`${label} formatting`}
          className="flex flex-wrap gap-0.5 border-b p-1"
        >
          {tools.map((t) => (
            <Button
              key={t.label}
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t.label}
              aria-pressed={t.active ? true : undefined}
              className={cn(t.active && "bg-muted")}
              onClick={t.run}
            >
              <t.icon />
            </Button>
          ))}
        </div>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
