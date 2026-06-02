import { supabase } from './supabase';

/**
 * Silently pin a business to a user's personal map.
 *
 * Called as a side-effect whenever an engaged action happens — like, hype,
 * follow, claim. The idea: any business a user interacts with should appear
 * on their personal map, building it up organically without an extra tap.
 *
 * Idempotent (upsert on user_id+business_id). Failures are swallowed because
 * auto-pin is a courtesy, never a critical path — the originating action
 * (like/hype/follow/claim) is what the user cared about.
 */
export async function autoPin(
  businessId: string | null | undefined,
  userId: string | null | undefined,
): Promise<void> {
  if (!supabase || !businessId || !userId) return;
  try {
    await supabase
      .from('saved_places')
      .upsert(
        { user_id: userId, business_id: businessId },
        { onConflict: 'user_id,business_id', ignoreDuplicates: true },
      );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.log('[pindrapp] auto-pin failed silently:', err);
  }
}
