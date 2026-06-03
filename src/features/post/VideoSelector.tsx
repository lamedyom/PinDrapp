import { useCallback, useEffect, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Camera, Check, RefreshCw, RotateCcw, UploadCloud, X } from 'lucide-react';
import styles from './VideoSelector.module.css';

export interface SelectedVideo {
  source: 'record' | 'upload';
  blob: Blob | File;
  url: string;
  durationSec?: number;
  fileName?: string;
}

interface VideoSelectorProps {
  selected: SelectedVideo | null;
  onSelect: (video: SelectedVideo | null) => void;
}

const MAX_DURATION = 90;
const WARNING_THRESHOLD = 80;

type Mode = 'idle' | 'armed' | 'recording' | 'reviewing';

/** Read a video file/blob's duration (seconds) via a throwaway element. */
function readDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => resolve(Number.isFinite(v.duration) ? v.duration : 0);
    v.onerror = () => resolve(0);
    v.src = url;
  });
}

function fmtClock(s: number): string {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const r = Math.round(s % 60).toString().padStart(2, '0');
  return `${m}:${r}`;
}

export function VideoSelector({ selected, onSelect }: VideoSelectorProps) {
  const [mode, setMode] = useState<Mode>('idle');
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [streamErr, setStreamErr] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [review, setReview] = useState<SelectedVideo | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const tickRef = useRef<number | null>(null);

  // Front-vs-rear camera. `armCamera` reads this to request the right facing
  // mode. The flip button below stops the current stream and re-arms.
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const facingRef = useRef(facing);
  facingRef.current = facing;

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const clearTimer = useCallback(() => {
    if (tickRef.current) window.clearInterval(tickRef.current);
    tickRef.current = null;
  }, []);

  // Wait until the <video> element is actually mounted in the DOM. Mobile
  // browsers will silently render a black frame if srcObject is assigned
  // before the element exists. Used by armCamera below.
  const waitForVideoEl = (): Promise<HTMLVideoElement> =>
    new Promise((resolve, reject) => {
      const start = performance.now();
      const tick = () => {
        if (videoRef.current) return resolve(videoRef.current);
        if (performance.now() - start > 3000) return reject(new Error('video-el-timeout'));
        requestAnimationFrame(tick);
      };
      tick();
    });

  // ── Open the camera into a live (not-yet-recording) preview.
  const armCamera = async () => {
    setStreamErr(null);
    setPermissionDenied(false);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setStreamErr('Camera not supported on this device.');
      return;
    }
    // Stop any prior stream so we don't end up with two simultaneous open
    // cameras on flip / retry.
    stopTracks();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingRef.current },
          width: { ideal: 1080 },
          height: { ideal: 1920 },
        },
        audio: true,
      });
      streamRef.current = stream;
      // Render the <video> element first by flipping mode → 'armed', then
      // wait for the ref to populate before attaching the stream.
      setMode('armed');
      const el = await waitForVideoEl();
      // Set DOM attributes directly — not just the React props — because
      // iOS Safari uses presence of the attribute, not the React value,
      // when deciding whether to inline the video.
      el.setAttribute('playsinline', '');
      el.setAttribute('webkit-playsinline', '');
      el.setAttribute('muted', '');
      el.setAttribute('autoplay', '');
      el.muted = true;
      el.playsInline = true;
      el.srcObject = stream;
      // Wait for the metadata so play() has dimensions to work with. Falls
      // back after 3s in case the event never arrives (some Android builds).
      await new Promise<void>((resolve) => {
        let settled = false;
        const done = () => {
          if (settled) return;
          settled = true;
          resolve();
        };
        el.onloadedmetadata = done;
        el.onerror = done;
        window.setTimeout(done, 3000);
      });
      try {
        await el.play();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[pindrapp] camera autoplay blocked, retrying:', err);
        await new Promise((resolve) => window.setTimeout(resolve, 500));
        try {
          await el.play();
        } catch {
          // best-effort — surface as a soft error if it still won't play
          setStreamErr('Tap inside the preview to start the camera.');
        }
      }
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setPermissionDenied(true);
        setMode('idle');
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        // Retry without the rear-camera constraint (desktops have no env cam).
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          streamRef.current = stream;
          const el = await waitForVideoEl();
          el.setAttribute('playsinline', '');
          el.setAttribute('webkit-playsinline', '');
          el.setAttribute('muted', '');
          el.setAttribute('autoplay', '');
          el.muted = true;
          el.playsInline = true;
          el.srcObject = stream;
          await el.play().catch(() => undefined);
          setMode('armed');
        } catch {
          setStreamErr('No camera found.');
          setMode('idle');
        }
      } else {
        setStreamErr(err instanceof Error ? err.message : 'Camera unavailable');
        setMode('idle');
      }
    }
  };

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream) return;
    chunksRef.current = [];
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : 'video/mp4';
    const recorder = new MediaRecorder(stream, { mimeType: mime });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mime });
      const url = URL.createObjectURL(blob);
      // Hold in review state — user confirms with "Use This".
      setReview({ source: 'record', blob, url, durationSec: elapsedRef.current });
      setMode('reviewing');
      stopTracks();
    };
    recorderRef.current = recorder;
    recorder.start();
    setElapsed(0);
    elapsedRef.current = 0;
    setMode('recording');
    tickRef.current = window.setInterval(() => {
      setElapsed((s) => {
        const next = s + 1;
        elapsedRef.current = next;
        return next;
      });
    }, 1000);
  };

  // Keep a ref of elapsed so onstop captures the final value.
  const elapsedRef = useRef(0);

  const stopRecording = useCallback(() => {
    clearTimer();
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
  }, [clearTimer]);

  // Auto-stop at MAX_DURATION (in an effect, not inside the setState updater).
  useEffect(() => {
    if (mode === 'recording' && elapsed >= MAX_DURATION) {
      stopRecording();
    }
  }, [mode, elapsed, stopRecording]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      clearTimer();
      stopTracks();
    };
  }, [clearTimer, stopTracks]);

  const cancelCamera = () => {
    clearTimer();
    stopTracks();
    setMode('idle');
    setElapsed(0);
  };

  const flipCamera = () => {
    // Only swap while armed (not actively recording) — avoid mid-recording
    // codec resets.
    if (mode !== 'armed') return;
    const next = facingRef.current === 'environment' ? 'user' : 'environment';
    setFacing(next);
    facingRef.current = next;
    stopTracks();
    void armCamera();
  };

  const retake = () => {
    if (review) URL.revokeObjectURL(review.url);
    setReview(null);
    setElapsed(0);
    void armCamera();
  };

  const useThis = () => {
    if (review) onSelect(review);
    setReview(null);
    setMode('idle');
  };

  // ── Upload
  const onDrop = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      const durationSec = await readDuration(url);
      onSelect({ source: 'upload', blob: file, url, fileName: file.name, durationSec });
    },
    [onSelect],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'video/*': [] },
    maxSize: 500 * 1024 * 1024,
    multiple: false,
    onDrop,
    noClick: false,
  });

  // ── Committed preview (parent holds `selected`)
  // ── Committed preview (parent holds `selected`) — what the user sees
  // sitting above the caption form. 9:16 frame with autoplay loop so it
  // looks exactly like the feed card it's about to become.
  if (selected) {
    // eslint-disable-next-line no-console
    console.log('[pindrapp] committed preview url:', selected.url);
    // eslint-disable-next-line no-console
    console.log(
      '[pindrapp] committed preview blob:',
      selected.fileName ?? selected.source,
      'size:',
      'size' in selected.blob ? selected.blob.size : 'n/a',
    );
    return (
      <div className={styles.previewWrap}>
        <video
          // key={selected.url} forces a remount when the URL changes. Mobile
          // browsers (iOS Safari especially) sometimes ignore a runtime
          // src swap on a <video> element and keep showing the previous
          // frame; remounting bypasses that entirely.
          key={selected.url}
          src={selected.url}
          autoPlay
          muted
          loop
          playsInline
          className={styles.preview}
        />
        <button
          type="button"
          className={styles.previewChangeBtn}
          onClick={() => {
            URL.revokeObjectURL(selected.url);
            onSelect(null);
            setMode('idle');
          }}
        >
          Change
        </button>
      </div>
    );
  }

  // ── Reviewing a fresh recording — fullscreen overlay, auto-loops the
  // local blob so the user gets the "feed card" feel before committing.
  // The blob URL never leaves the device; Cloudinary only happens once
  // they tap Post in the parent screen.
  if (mode === 'reviewing' && review) {
    return (
      <div className={styles.reviewWrap}>
        <video
          src={review.url}
          autoPlay
          muted
          loop
          playsInline
          className={styles.preview}
        />
        <div className={styles.reviewTopBar}>
          <button
            type="button"
            className={styles.reviewClose}
            aria-label="Discard recording"
            onClick={retake}
          >
            <X size={16} />
          </button>
        </div>
        <div className={styles.reviewActions}>
          <button type="button" className={styles.retakeBtn} onClick={retake}>
            <RotateCcw size={16} /> Retake
          </button>
          <button type="button" className={styles.useBtn} onClick={useThis}>
            <Check size={16} /> Use This
          </button>
        </div>
      </div>
    );
  }

  // ── Armed (camera live, before recording) or recording
  if (mode === 'armed' || mode === 'recording') {
    const recording = mode === 'recording';
    return (
      <div className={styles.recordWrap}>
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={styles.preview}
          // Mirror the live preview so it feels like a selfie cam. The recorded
          // file itself is unaffected — MediaRecorder writes the raw stream.
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: 'scaleX(-1)',
          }}
        />

        {recording && (
          <div className={styles.timer}>
            <span className={styles.recDot} />
            {fmtClock(elapsed)}
            {elapsed >= WARNING_THRESHOLD && elapsed < MAX_DURATION && (
              <span className={styles.warning}>{MAX_DURATION - elapsed}s left</span>
            )}
          </div>
        )}

        <button
          type="button"
          className={styles.cancelCamera}
          aria-label="Close camera"
          onClick={cancelCamera}
        >
          <X size={18} />
        </button>

        {!recording && (
          <button
            type="button"
            className={styles.flipCamera}
            aria-label="Flip camera"
            onClick={flipCamera}
          >
            <RefreshCw size={16} />
          </button>
        )}

        <button
          type="button"
          className={`${styles.recordBtn} ${recording ? styles.recordBtnActive : ''}`}
          aria-label={recording ? 'Stop recording' : 'Start recording'}
          onClick={recording ? stopRecording : startRecording}
        />

        {!recording && <div className={styles.armedHint}>Tap the button to start recording</div>}
      </div>
    );
  }

  // ── Idle: two big options
  return (
    <div className={styles.idle}>
      {permissionDenied && (
        <div className={styles.error}>
          Please allow camera access in your browser settings, then tap Record Now again.
        </div>
      )}
      {streamErr && <div className={styles.error}>{streamErr}</div>}

      <button
        type="button"
        className={`${styles.option} ${styles.optionRecord}`}
        onClick={armCamera}
      >
        <div className={styles.optionIcon}>
          <Camera size={26} />
        </div>
        <div className={styles.optionTitle}>📹 Record Now</div>
        <div className={styles.optionSub}>Record 15–90 sec</div>
      </button>

      <div {...getRootProps({ className: `${styles.option} ${styles.optionUpload}` })}>
        <input {...getInputProps()} />
        <div className={styles.optionIcon}>
          <UploadCloud size={26} />
        </div>
        <div className={styles.optionTitle}>📁 Upload Video</div>
        <div className={styles.optionSub}>
          {isDragActive ? 'Drop the file here' : 'From your gallery'}
        </div>
      </div>
    </div>
  );
}
