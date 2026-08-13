import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
} from "@tanstack/react-router";

import { AuthGate } from "@/auth/AuthGate";
import { AppShell } from "@/app/AppShell";
import { validateTransactionSearch } from "@/features/transactions/transactionSearch";

const rootRoute = createRootRoute({
  component: () => (
    <AuthGate>
      <AppShell />
    </AuthGate>
  ),
});

const indexRoute = createRoute({
  component: lazyRouteComponent(() => import("@/routes/HomePage"), "HomePage"),
  getParentRoute: () => rootRoute,
  path: "/",
});

const transactionsRoute = createRoute({
  component: lazyRouteComponent(
    () => import("@/routes/TransactionsPage"),
    "TransactionsPage",
  ),
  getParentRoute: () => rootRoute,
  path: "/transactions",
  validateSearch: validateTransactionSearch,
});

const statsRoute = createRoute({
  component: lazyRouteComponent(() => import("@/routes/StatsPage"), "StatsPage"),
  getParentRoute: () => rootRoute,
  path: "/stats",
});

const settingsRoute = createRoute({
  component: lazyRouteComponent(
    () => import("@/routes/SettingsPage"),
    "SettingsPage",
  ),
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
