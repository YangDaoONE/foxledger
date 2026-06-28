export const env = {
  supabasePublishableKey:
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    "",
  supabaseUrl:
    import.meta.env.VITE_SUPABASE_URL ?? import.meta.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
};

export function assertClientEnv() {
  if (!env.supabaseUrl) {
    throw new Error("缺少 VITE_SUPABASE_URL 或 NEXT_PUBLIC_SUPABASE_URL。");
  }

  if (!env.supabasePublishableKey) {
    throw new Error(
      "缺少 VITE_SUPABASE_PUBLISHABLE_KEY 或 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY。",
    );
  }
}
