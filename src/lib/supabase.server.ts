import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export function createSupabaseServerClient(accessToken: string) {
  const url = process.env["VITE_SUPABASE_URL"];
  const key = process.env["VITE_SUPABASE_ANON_KEY"];
  if (!url || !key) {
    throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
  }
  return createClient<Database>(url, key, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      storage: undefined as unknown as any,
    },
  });
}
