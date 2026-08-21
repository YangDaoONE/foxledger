import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/app/queryKeys";
import { useAuthUser } from "@/auth/AuthProvider";
import { listCachedLedgersForUser } from "@/features/ledgers/localLedgers";
import type { CachedLedger } from "@/features/ledgers/types";

type LedgerContextValue = {
  activeLedger: CachedLedger | null;
  activeLedgerId: string | null;
  isLoading: boolean;
  ledgers: CachedLedger[];
  setActiveLedgerId: (ledgerId: string) => void;
};

const LedgerContext = createContext<LedgerContextValue | null>(null);

function getActiveLedgerStorageKey(userId: string) {
  return `foxledger:active-ledger:${userId}`;
}

export function LedgerProvider({ children }: { children: ReactNode }) {
  const user = useAuthUser();
  const userId = user.id;
  const [activeLedgerId, setActiveLedgerIdState] = useState<string | null>(null);
  const ledgersQuery = useQuery({
    queryFn: () => listCachedLedgersForUser(userId),
    queryKey: queryKeys.ledgers(userId),
  });
  const ledgers = useMemo(() => ledgersQuery.data ?? [], [ledgersQuery.data]);

  useEffect(() => {
    if (ledgers.length === 0) {
      setActiveLedgerIdState(null);
      return;
    }

    setActiveLedgerIdState((current) => {
      if (current && ledgers.some((ledger) => ledger.id === current)) {
        return current;
      }

      const stored = window.localStorage.getItem(
        getActiveLedgerStorageKey(userId),
      );
      const next =
        stored && ledgers.some((ledger) => ledger.id === stored)
          ? stored
          : ledgers[0].id;
      window.localStorage.setItem(getActiveLedgerStorageKey(userId), next);
      return next;
    });
  }, [ledgers, userId]);

  const setActiveLedgerId = useCallback(
    (ledgerId: string) => {
      if (!ledgers.some((ledger) => ledger.id === ledgerId)) {
        return;
      }

      window.localStorage.setItem(
        getActiveLedgerStorageKey(userId),
        ledgerId,
      );
      setActiveLedgerIdState(ledgerId);
    },
    [ledgers, userId],
  );

  const activeLedger =
    ledgers.find((ledger) => ledger.id === activeLedgerId) ?? null;
  const value = useMemo<LedgerContextValue>(
    () => ({
      activeLedger,
      activeLedgerId: activeLedger?.id ?? null,
      isLoading: ledgersQuery.isLoading,
      ledgers,
      setActiveLedgerId,
    }),
    [activeLedger, ledgers, ledgersQuery.isLoading, setActiveLedgerId],
  );

  return (
    <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>
  );
}

export function useLedgerState() {
  const value = useContext(LedgerContext);

  if (!value) {
    throw new Error("useLedgerState must be used inside LedgerProvider.");
  }

  return value;
}

export function useActiveLedger() {
  const { activeLedger } = useLedgerState();

  if (!activeLedger) {
    throw new Error("当前没有可用账本。");
  }

  return activeLedger;
}
