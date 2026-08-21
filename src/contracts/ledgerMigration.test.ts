import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/005_add_ledgers.sql"),
  "utf8",
);

describe("M2 账本数据库迁移契约", () => {
  it("账本启用 RLS，并只向 authenticated 开放当前用户 CRUD", () => {
    expect(migration).toContain("alter table public.ledgers enable row level security");
    expect(migration).toContain("revoke all privileges");
    expect(migration).toContain("from anon, authenticated");
    expect(migration).toContain("grant select, insert, update, delete");
    expect(migration).toContain("using ((select auth.uid()) = user_id)");
    expect(migration).toContain("with check ((select auth.uid()) = user_id)");
  });

  it("先为所有现有用户创建默认账本并回填，再把 ledger_id 收紧为非空", () => {
    const createDefaultAt = migration.indexOf("insert into public.ledgers");
    const backfillAt = migration.indexOf("update public.transactions");
    const notNullAt = migration.indexOf("alter column ledger_id set not null");

    expect(createDefaultAt).toBeGreaterThan(-1);
    expect(backfillAt).toBeGreaterThan(createDefaultAt);
    expect(notNullAt).toBeGreaterThan(backfillAt);
    expect(migration).toContain("transactions ledger backfill incomplete");
  });

  it("复合外键和交易写策略共同阻止跨用户账本归属", () => {
    expect(migration).toContain("unique (id, user_id)");
    expect(migration).toContain("foreign key (ledger_id, user_id)");
    expect(migration).toContain("references public.ledgers(id, user_id)");
    expect(migration).toContain("on delete restrict");
    expect(migration).toContain("ledgers.id = transactions.ledger_id");
    expect(migration).toContain("ledgers.user_id = (select auth.uid())");
  });

  it("数据库侧保护最后一个账本，并用事务级锁覆盖并发删除", () => {
    expect(migration).toContain("prevent_last_ledger_delete");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("before delete on public.ledgers");
    expect(migration).toContain("last ledger cannot be deleted");
  });
});
