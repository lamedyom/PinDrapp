import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { MapPin, X } from 'lucide-react';
import { DealTemplates, type TemplateKey } from './DealTemplates';
import { VideoSelector, type SelectedVideo } from './VideoSelector';
import { useVideoUpload } from '../../hooks/useVideoUpload';
import { useFeedStore } from '../../stores/feedStore';
import { useDealStore, type Deal } from '../../stores/dealStore';
import { useMapStore } from '../../stores/mapStore';
import { useAuthStore } from '../../stores/authStore';
import { AddLocationSheet, type AddedLocation } from '../places/AddLocationSheet';
import { createDeal, createPost, uploadVideo } from '../../lib/supabaseApi';
import styles from './PostScreen.module.css';

type PostTag =
  | 'flashDeal'
  | 'todaysSpecial'
  | 'newArrival'
  | 'announcement'
  | 'event'
  | 'behindTheScenes';

const TAG_OPTIONS: { id: PostTag; label: string }[] = [
  { id: 'flashDeal', label: '🔥 Flash Deal' },
  { id: 'todaysSpecial', label: "🍽️ Today's Special" },
  { id: 'newArrival', label: '📦 New Stock' },
  { id: 'announcement', label: '📣 Announcement' },
  { id: 'event', label: '🎉 Event' },
  { id: 'behindTheScenes', label: '📸 Behind the Scenes' },
];

const DURATIONS = [2, 4, 8, 24];

interface DealForm {
  headline: string;
  originalPrice: string;
  dealPrice: string;
  discountPercent: string;
  duration: number;
}

interface RouterTemplateState {
  templateId?: string;
  headline?: string;
  discountType?: 'fixed' | 'percent';
  discountValue?: number;
  defaultDuration?: number;
  emoji?: string;
}

