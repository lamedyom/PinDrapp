import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Camera, MapPin } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { tapHaptic } from '../../lib/haptics';
import styles from './ConsumerOnboarding.module.css';

const INTERESTS = [
  { id: 'food', label: 'Food', emoji: '🍕' },
  { id: 'coffee', label: 'Coffee', emoji: '☕' },
  { id: 'bakery', label: 'Bakery', emoji: '🥐' },
  { id: 'fashion', label: 'Fashion', emoji: '👗' },
  { id: 'jewelry', label: 'Jewelry', emoji: '💎' },
  { id: 'beauty', label: 'Beauty', emoji: '💅' },
  { id: 'fitness', label: 'Fitness', emoji: '🏋️' },
  { id: 'books', label: 'Books', emoji: '📚' },
  { id: 'electronics', label: 'Electronics', emoji: '📱' },
  { id: 'music', label: 'Music', emoji: '🎵' },
  { id: 'wine', label: 'Wine', emoji: '🍷' },
  { id: 'events', label: 'Events', emoji: '🎉' },
];

export function ConsumerOnboarding() {
  const navigate = useNavigate();
  const profile = useAuthStore((s) => s.profile);
  const markOnboarded = useAuthStore((s) => s.markConsumerOnboarded);

  const [step, setStep] = useState(1);
  const [firstName, setFirstName] = useState(profile?.name?.split(' ')[0] ?? '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [interests, setInterests] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'granted' | 'denied'>('idle');

  const { getRootProps, getInputProps } = useDropzone({
    accept: { 'image/*': [] },
    multiple: false,
    onDrop: (files) => {
      const f = files[0];
      if (f) setAvatarUrl(URL.createObjectURL(f));
    },
  });

  const requestLocation = () => {
    tapHaptic();
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationStatus('denied');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => setLocationStatus('granted'),
      () => setLocationStatus('denied'),
      { timeout: 6000 },
    );
  };

  const totalSteps = 3;
  const progress = (step / totalSteps) * 100;

  const next = () => {
    tapHaptic();
    setStep((s) => Math.min(totalSteps, s + 1));
  };
  const back = () => setStep((s) => Math.max(1, s - 1));

  const finish = async () => {
    setSubmitting(true);
    await markOnboarded();
    setSubmitting(false);
    navigate('/feed');
  };

  return (
    <div className={styles.screen}>
      <header className={styles.head}>
        <button
          type="button"
          className={styles.backBtn}
          onClick={step === 1 ? () => navigate(-1) : back}
          aria-label="Back"
        >
          <ArrowLeft size={18} />
        </button>
        <div className={styles.progressTrack} aria-hidden>
          <motion.div
            className={styles.progressFill}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </header>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.22 }}
          className={styles.body}
        >
          {step === 1 && (
            <>
              <h1 className={styles.title}>What's your name?</h1>
              <p className={styles.sub}>This is how you'll appear on Pindrapp.</p>

              <div className={styles.avatarBlock}>
                <div {...getRootProps({ className: styles.avatarDrop })}>
                  <input {...getInputProps()} />
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className={styles.avatarImg} />
                  ) : (
                    <div className={styles.avatarPlaceholder}>
                      <Camera size={22} />
                      <span>Add a profile photo</span>
                    </div>
                  )}
                </div>
                <p className={styles.photoHint}>
                  Help others recognize you in the community
                </p>
                <button
                  type="button"
                  className={styles.linkBtn}
                  onClick={() => setAvatarUrl(null)}
                >
                  Skip photo
                </button>
              </div>

              <label className={styles.fieldLabel}>
                First name
                <input
                  type="text"
                  placeholder="Alex"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={styles.input}
                  autoFocus
                  maxLength={40}
                />
              </label>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className={styles.title}>Location helps a lot</h1>
              <p className={styles.sub}>
                We use it to surface businesses near you. We never sell your location.
              </p>

              <div className={styles.locGraphic}>
                <div className={styles.locDot} />
                <div className={styles.locRing} />
                <div className={`${styles.locRing} ${styles.locRingDelay}`} />
                <MapPin size={28} className={styles.locPin} />
              </div>

              <button
                type="button"
                className={styles.primaryBtn}
                onClick={requestLocation}
                disabled={locationStatus === 'granted'}
              >
                <MapPin size={16} />
                {locationStatus === 'granted'
                  ? 'Location enabled ✓'
                  : locationStatus === 'denied'
                    ? 'Tap to try again'
                    : 'Allow Location'}
              </button>
              <button type="button" className={styles.linkBtn} onClick={next}>
                Maybe later
              </button>
            </>
          )}

          {step === 3 && (
            <>
              <h1 className={styles.title}>What are you into?</h1>
              <p className={styles.sub}>We'll show you these first. Pick a few.</p>

              <div className={styles.interestGrid}>
                {INTERESTS.map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    className={`${styles.interestBtn} ${interests.has(i.id) ? styles.interestBtnActive : ''}`}
                    onClick={() => {
                      tapHaptic();
                      setInterests((set) => {
                        const next = new Set(set);
                        if (next.has(i.id)) next.delete(i.id);
                        else next.add(i.id);
                        return next;
                      });
                    }}
                  >
                    <span className={styles.interestEmoji}>{i.emoji}</span>
                    <span>{i.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      <div className={styles.footer}>
        {step < totalSteps ? (
          <button
            type="button"
            className={styles.primaryBtn}
            disabled={step === 1 ? firstName.trim().length < 2 : false}
            onClick={next}
          >
            Continue <ArrowRight size={16} />
          </button>
        ) : (
          <button
            type="button"
            className={styles.primaryBtn}
            disabled={submitting}
            onClick={finish}
          >
            {submitting ? 'Setting up…' : "Let's go"} <ArrowRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
