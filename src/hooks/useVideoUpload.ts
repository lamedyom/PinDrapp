import { useState } from 'react';

export interface UploadResult {
  url: string;
  publicId: string;
  duration: number;
}

interface UseVideoUpload {
  upload: (file: File | Blob) => Promise<UploadResult>;
  progress: number;
  uploading: boolean;
  error: string | null;
  reset: () => void;
}

export function useVideoUpload(): UseVideoUpload {
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = (): void => {
    setProgress(0);
    setUploading(false);
    setError(null);
  };

  const upload = (file: File | Blob): Promise<UploadResult> => {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined;
    const preset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string | undefined;

    // eslint-disable-next-line no-console
    console.log('[pindrapp] uploading video to Cloudinary…', {
      cloudName,
      preset,
      size: 'size' in file ? file.size : undefined,
      type: file.type,
    });

    setUploading(true);
    setProgress(0);
    setError(null);

    if (!cloudName || cloudName.startsWith('your_') || !preset) {
      // Hard fail: we used to fall back to a local blob URL here, but that
      // blob:… URL only lives in the browser tab that minted it, so when it
      // landed in Supabase.posts.video_url every other client saw a broken
      // video. Refuse to upload — the caller will surface the error and the
      // post never gets written. Fix the env vars to unblock.
      setUploading(false);
      const msg =
        'Cloudinary not configured (VITE_CLOUDINARY_CLOUD_NAME / VITE_CLOUDINARY_UPLOAD_PRESET). Video upload disabled.';
      // eslint-disable-next-line no-console
      console.error('[pindrapp]', msg);
      setError(msg);
      return Promise.reject(new Error(msg));
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', preset);
    formData.append('resource_type', 'video');
    // Pre-generate the cross-browser variants Cloudinary will serve at play
    // time. Async = the upload returns immediately; the variants warm in
    // the background. f_auto/q_auto/vc_auto matches the runtime URL
    // transform in src/lib/cloudinary.ts so the first request is a cache
    // hit instead of a cold transform.
    formData.append('eager', 'f_auto,q_auto,vc_auto');
    formData.append('eager_async', 'true');

    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        setProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    return new Promise<UploadResult>((resolve, reject) => {
      xhr.onload = () => {
        setUploading(false);
        try {
          const data = JSON.parse(xhr.responseText) as {
            secure_url?: string;
            public_id?: string;
            duration?: number;
            error?: { message?: string };
          };
          if (xhr.status === 200 && data.secure_url) {
            // eslint-disable-next-line no-console
            console.log('[pindrapp] Cloudinary upload OK:', data.secure_url);
            // eslint-disable-next-line no-console
            console.log('[pindrapp] upload result type:', typeof data.secure_url);
            // eslint-disable-next-line no-console
            console.log('[pindrapp] upload result url:', data.secure_url.substring(0, 50));
            resolve({
              url: data.secure_url,
              publicId: data.public_id ?? '',
              duration: data.duration ?? 0,
            });
          } else {
            const msg = data.error?.message ?? `Upload failed (HTTP ${xhr.status})`;
            // eslint-disable-next-line no-console
            console.error('[pindrapp] Cloudinary error:', { status: xhr.status, body: data });
            setError(msg);
            reject(new Error(msg));
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Upload parse error';
          // eslint-disable-next-line no-console
          console.error('[pindrapp] Cloudinary parse error:', e, xhr.responseText);
          setError(msg);
          reject(new Error(msg));
        }
      };
      xhr.onerror = () => {
        setUploading(false);
        const msg = 'Network error';
        // eslint-disable-next-line no-console
        console.error('[pindrapp] Cloudinary network error');
        setError(msg);
        reject(new Error(msg));
      };
      xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`);
      xhr.send(formData);
    });
  };

  return { upload, progress, uploading, error, reset };
}
