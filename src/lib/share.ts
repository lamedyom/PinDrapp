/**
 * Native share with clipboard fallback. Returns silently if the user aborts
 * the share sheet; surfaces a "Link copied!" toast when it falls back to
 * clipboard.
 */
import { showToast } from '../stores/toastStore';

export interface ShareInput {
  title: string;
  text: string;
  url: string;
}

export async function shareContent({ title, text, url }: ShareInput): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return;
    } catch (err) {
      // User dismissed the sheet — don't fall back, that's not an error.
      if ((err as Error)?.name === 'AbortError') return;
      // Anything else (e.g. NotAllowedError on insecure context): fall back.
    }
  }
  await fallbackCopy(url);
}

async function fallbackCopy(url: string): Promise<void> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      showToast('Link copied to clipboard!');
      return;
    }
  } catch {
    /* fall through */
  }
  showToast(url);
}