export function PostScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const prependPost = useFeedStore((s) => s.prependPost);
  const addDeal = useDealStore((s) => s.addDeal);
  const { upload, progress, uploading } = useVideoUpload();

  const [video, setVideo] = useState<SelectedVideo | null>(null);
  const [caption, setCaption] = useState('');
  const [tag, setTag] = useState<PostTag | null>(null);
  const [deal, setDeal] = useState<DealForm>({
    headline: '',
    originalPrice: '',
    dealPrice: '',
    discountPercent: '',
    duration: 4,
  });
  const [location_, setLocation] = useState('Downtown Hollywood, FL');
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationSheetOpen, setLocationSheetOpen] = useState(false);
  const userLocation = useMapStore((s) => s.userLocation);

  const handleLocationPick = (place: AddedLocation) => {
    setLocation(place.placeName ?? place.name);
    setLocationCoords({ lat: place.lat, lng: place.lng });
  };
  const [posting, setPosting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const state = location.state as RouterTemplateState | null;
    if (!state) return;
    if (state.headline) setDeal((d) => ({ ...d, headline: state.headline ?? '' }));
    if (state.discountType === 'fixed' && state.discountValue) {
      setDeal((d) => ({ ...d, dealPrice: String(state.discountValue) }));
    }
    if (state.discountType === 'percent' && state.discountValue) {
      setDeal((d) => ({ ...d, discountPercent: String(state.discountValue) }));
    }
    if (state.defaultDuration) {
      setDeal((d) => ({ ...d, duration: state.defaultDuration ?? 4 }));
    }
    setTag('flashDeal');
  }, [location.state]);

  const handleTemplate = (tpl: TemplateKey) => {
    if (tpl === 'flashDeal') setTag('flashDeal');
    if (tpl === 'todaysSpecial') {
      setTag('todaysSpecial');
      setCaption((c) => c || "Tonight we're serving…");
    }
    if (tpl === 'newArrival') {
      setTag('newArrival');
      setCaption((c) => c || 'Just arrived…');
    }
  };

  const charCount = caption.length;
  const charOver = charCount > 140;

  const canPost = !!video && !uploading && !posting && caption.trim().length > 0;

  const authBusiness = useAuthStore((s) => s.business);

  const submit = async () => {
    if (!video) return;
    setPosting(true);
    try {
      // 1) Upload the video. Prefer Supabase storage if we have an authed
      //    business; fall back to Cloudinary via useVideoUpload otherwise.
      let videoUrl: string | undefined;
      try {
        if (authBusiness) {
          const url = await uploadVideo(video.blob);
          videoUrl = url ?? video.url;
        } else {
          const result = await upload(video.blob);
          videoUrl = result.url;
        }
      } catch {
        videoUrl = video.url;
      }

      const postCoords =
        locationCoords ??
        (userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : null) ??
        { lat: 26.0118, lng: -80.1495 };

      // 2) Persist to Supabase when authed, otherwise just update local stores.
      let realPostId: string | null = null;
      let realDealId: string | null = null;

      if (authBusiness) {
        try {
          realPostId = await createPost({
            businessId: authBusiness.id,
            caption,
            videoUrl,
          });
        } catch {
          // surface visually below — keep the optimistic UI
        }
        if (tag === 'flashDeal') {
          try {
            realDealId = await createDeal({
              businessId: authBusiness.id,
              headline: deal.headline || caption.slice(0, 60),
              description: caption,
              originalPrice: deal.originalPrice ? Number(deal.originalPrice) : null,
              dealPrice: deal.dealPrice ? Number(deal.dealPrice) : null,
              discountPercent: deal.discountPercent ? Number(deal.discountPercent) : null,
              expiresAt: new Date(Date.now() + deal.duration * 3600000),
            });
          } catch {
            // ignore
          }
        }
      }

      const postId = realPostId ?? `p_${Date.now()}`;
      const newDealId = realDealId ?? (tag === 'flashDeal' ? `d_${Date.now()}` : undefined);

      // 3) Always update local stores so the feed reflects the new post
      //    immediately even before the next bootstrap fetch.
      if (tag === 'flashDeal' && newDealId) {
        const newDeal: Deal = {
          id: newDealId,
          businessName: authBusiness?.name ?? 'Your Business',
          category: authBusiness?.category ?? 'Food',
          emoji: '⚡',
          headline: deal.headline || caption.slice(0, 60),
          description: caption,
          originalPrice: deal.originalPrice ? Number(deal.originalPrice) : null,
          dealPrice: deal.dealPrice ? Number(deal.dealPrice) : null,
          discountPercent: deal.discountPercent ? Number(deal.discountPercent) : null,
          expiresAt: new Date(Date.now() + deal.duration * 3600000),
          distanceMiles: 0,
          isFeatured: false,
          stripeProductId: `prod_${postId}`,
          lat: postCoords.lat,
          lng: postCoords.lng,
        };
        addDeal(newDeal);
      }

      prependPost({
        id: postId,
        businessId: authBusiness?.id ?? 'self',
        businessName: authBusiness?.name ?? 'Your Business',
        businessCategory: authBusiness?.category ?? 'Featured',
        businessEmoji: '⚡',
        caption,
        likeCount: 0,
        distanceMiles: 0,
        isLiked: false,
        isPinned: false,
        hasDeal: tag === 'flashDeal',
        dealId: newDealId,
        createdAt: new Date(),
        videoUrl,
        thumbnailGradient: 'linear-gradient(160deg,#1a0d2e,#0d1f3c)',
        lat: postCoords.lat,
        lng: postCoords.lng,
      });

      setSuccess(true);
      window.setTimeout(() => navigate('/feed'), 1800);
    } finally {
      setPosting(false);
    }
  };

  return (
    <motion.div
      className={styles.overlay}
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 32, stiffness: 280 }}
    >
      <header className={styles.header}>
        <button type="button" className={styles.closeBtn} onClick={() => navigate(-1)} aria-label="Close">
          <X size={20} />
        </button>
        <h2 className={styles.title}>New Update</h2>
        <button
          type="button"
          className={styles.postBtn}
          disabled={!canPost}
          onClick={submit}
        >
          Post
        </button>
      </header>

      <div className={styles.body}>
        {(uploading || posting) && (
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${posting && !uploading ? 80 : progress}%` }}
            />
          </div>
        )}

        <AnimatePresence mode="wait">
          {success ? (
            <motion.div
              key="success"
              className={styles.successCard}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <svg viewBox="0 0 64 64" width="64" height="64">
                <motion.circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  stroke="#FF5C1A"
                  strokeWidth="3"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.5 }}
                />
                <motion.path
                  d="M20 33 L29 42 L45 24"
                  fill="none"
                  stroke="#FF5C1A"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.4, delay: 0.4 }}
                />
              </svg>
              <h3>Update Posted! 🎉</h3>
              <p>Your business is live on the map</p>
            </motion.div>
          ) : (
            <motion.div key="form" className={styles.form}>
              {!video && <DealTemplates onPick={handleTemplate} />}

              <VideoSelector selected={video} onSelect={setVideo} />

              {video && (
                <>
                  <label className={styles.captionLabel}>
                    Caption
                    <textarea
                      className={styles.textarea}
                      maxLength={150}
                      placeholder="Tell people what's happening..."
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                    />
                    <span
                      className={`${styles.counter} ${charOver ? styles.counterRed : ''}`}
                    >
                      {charCount}/150
                    </span>
                  </label>

                  <div>
                    <div className={styles.sectionLabel}>Post type</div>
                    <div className={`${styles.tags} no-scrollbar`}>
                      {TAG_OPTIONS.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          className={`${styles.tagChip} ${tag === t.id ? styles.tagChipActive : ''}`}
                          onClick={() => setTag((cur) => (cur === t.id ? null : t.id))}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <AnimatePresence>
                    {tag === 'flashDeal' && (
                      <motion.div
                        className={styles.dealBox}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <input
                          className={styles.input}
                          placeholder="Deal headline..."
                          value={deal.headline}
                          onChange={(e) => setDeal({ ...deal, headline: e.target.value })}
                        />
                        <div className={styles.priceRow}>
                          <input
                            className={styles.input}
                            type="number"
                            placeholder="Original $"
                            value={deal.originalPrice}
                            onChange={(e) =>
                              setDeal({ ...deal, originalPrice: e.target.value })
                            }
                          />
                          <input
                            className={styles.input}
                            type="number"
                            placeholder="Deal $"
                            value={deal.dealPrice}
                            onChange={(e) => setDeal({ ...deal, dealPrice: e.target.value })}
                          />
                          <input
                            className={styles.input}
                            type="number"
                            placeholder="% off"
                            value={deal.discountPercent}
                            onChange={(e) =>
                              setDeal({ ...deal, discountPercent: e.target.value })
                            }
                          />
                        </div>
                        <div className={styles.durationRow}>
                          {DURATIONS.map((d) => (
                            <button
                              key={d}
                              type="button"
                              className={`${styles.durationChip} ${
                                deal.duration === d ? styles.durationChipActive : ''
                              }`}
                              onClick={() => setDeal({ ...deal, duration: d })}
                            >
                              {d}hr
                            </button>
                          ))}
                        </div>
                        <div className={styles.previewChip}>⏱ Countdown: {deal.duration}h 00m 00s</div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button
                    type="button"
                    className={styles.locationRow}
                    onClick={() => setLocationSheetOpen(true)}
                    aria-label="Change post location"
                  >
                    <MapPin size={14} className={styles.locationIcon} />
                    <span className={styles.locationText}>{location_}</span>
                    <span className={styles.changeBtn}>Change</span>
                  </button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AddLocationSheet
        open={locationSheetOpen}
        onClose={() => setLocationSheetOpen(false)}
        onSave={handleLocationPick}
        proximity={userLocation}
        title="Where is this post from?"
        saveLabel="Use this location"
        pickOnly
      />
    </motion.div>
  );
}
