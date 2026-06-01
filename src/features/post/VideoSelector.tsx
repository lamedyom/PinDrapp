import { useCallback, useEffect, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Camera, Check, RotateCcw, Trash2, UploadCloud, X } from 'lucide-react';
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

  // Attach the live stream to the <video> with every mobile-safe attribute set
  // imperatively. The 'playsinline' attribute (not just the JSX prop) is the
  // critical one — without it iOS Safari shows a black preview even while
  // recording works.
  const attachStream = useCallback((stream: MediaStream) => {
    window.setTimeout(() => {
      const el = videoRef.current;
      if (!el) return;
      el.srcObject = stream;
      el.setAttribute('playsinline', 'true');
      el.setAttribute('webkit-playsinline', 'true');
      el.setAttribute('muted', 'true');
      el.muted = true;
      el.autoplay = true;
      const p = el.play();
      if (p && typeof p.catch === 'function') {
        p.catch((err) => {
          // eslint-disable-next-line no-console
          console.warn('[pindrapp] camera autoplay blocked:', err);
        });
      }
    }, 0);
  }, []);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const clearTimer = useCallback(() => {
    if (tickRef.current) window.clearInterval(tickRef.current);
    tickRef.current = null;
  }, []);

  // ── Open the camera into a live (not-yet-recording) preview.
  const armCamera = async () => {
    setStreamErr(null);
    setPermissionDenied(false);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setStreamErr('Camera not supported on this device.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: true,
      });
      streamRef.current = stream;
      setMode('armed');
      attachStream(stream);
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setPermissionDenied(true);
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        // Retry without the rear-camera constraint (desktops have no env cam).
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          streamRef.current = stream;
          setMode('armed');
          attachStream(stream);
        } catch {
          setStreamErr('No camera found.');
        }
      } else {
        setStreamErr(err instanceof Error ? err.message : 'Camera unavailable');
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
  if (selected) {
    const isUpload = selected.source === 'upload';
    return (
      <div className={styles.previewWrap}>
        <video src={selected.url} controls playsInline className={styles.preview} />
        <div className={styles.previewMeta}>
          <div className={styles.previewInfo}>
            <span className={styles.previewName}>
              {selected.fileName ?? (isUpload ? 'Selected video' : 'Your recording')}
            </span>
            {selected.durationSec ? (
              <span className={styles.previewDuration}>{fmtClock(selected.durationSec)}</span>
            ) : null}
          </div>
          <button
            type="button"
            className={styles.removeBtn}
            onClick={() => {
              URL.revokeObjectURL(selected.url);
              onSelect(null);
              setMode('idle');
            }}
          >
            {isUpload ? <Trash2 size={14} /> : <RotateCcw size={14} />}
            {isUpload ? 'Remove' : 'Retake'}
          </button>
        </div>
      </div>
    );
  }

  // ── Reviewing a fresh recording
  if (mode === 'reviewing' && review) {
    return (
      <div className={styles.reviewWrap}>
        <video src={review.url} controls playsInline className={styles.preview} />
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
