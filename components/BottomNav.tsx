import { ChartNoAxesColumnIncreasing, Home, ReceiptText, Settings } from "lucide-react";

export type DashboardView = "home" | "transactions" | "stats" | "settings";

const navItems = [
  { label: "首页", value: "home", icon: Home },
  { label: "账单", value: "transactions", icon: ReceiptText },
  { label: "统计", value: "stats", icon: ChartNoAxesColumnIncreasing },
  { label: "设置", value: "settings", icon: Settings },
] satisfies Array<{ label: string; value: DashboardView; icon: typeof Home }>;

type BottomNavProps = {
  activeView: DashboardView;
  onViewChange: (view: DashboardView) => void;
};

export function BottomNav({ activeView, onViewChange }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="主导航">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeView === item.value;

        return (
          <button
            aria-current={isActive ? "page" : undefined}
            className={isActive ? "bottom-nav-item active" : "bottom-nav-item"}
            key={item.label}
            type="button"
            onClick={() => onViewChange(item.value)}
          >
            <Icon size={20} aria-hidden="true" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
