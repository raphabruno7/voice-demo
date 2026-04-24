import { createClient, SupabaseClient } from "@supabase/supabase-js";

function getUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  return url;
}

let _supabase: SupabaseClient | null = null;
export function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(getUrl(), process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  }
  return _supabase;
}

let _admin: SupabaseClient | null = null;
export function getSupabaseAdmin() {
  if (!_admin) {
    _admin = createClient(getUrl(), process.env.SUPABASE_SERVICE_ROLE_KEY!);
  }
  return _admin;
}

// Convenience re-exports for server components (call inside async functions)
export const supabase = { from: (...args: Parameters<SupabaseClient["from"]>) => getSupabase().from(...args) };
export const supabaseAdmin = { from: (...args: Parameters<SupabaseClient["from"]>) => getSupabaseAdmin().from(...args) };
