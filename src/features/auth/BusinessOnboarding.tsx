import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import { ArrowLeft, ArrowRight, Camera, MapPin, Sparkles, Video } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { geocodePlaces, type GeocodingResult } from '../../lib/geocoding';
import { tapHaptic } from '../../lib/haptics';
import styles from './BusinessOnboarding.module.css';

const CATEGORIES = [
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
  { id: 'market', label: 'Market', emoji: '🛒' },
  { id: 'health', label: 'Health', emoji: '🏥' },
  { id: 'events', label: 'Events', emoji: '🎉' },
  { id: 'other', label: 'Other', emoji: '🏪' },
];

export function BusinessOnboarding() {
  const navigate = useNavigate();
  const profile = useAuthStore((s) => s.profile);
  const saveBusiness = useAuthStore((s) => s.saveBusinessProfile);

  const [step, setStep] = useState(1);
  const [name, setName] = useState(profile?.name ?? '');
  const [category, setCategory] = useState<string>('food');
  const [addressQuery, setAddressQuery] = useState('');
  const [addressResults, setAddressResults] = useState<GeocodingResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<GeocodingResult | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [bio, setBio] = useState('');
  const [website, setWebsite] = useState('');
  const [instagram, setInstagram] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Debounced address search
  useEffect(() => {
    if (!addressQuery.trim() || picked) {
      setAddressResults([]);
      return;
    }
    const handle = window.setTimeout(() => {
      setSearching(true);
      geocodePlaces(addressQuery)
        .then((r) => {
          setAddressResults(r);
          setSearching(false);
        })
        .catch(() => setSearching(false));
    }, 220);
    return () => window.clearTimeout(handle);
  }, [addressQuery, picked]);

  const { getRootProps, getInputProps } = useDropzone({
    accept: { 'image/*': [] },
    multiple: false,
    onDrop: (files) => {
      const f = files[0];
      if (f) setAvatarUrl(URL.createObjectURL(f));
    },
  });

  const totalSteps = 5;
  const progress = (step / totalSteps) * 100;

  const next = () => {
    tapHaptic();
    setStep((s) => Math.min(totalSteps, s + 1));
  };
  const back = () => setStep((s) => Math.max(1, s - 1));

  const canAdvanceFrom = (s: number): boolean => {
    if (s === 1) return name.trim().length >= 2;
    if (s === 2) return !!picked;
    if (s === 3) return bio.trim().length >= 5;
    if (s === 4) return true;
    return true;
  };

  const finish = async () => {
    if (!picked) return;
    setSubmitting(true);
    await saveBusiness({
      name: name.trim(),
      category,
      bio: bio.trim(),
      address: picked.placeName,
      lat: picked.lat,
      lng: picked.lng,
      website: website.trim() || null,
      instagram: instagram.trim() || null,
      phone: null,
      avatarUrl,
    });
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
        <div className={styles.stepIndicator}>
          {step} / {totalSteps}
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
              <h1 className={styles.title}>Tell us about your business</h1>
              <p className={styles.sub}>The basics — we'll polish the rest as we go.</p>

              <label className={styles.fieldLabel}>
                Business name
                <input
                  type="text"
                  placeholder="e.g. GG's Waterfront"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={styles.input}
                  maxLength={60}
                />
              </label>

              <div className={styles.fieldLabel}>
                Category
                <div className={styles.catGrid}>
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={`${styles.catBtn} ${category === c.id ? styles.catBtnActive : ''}`}
                      onClick={() => {
                        tapHaptic();
                        setCategory(c.id);
                      }}
                    >
                      <span className={styles.catEmoji}>{c.emoji}</span>
                      <span>{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className={styles.title}>Where are you?</h1>
              <p className={styles.sub}>Search your business address — we'll drop a pin.</p>

              {picked ? (
                <div className={styles.pickedCard}>
                  <span className={styles.pickedEmoji}>
                    <MapPin size={20} />
                  </span>
                  <div className={styles.pickedCopy}>
                    <div className={styles.pickedName}>{picked.name}</div>
                    <div className={styles.pickedAddr}>{picked.placeName}</div>
                  </div>
                  <button
                    type="button"
                    className={styles.changeBtn}
                    onClick={() => {
                      setPicked(null);
                      setAddressQuery('');
                    }}
                  >
                    Change
                  </button>
                </div>
              ) : (
                <>
                  <label className={styles.fieldLabel}>
                    Address
                    <input
                      type="text"
                      placeholder="123 Hollywood Blvd"
                      value={addressQuery}
                      onChange={(e) => setAddressQuery(e.target.value)}
                      className={styles.input}
                      autoFocus
                    />
                  </label>
                  {searching && <div className={styles.statusRow}>Searching…</div>}
                  <div className={styles.searchResults}>
                    {addressResults.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        className={styles.searchResult}
                        onClick={() => {
                          tapHaptic();
                          setPicked(r);
                        }}
                      >
                        <MapPin size={14} className={styles.searchResultIcon} />
                        <div className={styles.searchResultCopy}>
                          <div className={styles.searchResultName}>{r.name}</div>
                          <div className={styles.searchResultSub}>{r.placeName}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <h1 className={styles.title}>Profile</h1>
              <p className={styles.sub}>People will see this when they tap your pin.</p>

              <div className={styles.avatarBlock}>
                <div {...getRootProps({ className: styles.avatarDrop })}>
                  <input {...getInputProps()} />
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className={styles.avatarImg} />
                  ) : (
                    <div className={styles.avatarPlaceholder}>
                      <Camera size={22} />
                      <span>Add photo</span>
                    </div>
                  )}
                </div>
              </div>

              <label className={styles.fieldLabel}>
                Short bio
                <textarea
                  placeholder="What makes your business great?"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className={`${styles.input} ${styles.textarea}`}
                  maxLength={150}
                />
                <span className={styles.charCount}>{bio.length}/150</span>
              </label>

              <label className={styles.fieldLabel}>
                Website (optional)
                <input
                  type="url"
                  placeholder="yoursite.com"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className={styles.input}
                />
              </label>

              <label className={styles.fieldLabel}>
                Instagram (optional)
                <input
                  type="text"
                  placeholder="@handle"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  className={styles.input}
                />
              </label>
            </>
          )}

          {step === 4 && (
            <>
              <h1 className={styles.title}>Post your first update</h1>
              <p className={styles.sub}>
                A short clip introducing your business helps you stand out.
              </p>

              <div className={styles.recordCard}>
                <div className={styles.recordIcon}>
                  <Video size={28} />
                </div>
                <div className={styles.recordCopy}>
                  <div className={styles.recordTitle}>Record 15–90 sec</div>
                  <div className={styles.recordSub}>You can post from the + tab anytime.</div>
                </div>
              </div>

              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => {
                  // Finish onboarding first; user can record from /post.
                  next();
                }}
              >
                <Video size={16} /> I'll record later
              </button>
            </>
          )}

          {step === 5 && (
            <CelebrationStep
              businessName={name}
              emoji={CATEGORIES.find((c) => c.id === category)?.emoji ?? '🏪'}
              onFinish={finish}
              submitting={submitting}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {step < 5 && (
        <div className={styles.footer}>
          <button
            type="button"
            className={styles.primaryBtn}
            disabled={!canAdvanceFrom(step)}
            onClick={next}
          >
            Continue <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

function CelebrationStep({
  businessName,
  emoji,
  onFinish,
  submitting,
}: {
  businessName: string;
  emoji: string;
  onFinish: () => void;
  submitting: boolean;
}) {
  return (
    <div className={styles.celebrationWrap}>
      <div className={styles.confettiHost} aria-hidden>
        {Array.from({ length: 18 }).map((_, i) => (
          <span
            key={i}
            className={styles.confetti}
            style={{
              left: `${(i * 5.5 + 8) % 100}%`,
              animationDelay: `${(i % 6) * 0.1}s`,
              background: i % 3 === 0 ? '#FF5C1A' : i % 3 === 1 ? '#1A3AFF' : '#00D97E',
            }}
          />
        ))}
      </div>

      <motion.div
        className={styles.celebrationPin}
        initial={{ y: -120, scale: 0.6, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 14, stiffness: 220 }}
      >
        <div className={styles.celebrationEmoji}>{emoji}</div>
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
        className={styles.celebrationTitle}
      >
        <Sparkles size={20} /> You're live
      </motion.h2>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.55 }}
        className={styles.celebrationSub}
      >
        <strong>{businessName || 'Your business'}</strong> is now on the map.
      </motion.p>

      <motion.button
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        type="button"
        className={styles.primaryBtn}
        disabled={submitting}
        onClick={onFinish}
      >
        {submitting ? 'Saving…' : 'Explore the app'} <ArrowRight size={16} />
      </motion.button>
    </div>
  );
}
