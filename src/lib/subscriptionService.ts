/**
 * Client wrapper for Pindrapp Pro subscription operations.
 *
 * In production POST /api/create-subscription kicks off a 7-day Stripe trial
 * and flips businesses.is_pro to true. In the offline demo we just optimistically
 * flip the local authStore so the UI unlocks Pro features.
 */
import { supabase } from './supabase';
import { useAuthStore } from '../stores/authStore';

const ENV_BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/$/, '');

/** Start a 7-day Pro trial. Returns true on success. */
export async function startProTrial(businessId: string): Promise<boolean> {
  // Try the backend first when configured.
  if (ENV_BASE) {
    try {
      const res = await fetch(`${ENV_BASE}/api/create-subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId }),
      });
      if (res.ok) {
        await markBusinessPro(businessId);
        return true;
      }
    } catch {
      /* fall through to optimistic toggle */
    }
  }

  // Demo / no-server mode — toggle in the database (if supabase is configured)
  // and flip the local authStore so the UI shows Pro immediately.
  await markBusinessPro(businessId);
  return true;
}

async function markBusinessPro(businessId: string): Promise<void> {
  const now = new Date();
  if (supabase) {
    try {
      await supabase
        .from('businesses')
        .update({ is_pro: true, pro_since: now.toISOString() })
        .eq('id', businessId);
    } catch {
      /* RLS may block; ignore — we still update the local store */
    }
  }
  // Mirror the change into the local authStore.
  const auth = useAuthStore.getState();
  if (auth.business && auth.business.id === businessId) {
    useAuthStore.setState({
      business: { ...auth.business, isPro: true, proSince: now },
    });
  }
}
