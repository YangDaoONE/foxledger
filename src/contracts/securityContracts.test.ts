import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cwd } from "node:process";
import { describe, expect, it } from "vitest";

const repositoryRoot = cwd();

function readRepositoryFile(relativePath: string) {
  return readFileSync(resolve(repositoryRoot, relativePath), "utf8");
}

function getPolicyBlock(migration: string, policyName: string) {
  const start = migration.indexOf(`create policy "${policyName}"`);
  const end = migration.indexOf(";", start);

  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);

  return migration.slice(start, end + 1);
}

describe("Supabase schema、RLS 与权限基线", () => {
  const schemaMigration = readRepositoryFile("supabase/migrations/001_create_transactions.sql");
  const grantMigration = readRepositoryFile(
    "supabase/migrations/002_grant_transactions_permissions.sql",
  );
  const aiBatchMigration = readRepositoryFile(
    "supabase/migrations/003_add_ai_batch_id.sql",
  );
  const permissionHardeningMigration = readRepositoryFile(
    "supabase/migrations/004_restrict_transactions_permissions.sql",
  );

  it("transactions 保持 RLS 开启，四类操作都只允许 authenticated 用户访问自己的行", () => {
    expect(schemaMigration).toMatch(
      /alter table public\.transactions enable row level security;/i,
    );

    const selectPolicy = getPolicyBlock(
      schemaMigration,
      "Users can select own transactions",
    );
    const insertPolicy = getPolicyBlock(
      schemaMigration,
      "Users can insert own transactions",
    );
    const updatePolicy = getPolicyBlock(
      schemaMigration,
      "Users can update own transactions",
    );
    const deletePolicy = getPolicyBlock(
      schemaMigration,
      "Users can delete own transactions",
    );

    expect(selectPolicy).toMatch(/for select\s+to authenticated/i);
    expect(selectPolicy).toMatch(/using \(\(select auth\.uid\(\)\) = user_id\)/i);
    expect(insertPolicy).toMatch(/for insert\s+to authenticated/i);
    expect(insertPolicy).toMatch(/with check \(\(select auth\.uid\(\)\) = user_id\)/i);
    expect(updatePolicy).toMatch(/for update\s+to authenticated/i);
    expect(updatePolicy).toMatch(/using \(\(select auth\.uid\(\)\) = user_id\)/i);
    expect(updatePolicy).toMatch(/with check \(\(select auth\.uid\(\)\) = user_id\)/i);
    expect(deletePolicy).toMatch(/for delete\s+to authenticated/i);
    expect(deletePolicy).toMatch(/using \(\(select auth\.uid\(\)\) = user_id\)/i);
  });

  it("authenticated 只获得现有 transactions CRUD 权限", () => {
    expect(grantMigration).toMatch(/grant usage on schema public to authenticated;/i);
    expect(grantMigration).toMatch(
      /grant select, insert, update, delete\s+on table public\.transactions\s+to authenticated;/i,
    );
    expect(grantMigration).not.toMatch(/service_role/i);
  });

  it("ai_batch_id migration 只增加 nullable UUID、AI 来源约束和用户级 partial index", () => {
    expect(aiBatchMigration).toMatch(
      /add column if not exists ai_batch_id uuid;/i,
    );
    expect(aiBatchMigration).not.toMatch(/ai_batch_id uuid not null/i);
    expect(aiBatchMigration).toMatch(
      /check \(ai_batch_id is null or source = 'ai'\);/i,
    );
    expect(aiBatchMigration).toMatch(
      /on public\.transactions \(user_id, ai_batch_id, created_at desc\)\s+where ai_batch_id is not null;/i,
    );
    expect(aiBatchMigration).not.toMatch(/disable row level security/i);
    expect(aiBatchMigration).not.toMatch(/create policy/i);
    expect(aiBatchMigration).not.toMatch(/grant .+ to authenticated/i);
    expect(aiBatchMigration).not.toMatch(/service[_-]?role/i);
  });

  it("权限收紧 migration 清除 anon/authenticated 旧权限后只恢复 authenticated CRUD", () => {
    expect(permissionHardeningMigration).toMatch(
      /revoke all privileges\s+on table public\.transactions\s+from anon, authenticated;/i,
    );
    expect(permissionHardeningMigration).toMatch(
      /grant select, insert, update, delete\s+on table public\.transactions\s+to authenticated;/i,
    );
    expect(permissionHardeningMigration).not.toMatch(/grant[^;]*\btruncate\b/i);
    expect(permissionHardeningMigration).not.toMatch(/grant[^;]*\breferences\b/i);
    expect(permissionHardeningMigration).not.toMatch(/grant[^;]*\btrigger\b/i);
    expect(permissionHardeningMigration).not.toMatch(/service[_-]?role/i);
  });
});

describe("AI Edge Function 安全基线", () => {
  const config = readRepositoryFile("supabase/config.toml");
  const edgeFunction = readRepositoryFile(
    "supabase/functions/parse-transaction/index.ts",
  );

  it("函数自处理 JWT，但内部仍验证 bearer token 与邮箱白名单", () => {
    expect(config).toMatch(
      /\[functions\.parse-transaction\]\s+verify_jwt = false/i,
    );
    expect(edgeFunction).toContain("getBearerToken(request)");
    expect(edgeFunction).toContain("verifySupabaseToken(token)");
    expect(edgeFunction).toContain("assertEmailAllowed(user.email)");
    expect(edgeFunction).toContain('getOptionalEnv("ALLOWED_EMAILS")');
  });

  it("只使用 publishable/anon key 校验用户，不引入 service_role", () => {
    expect(edgeFunction).toContain('getOptionalEnv("SUPABASE_PUBLISHABLE_KEY")');
    expect(edgeFunction).toContain('getOptionalEnv("SUPABASE_ANON_KEY")');
    expect(edgeFunction).not.toMatch(/service[_-]?role/i);
  });

  it("模型提示继续限定为当前输入解析，禁止历史与统计用途", () => {
    expect(edgeFunction).toContain("Parse only the current user input. Do not infer from history.");
    expect(edgeFunction).toContain("Do not calculate summaries or statistics.");
  });
});
