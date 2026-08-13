import type { ReactNode } from "react";

type SectionBlockProps = {
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  description?: string;
  eyebrow?: string;
  title?: string;
};

export function SectionBlock({
  action,
  children,
  className = "",
  description,
  eyebrow,
  title,
}: SectionBlockProps) {
  return (
    <section className={`section-block ${className}`.trim()}>
      {eyebrow || title || description || action ? (
        <header className="section-heading">
          <div>
            {eyebrow ? <p>{eyebrow}</p> : null}
            {title ? <h2>{title}</h2> : null}
            {description ? <span>{description}</span> : null}
          </div>
          {action ? <div className="section-heading-action">{action}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}
