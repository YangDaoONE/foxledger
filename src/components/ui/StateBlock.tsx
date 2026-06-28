import type { ReactNode } from "react";

type StateBlockProps = {
  children?: ReactNode;
  title: string;
  tone?: "danger" | "neutral" | "success" | "warning";
};

export function StateBlock({ children, title, tone = "neutral" }: StateBlockProps) {
  return (
    <div className={`state-block ${tone}`}>
      <strong>{title}</strong>
      {children ? <p>{children}</p> : null}
    </div>
  );
}
