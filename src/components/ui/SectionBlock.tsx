import type { ReactNode } from "react";

type SectionBlockProps = {
  children: ReactNode;
  eyebrow?: string;
  title?: string;
};

export function SectionBlock({ children, eyebrow, title }: SectionBlockProps) {
  return (
    <section className="section-block">
      {eyebrow || title ? (
        <header className="section-heading">
          {eyebrow ? <p>{eyebrow}</p> : null}
          {title ? <h2>{title}</h2> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}
