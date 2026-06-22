import { ChartNoAxesColumnIncreasing, Home, ReceiptText, Settings } from "lucide-react";

const navItems = [
  { label: "首页", href: "#home", icon: Home, active: true },
  { label: "账单", href: "#transactions", icon: ReceiptText, active: false },
  { label: "统计", href: "#stats", icon: ChartNoAxesColumnIncreasing, active: false },
  { label: "设置", href: "#settings", icon: Settings, active: false },
];

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="主导航">
      {navItems.map((item) => {
        const Icon = item.icon;

        return (
          <a
            className={item.active ? "bottom-nav-item active" : "bottom-nav-item"}
            href={item.href}
            key={item.label}
          >
            <Icon size={20} aria-hidden="true" />
            <span>{item.label}</span>
          </a>
        );
      })}
    </nav>
  );
}
