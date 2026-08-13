export type EdgeEnvReader = (name: string) => string | null | undefined;

type DenoLikeRuntime = {
  env?: {
    get?: (name: string) => string | undefined;
  };
};

export const readRuntimeEnv: EdgeEnvReader = (name) => {
  const runtime = (globalThis as typeof globalThis & { Deno?: DenoLikeRuntime }).Deno;
  return runtime?.env?.get?.(name) ?? null;
};

export function getOptionalEdgeEnv(name: string, readEnv: EdgeEnvReader = readRuntimeEnv) {
  const value = readEnv(name)?.trim();
  return value ? value : null;
}

export function getRequiredEdgeEnv(name: string, readEnv: EdgeEnvReader = readRuntimeEnv) {
  const value = getOptionalEdgeEnv(name, readEnv);

  if (!value) {
    throw new Error(`Missing ${name} in Edge Function secrets.`);
  }

  return value;
}

export function getSupabasePublishableKey(readEnv: EdgeEnvReader = readRuntimeEnv) {
  const key =
    getOptionalEdgeEnv("SUPABASE_PUBLISHABLE_KEY", readEnv) ??
    getOptionalEdgeEnv("SUPABASE_ANON_KEY", readEnv);

  if (!key) {
    throw new Error(
      "Missing SUPABASE_PUBLISHABLE_KEY or SUPABASE_ANON_KEY in Edge Function secrets.",
    );
  }

  return key;
}
