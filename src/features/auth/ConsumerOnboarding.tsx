import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Camera, MapPin } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { uploadAvatar } from '../../lib/supabaseApi';
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
  { id: 'wine', label: 'Wine', emoji: '🍷' },
  { id: 'events', label: 'Events', emoji: '🎉' },
  { id: 'services', label: 'Services', emoji: '🔧' },
  { id: 'health', label: 'Health', emoji: '🏥' },
  { id: 'music', label: 'Music', emoji: '🎵' },
  { id: 'japanese', label: 'Japanese', emoji: '🍣' },
];

export function ConsumerOnboarding() {
  const navigate = useNavigate();
  const profile = useAuthStore((s) => s.profile);
  const markOnboarded = useAuthStore((s) => s.markConsumerOnboarded);
  const updateConsumer = useAuthStore((s) => s.updateConsumerProfile);

  const [step, setStep] = useState(1);
  const [firstName, setFirstName] = useState(profile?.name?.split(' ')[0] ?? '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatarUrl ?? null);
  const [interests, setInterests] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [savingStep, setSavingStep] = useState(false);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'granted' | 'denied'>('idle');

  const { getRootProps, getInputProps } = useDropzone({
    accept: { 'image/*': [] },
    multiple: false,
    onDrop: async (files) => {
      const f = files[0];
      if (!f) return;
      setAvatarUrl(URL.createObjectURL(f));
      try {
        const remote = await uploadAvatar(f);
        if (remote) setAvatarUrl(remote);
      } catch {
        // keep the local preview if upload fails
      }
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

  const totalSteps = 4;
  const progress = (step / totalSteps) * 100;

  // Per-step persistence so a half-finished signup keeps what was typed.
  const persistCurrentStep = async (): Promise<void> => {
    setSavingStep(true);
    try {
      if (step === 1 && firstName.trim().length >= 2) {
        await updateConsumer({ name: firstName.trim() });
      } else if (step === 2 && avatarUrl) {
        await updateConsumer({ avatarUrl });
      }
    } finally {
      setSavingStep(false);
    }
  };

  const next = async () => {
    tapHaptic();
    await persistCurrentStep();
    setStep((s) => Math.min(totalSteps, s + 1));
  };
  const back = () => setStep((s) => Math.max(1, s - 1));

  const finish = async () => {
    setSubmitting(true);
    await markOnboarded();
    setSubmitting(false);
    navigate('/feed');
  };

  const continueDisabled =
    (step === 1 && firstName.trim().length < 2) || savingStep || submitting;

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
              <h1 className={styles.title}>What should we call you?</h1>
              <p className={styles.sub}>This is how you'll appear on Pindrapp.</p>

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
              <h1 className={styles.title}>Add a photo</h1>
              <p className={styles.sub}>
                Optional — helps others recognize you in the community.
              </p>

              <div className={styles.avatarBlock}>
                <div {...getRootProps({ className: styles.avatarDrop })}>
                  <input {...getInputProps()} />
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className={styles.avatarImg} loading="lazy" />
                  ) : (
                    <div className={styles.avatarPlaceholder}>
                      <Camera size={22} />
                      <span>Tap to upload</span>
                    </div>
                  )}
                </div>
                {avatarUrl && (
                  <button
                    type="button"
                    className={styles.linkBtn}
                    onClick={() => setAvatarUrl(null)}
                  >
                    Remove photo
                  </button>
                )}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h1 className={styles.title}>Find businesses near you</h1>
              <p className={styles.sub}>
                Allow location to discover what's happening in your neighborhood right now.
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
                    : 'Allow Location Access'}
              </button>
              <button type="button" className={styles.linkBtn} onClick={() => void next()}>
                Maybe later
              </button>
            </>
          )}

          {step === 4 && (
            <>
              <h1 className={styles.title}>What are you into?</h1>
              <p className={styles.sub}>We'll show you relevant businesses first.</p>

              <div className={styles.interestGrid}>
                {INTERESTS.map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    className={`${styles.interestBtn} ${interests.has(i.id) ? styles.interestBtnActive : ''}`}
                    onClick={() => {
                      tapHaptic();
                      setInterests((set) => {
                        const updated = new Set(set);
                        if (updated.has(i.id)) updated.delete(i.id);
                        else updated.add(i.id);
                        return updated;
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
            disabled={continueDisabled}
            onClick={() => void next()}
          >
            {savingStep ? 'Saving…' : 'Continue'} <ArrowRight size={16} />
          </button>
        ) : (
          <button
            type="button"
            className={styles.primaryBtn}
            disabled={submitting}
            onClick={() => void finish()}
          >
            {submitting ? 'Setting up…' : "Let's go!"} <ArrowRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
