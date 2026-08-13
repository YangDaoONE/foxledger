import type { ButtonHTMLAttributes } from "react";

type MetricCardProps = {
  helper?: string;
  label: string;
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>["onClick"];
  tone?: "balance" | "expense" | "income" | "neutral" | "transfer";
  value: string;
};

export function MetricCard({
  helper,
  label,
  onClick,
  tone = "neutral",
  value,
}: MetricCardProps) {
  const content = (
    <>
      <span className="metric-card-label">{label}</span>
      <strong className="metric-card-value">{value}</strong>
      {helper ? <small className="metric-card-helper">{helper}</small> : null}
    </>
  );

  if (onClick) {
    return (
      <button className={`metric-card ${tone}`} type="button" onClick={onClick}>
        {content}
      </button>
    );
  }

  return <div className={`metric-card ${tone}`}>{content}</div>;
}
