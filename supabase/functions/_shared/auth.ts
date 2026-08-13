import {
  getOptionalEdgeEnv,
  getRequiredEdgeEnv,
  getSupabasePublishableKey,
  readRuntimeEnv,
  type EdgeEnvReader,
} from "./edgeEnv.ts";

export type EdgeAuthUser = {
  email?: string;
  id: string;
};

type SupabaseAuthClient = {
  auth: {
    getUser: (accessToken: string) => Promise<{
      data: { user: EdgeAuthUser | null };
      error: unknown;
    }>;
  };
};

export type SupabaseClientFactory<Client = unknown> = (
  supabaseUrl: string,
  publishableKey: string,
  options: {
    auth: {
      autoRefreshToken: false;
      persistSession: false;
    };
    global?: {
      headers: {
        Authorization: string;
      };
    };
  },
) => Client;

export class ForbiddenEmailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenEmailError";
  }
}

export function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

export function getAllowedEmails(readEnv: EdgeEnvReader = readRuntimeEnv) {
  return (getOptionalEdgeEnv("ALLOWED_EMAILS", readEnv) ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function assertEmailAllowed(
  email: string | undefined,
  readEnv: EdgeEnvReader = readRuntimeEnv,
) {
  const allowedEmails = getAllowedEmails(readEnv);

  if (allowedEmails.length === 0) {
    throw new Error("Missing ALLOWED_EMAILS in Edge Function secrets.");
  }

  if (!email || !allowedEmails.includes(email.toLowerCase())) {
    throw new ForbiddenEmailError("当前账号不允许使用 AI 解析。");
  }
}

export async function verifySupabaseToken(
  accessToken: string,
  createClient: SupabaseClientFactory<SupabaseAuthClient>,
  readEnv: EdgeEnvReader = readRuntimeEnv,
) {
  const supabase = createClient(
    getRequiredEdgeEnv("SUPABASE_URL", readEnv),
    getSupabasePublishableKey(readEnv),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error || !data.user) {
    return null;
  }

  return data.user;
}

export function createUserScopedSupabaseClient<Client>(
  accessToken: string,
  createClient: SupabaseClientFactory<Client>,
  readEnv: EdgeEnvReader = readRuntimeEnv,
) {
  return createClient(
    getRequiredEdgeEnv("SUPABASE_URL", readEnv),
    getSupabasePublishableKey(readEnv),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    },
  );
}
