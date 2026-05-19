import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const isPlaceholder = (v: string | undefined): boolean =>
  !v || v.trim().length === 0 || v.startsWith('your_');

/**
 * True when both Supabase env vars are set. The whole auth flow gates on
 * this — if Supabase isn't configured (e.g. local demo without a project),
 * the app falls back to the seeded mock data and skips auth entirely.
 */
export const isSupabaseConfigured = (): boolean =>
  !isPlaceholder(URL) && !isPlaceholder(ANON);

/**
 * Lazy-construct the client only when configured. When not configured we
 * return `null` and every caller knows to skip the Supabase path.
 */
function makeClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  return createClient(URL as string, ANON as string, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

export const supabase: SupabaseClient | null = makeClient();

/** Convenience: throws if Supabase isn't configured. Use inside actions. */
export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    );
  }
  return supabase;
}
