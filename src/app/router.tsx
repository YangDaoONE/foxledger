import {
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";

import { AuthGate } from "@/auth/AuthGate";
import { AppShell } from "@/app/AppShell";
import { HomePage } from "@/routes/HomePage";
import { SettingsPage } from "@/routes/SettingsPage";
import { StatsPage } from "@/routes/StatsPage";
import { TransactionsPage } from "@/routes/TransactionsPage";
import type { TransactionSortOption, TransactionType } from "@/features/transactions/types";

const rootRoute = createRootRoute({
  component: () => (
    <AuthGate>
      <AppShell />
    </AuthGate>
  ),
});

const indexRoute = createRoute({
  component: HomePage,
  getParentRoute: () => rootRoute,
  path: "/",
});

export const transactionsRoute = createRoute({
  component: TransactionsPage,
  getParentRoute: () => rootRoute,
  path: "/transactions",
  validateSearch: (search) => ({
    category: typeof search.category === "string" ? search.category : "",
    endDate: typeof search.endDate === "string" ? search.endDate : "",
    scope: typeof search.scope === "string" ? search.scope : "",
    search: typeof search.search === "string" ? search.search : "",
    sort:
      typeof search.sort === "string" &&
      ["date-desc", "date-asc", "amount-desc", "amount-asc"].includes(search.sort)
        ? (search.sort as TransactionSortOption)
        : "date-desc",
    startDate: typeof search.startDate === "string" ? search.startDate : "",
    type:
      typeof search.type === "string" &&
      ["expense", "income", "transfer"].includes(search.type)
        ? (search.type as TransactionType)
        : "",
  }),
});

const statsRoute = createRoute({
  component: StatsPage,
  getParentRoute: () => rootRoute,
  path: "/stats",
});

const settingsRoute = createRoute({
  component: SettingsPage,
  getParentRoute: () => rootRoute,
  path: "/settings",
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  transactionsRoute,
  statsRoute,
  settingsRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
