import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type AppButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  icon?: ReactNode;
  variant?: "danger" | "ghost" | "primary" | "secondary";
};

export const AppButton = forwardRef<HTMLButtonElement, AppButtonProps>(
  function AppButton(
    { children, className = "", icon, variant = "primary", ...props },
    ref,
  ) {
    return (
      <button
        className={`app-button ${variant} ${className}`.trim()}
        ref={ref}
        {...props}
      >
        {icon ? <span className="button-icon">{icon}</span> : null}
        <span>{children}</span>
      </button>
    );
  },
);
