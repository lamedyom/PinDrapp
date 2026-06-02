/**
 * Cloudinary URL transformers.
 *
 * `f_auto,q_auto,vc_auto` is the critical combo for cross-browser video
 * playback: Cloudinary picks the right container (MP4 for iOS Safari,
 * WebM for Chrome/Android), quality, and video codec on the fly so the
 * stream Just Works™ without us hand-tuning per browser.
 *
 * Non-Cloudinary URLs pass through unchanged so callers can pipe any URL
 * through these helpers without branching.
 */

export function getStreamableUrl(url: string): string {
  if (!url) return url;
  if (!url.includes('cloudinary.com')) return url;
  // Idempotent: if the transformation block is already present, skip it
  // so we don't end up with /upload/q_auto,...,f_auto/q_auto,...,f_auto/...
  if (url.includes('/upload/q_auto') || url.includes('/upload/f_auto')) return url;
  return url.replace('/upload/', '/upload/q_auto,vc_auto,f_auto/');
}

export function getVideoThumbnail(url: string): string {
  if (!url) return '';
  if (!url.includes('cloudinary.com')) return '';
  // First-frame jpg poster, 9:16 aspect at a sane mobile width.
  return url
    .replace('/upload/', '/upload/so_0,w_400,h_700,c_fill,f_jpg/')
    .replace(/\.[^.]+$/, '.jpg');
}
