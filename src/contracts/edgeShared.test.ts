import { describe, expect, it, vi } from "vitest";

import {
  ForbiddenEmailError,
  assertEmailAllowed,
  createUserScopedSupabaseClient,
  getBearerToken,
  verifySupabaseToken,
  type SupabaseClientFactory,
} from "@shared/auth";
import { getOpenAiConfig, requestOpenAiChatContent } from "@shared/aiClient";
import type { EdgeEnvReader } from "@shared/edgeEnv";

function createEnv(values: Record<string, string>): EdgeEnvReader {
  return (name) => values[name] ?? null;
}

const edgeEnv = createEnv({
  AI_PROVIDER: "openai",
  ALLOWED_EMAILS: "owner@example.com, Second@example.com ",
  OPENAI_API_KEY: "test-openai-key",
  OPENAI_BASE_URL: "https://ai.example.com/v1/",
  OPENAI_MODEL: "test-model",
  SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
  SUPABASE_URL: "https://project.supabase.co",
});

describe("Edge 认证与用户级 Supabase client", () => {
  it("只接受非空 Bearer token", () => {
    expect(
      getBearerToken(
        new Request("https://example.com", {
          headers: { Authorization: "Bearer user-token" },
        }),
      ),
    ).toBe("user-token");
    expect(getBearerToken(new Request("https://example.com"))).toBeNull();
    expect(
      getBearerToken(
        new Request("https://example.com", {
          headers: { Authorization: "Bearer   " },
        }),
      ),
    ).toBeNull();
  });

  it("使用 publishable key 验证 token，并关闭 session persistence", async () => {
    const getUser = vi.fn().mockResolvedValue({
      data: { user: { email: "owner@example.com", id: "user-1" } },
      error: null,
    });
    const factory = vi.fn(() => ({ auth: { getUser } })) as unknown as SupabaseClientFactory<{
      auth: { getUser: typeof getUser };
    }>;

    await expect(verifySupabaseToken("user-token", factory, edgeEnv)).resolves.toEqual({
      email: "owner@example.com",
      id: "user-1",
    });
    expect(factory).toHaveBeenCalledWith(
      "https://project.supabase.co",
      "test-publishable-key",
      {
        auth: { autoRefreshToken: false, persistSession: false },
      },
    );
    expect(getUser).toHaveBeenCalledWith("user-token");
  });

  it("只读 client 使用同一 publishable key，并把当前用户 token 放进 Authorization", () => {
    const client = { from: vi.fn() };
    const factory = vi.fn(() => client) as unknown as SupabaseClientFactory<typeof client>;

    expect(createUserScopedSupabaseClient("user-token", factory, edgeEnv)).toBe(client);
    expect(factory).toHaveBeenCalledWith(
      "https://project.supabase.co",
      "test-publishable-key",
      {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: "Bearer user-token" } },
      },
    );
  });

  it("邮箱白名单忽略大小写，并明确拒绝未授权账号或缺失配置", () => {
    expect(() => assertEmailAllowed("OWNER@example.com", edgeEnv)).not.toThrow();
    expect(() => assertEmailAllowed("other@example.com", edgeEnv)).toThrow(
      ForbiddenEmailError,
    );
    expect(() => assertEmailAllowed("owner@example.com", createEnv({}))).toThrow(
      "Missing ALLOWED_EMAILS",
    );
  });
});

describe("公共 OpenAI client", () => {
  it("从 Edge secrets 构建配置并发送严格 JSON 请求", async () => {
    expect(getOpenAiConfig(edgeEnv)).toEqual({
      apiKey: "test-openai-key",
      baseUrl: "https://ai.example.com/v1",
      model: "test-model",
    });

    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({ choices: [{ message: { content: "  {\"ok\":true}  " } }] }),
        { headers: { "Content-Type": "application/json" }, status: 200 },
      ),
    ) as unknown as typeof fetch;

    await expect(
      requestOpenAiChatContent({
        fetchImpl,
        messages: [{ content: "strict", role: "system" }],
        readEnv: edgeEnv,
        responseFormat: { type: "json_object" },
      }),
    ).resolves.toBe('{"ok":true}');

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = vi.mocked(fetchImpl).mock.calls[0];
    expect(url).toBe("https://ai.example.com/v1/chat/completions");
    expect(init?.headers).toEqual({
      Authorization: "Bearer test-openai-key",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      messages: [{ content: "strict", role: "system" }],
      model: "test-model",
      response_format: { type: "json_object" },
      temperature: 0.1,
    });
  });

  it("保留上游错误语义，且不支持非 openai provider", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ error: { message: "upstream failed" } }), {
        headers: { "Content-Type": "application/json" },
        status: 502,
      }),
    ) as unknown as typeof fetch;

    await expect(
      requestOpenAiChatContent({
        fetchImpl,
        messages: [{ content: "strict", role: "system" }],
        readEnv: edgeEnv,
      }),
    ).rejects.toThrow("upstream failed");
    expect(() =>
      getOpenAiConfig(createEnv({ ...Object.fromEntries([]), AI_PROVIDER: "other" })),
    ).toThrow("当前仅支持 AI_PROVIDER=openai");
  });
});
