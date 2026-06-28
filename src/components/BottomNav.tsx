import { Link, useRouterState } from "@tanstack/react-router";
import { BarChart3, Home, ReceiptText, Settings } from "lucide-react";

const navItems = [
  { icon: Home, label: "首页", to: "/" },
  { icon: ReceiptText, label: "账单", to: "/transactions" },
  { icon: BarChart3, label: "统计", to: "/stats" },
  { icon: Settings, label: "设置", to: "/settings" },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <nav className="bottom-nav" aria-label="主导航">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);

        return (
          <Link
            aria-current={isActive ? "page" : undefined}
            className={`bottom-nav-item ${isActive ? "active" : ""}`}
            key={item.to}
            to={item.to}
          >
            <Icon size={20} aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
