import { createClient } from "@supabase/supabase-js";

import { assertClientEnv, env } from "@/lib/env";

assertClientEnv();

export const supabase = createClient(env.supabaseUrl, env.supabasePublishableKey);
