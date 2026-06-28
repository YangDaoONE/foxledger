import type { ButtonHTMLAttributes, ReactNode } from "react";

type AppButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  icon?: ReactNode;
  variant?: "danger" | "ghost" | "primary" | "secondary";
};

export function AppButton({
  children,
  className = "",
  icon,
  variant = "primary",
  ...props
}: AppButtonProps) {
  return (
    <button className={`app-button ${variant} ${className}`.trim()} {...props}>
      {icon ? <span className="button-icon">{icon}</span> : null}
      <span>{children}</span>
    </button>
  );
}
