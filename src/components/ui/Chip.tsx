import type { ButtonHTMLAttributes, ReactNode } from "react";

type ChipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  children: ReactNode;
};

export function Chip({ active = false, children, className = "", ...props }: ChipProps) {
  return (
    <button className={`chip ${active ? "active" : ""} ${className}`.trim()} type="button" {...props}>
      {children}
    </button>
  );
}
