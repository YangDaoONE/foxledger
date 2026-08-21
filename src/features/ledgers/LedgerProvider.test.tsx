import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listCachedLedgersForUser: vi.fn(),
}));

vi.mock("@/auth/AuthProvider", () => ({
  useAuthUser: () => ({ id: "user-1" }),
}));

vi.mock("@/features/ledgers/localLedgers", () => ({
  listCachedLedgersForUser: mocks.listCachedLedgersForUser,
}));

import {
  LedgerProvider,
  useLedgerState,
} from "@/features/ledgers/LedgerProvider";

const ledgerOneId = "33333333-3333-4333-8333-333333333333";
const ledgerTwoId = "44444444-4444-4444-8444-444444444444";
const storageKey = "foxledger:active-ledger:user-1";
const ledgers = [
  {
    cache_key: `user-1:${ledgerOneId}`,
    created_at: "2026-08-22T01:00:00.000Z",
    id: ledgerOneId,
    name: "默认账本",
    updated_at: "2026-08-22T01:00:00.000Z",
    user_id: "user-1",
  },
  {
    cache_key: `user-1:${ledgerTwoId}`,
    created_at: "2026-08-22T02:00:00.000Z",
    id: ledgerTwoId,
    name: "旅行账本",
    updated_at: "2026-08-22T02:00:00.000Z",
    user_id: "user-1",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  mocks.listCachedLedgersForUser.mockResolvedValue(ledgers);
});

function Probe() {
  const { activeLedger, setActiveLedgerId } = useLedgerState();

  return (
    <>
      <output data-testid="active-ledger">{activeLedger?.name ?? "none"}</output>
      <button type="button" onClick={() => setActiveLedgerId(ledgerTwoId)}>
        切换旅行账本
      </button>
    </>
  );
}

function renderProvider() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <LedgerProvider>
        <Probe />
      </LedgerProvider>
    </QueryClientProvider>,
  );
}

describe("当前账本状态", () => {
  it("恢复当前用户上次选择，并允许仅凭缓存离线切换", async () => {
    window.localStorage.setItem(storageKey, ledgerTwoId);
    renderProvider();

    await waitFor(() =>
      expect(screen.getByTestId("active-ledger")).toHaveTextContent("旅行账本"),
    );
    expect(mocks.listCachedLedgersForUser).toHaveBeenCalledWith("user-1");
  });

  it("无效历史选择回退首个账本，切换后持久化 ledgerId", async () => {
    window.localStorage.setItem(storageKey, "deleted-ledger");
    renderProvider();

    await waitFor(() =>
      expect(screen.getByTestId("active-ledger")).toHaveTextContent("默认账本"),
    );
    expect(window.localStorage.getItem(storageKey)).toBe(ledgerOneId);

    fireEvent.click(screen.getByRole("button", { name: "切换旅行账本" }));
    expect(screen.getByTestId("active-ledger")).toHaveTextContent("旅行账本");
    expect(window.localStorage.getItem(storageKey)).toBe(ledgerTwoId);
  });
});
