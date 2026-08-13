import type { ReactNode } from "react";

type PageIntroProps = {
  actions?: ReactNode;
  description: string;
  eyebrow: string;
  icon?: ReactNode;
  title: string;
};

export function PageIntro({
  actions,
  description,
  eyebrow,
  icon,
  title,
}: PageIntroProps) {
  return (
    <section className="page-intro">
      {icon ? <span className="page-intro-icon" aria-hidden="true">{icon}</span> : null}
      <div className="page-intro-copy">
        <p>{eyebrow}</p>
        <h2>{title}</h2>
        <span>{description}</span>
      </div>
      {actions ? <div className="page-intro-actions">{actions}</div> : null}
    </section>
  );
}
