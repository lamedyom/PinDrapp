import { useCallback, useEffect, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Camera, UploadCloud, Play, X } from 'lucide-react';
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

export function VideoSelector({ selected, onSelect }: VideoSelectorProps) {
  const [mode, setMode] = useState<'idle' | 'recording' | 'previewRecord'>('idle');
  const [streamErr, setStreamErr] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const tickRef = useRef<number | null>(null);

  const startRecord = async () => {
    setStreamErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      chunksRef.current = [];
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mime });
        const url = URL.createObjectURL(blob);
        onSelect({ source: 'record', blob, url, durationSec: elapsed });
        setMode('previewRecord');
        streamRef.current?.getTracks().forEach((t) => t.stop());
      };
      recorderRef.current = recorder;
      recorder.start();
      setElapsed(0);
      setMode('recording');
      tickRef.current = window.setInterval(() => {
        setElapsed((s) => {
          const next = s + 1;
          if (next >= MAX_DURATION) {
            stopRecord();
          }
          return next;
        });
      }, 1000);
    } catch (err) {
      setStreamErr(err instanceof Error ? err.message : 'Camera unavailable');
    }
  };

  const stopRecord = () => {
    if (tickRef.current) window.clearInterval(tickRef.current);
    tickRef.current = null;
    recorderRef.current?.stop();
  };

  useEffect(() => {
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const onDrop = useCallback(
    (files: File[]) => {
      const file = files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      onSelect({ source: 'upload', blob: file, url, fileName: file.name });
    },
    [onSelect],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'video/*': [] },
    maxSize: 500 * 1024 * 1024,
    multiple: false,
    onDrop,
  });

  if (selected) {
    return (
      <div className={styles.previewWrap}>
        <video
          src={selected.url}
          controls
          playsInline
          className={styles.preview}
        />
        <button
          type="button"
          className={styles.retake}
          onClick={() => {
            URL.revokeObjectURL(selected.url);
            onSelect(null);
            setMode('idle');
          }}
        >
          <X size={14} /> Retake
        </button>
      </div>
    );
  }

  if (mode === 'recording') {
    return (
      <div className={styles.recordWrap}>
        <video ref={videoRef} playsInline muted className={styles.preview} />
        <div className={styles.timer}>
          <span className={styles.recDot} />
          {format(elapsed)}
          {elapsed >= WARNING_THRESHOLD && elapsed < MAX_DURATION && (
            <span className={styles.warning}>
              {MAX_DURATION - elapsed} seconds left
            </span>
          )}
        </div>
        <button
          type="button"
          className={`${styles.recordBtn} ${styles.recordBtnActive}`}
          aria-label="Stop recording"
          onClick={stopRecord}
        />
      </div>
    );
  }

  return (
    <div className={styles.idle}>
      {streamErr && <div className={styles.error}>Camera: {streamErr}</div>}
      <button type="button" className={`${styles.option} ${styles.optionRecord}`} onClick={startRecord}>
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
        <Play size={14} className={styles.optionDecor} />
      </div>
    </div>
  );
}

function format(s: number): string {
  const m = Math.floor(s / 60)
    .toString()
    .padStart(2, '0');
  const r = (s % 60).toString().padStart(2, '0');
  return `${m}:${r}`;
}
