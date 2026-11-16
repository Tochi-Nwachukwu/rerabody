import type { ReactNode } from "react";

export function PageTitle({
  title,
  children,
  eyebrow,
}: {
  title: string;
  children?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-10 pb-6 text-center sm:pt-14">
      {eyebrow ? (
        <p className="text-muted-foreground mb-2 text-xs tracking-[0.2em] uppercase">{eyebrow}</p>
      ) : null}
      <h1 className="font-heading text-4xl font-medium sm:text-5xl">{title}</h1>
      {children ? <div className="text-muted-foreground mt-3">{children}</div> : null}
    </div>
  );
}
