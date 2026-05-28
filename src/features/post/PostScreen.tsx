import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ImagePlus, MapPin, Sparkles, X } from 'lucide-react';
import { VideoSelector, type SelectedVideo } from './VideoSelector';
import { useVideoUpload } from '../../hooks/useVideoUpload';
import { useFeedStore, type FeedCategory } from '../../stores/feedStore';
import { useDealStore, type Deal } from '../../stores/dealStore';
import { useMapStore } from '../../stores/mapStore';
import { useAuthStore } from '../../stores/authStore';
import { useCatalogStore } from '../../stores/catalogStore';
import { AddLocationSheet, type AddedLocation } from '../places/AddLocationSheet';
import { createDeal, createPost, uploadImage } from '../../lib/supabaseApi';
import { AIDealAutopilot, type AIDealDraft } from './AIDealAutopilot';
import { AIUpgradeModal } from './AIUpgradeModal';
import styles from './PostScreen.module.css';

type PostStep = 'choose' | 'update' | 'deal-chooser' | 'deal' | 'ai-autopilot';
type PriceMode = 'price' | 'percent' | 'free';
type DealMedia = 'video' | 'photo';

const FEED_CATEGORIES: { id: FeedCategory; label: string }[] = [
  { id: 'announcement', label: '📣 Announcement' },
  { id: 'menuItem', label: '🍽️ Menu Item' },
  { id: 'event', label: '🎉 Event' },
  { id: 'behindTheScenes', label: '📸 Behind the Scenes' },
  { id: 'newStock', label: '📦 New Stock' },
  { id: 'update', label: '✨ General Update' },
];

const DEAL_CATEGORIES = [
  '⚡ Flash Sale',
  '🎉 Event Deal',
  '⏳ Limited Offer',
  '📦 Bundle Deal',
  '🏷️ Clearance',
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
  headline?: string;
  discountType?: 'fixed' | 'percent';
  discountValue?: number;
  defaultDuration?: number;
}

const DEFAULT_GRADIENT = 'linear-gradient(160deg,#1a0d2e,#0d1f3c)';

export function PostScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const prependPost = useFeedStore((s) => s.prependPost);
  const addDeal = useDealStore((s) => s.addDeal);
  const authBusiness = useAuthStore((s) => s.business);
  const userLocation = useMapStore((s) => s.userLocation);
  const { upload, progress, uploading } = useVideoUpload();

  const [step, setStep] = useState<PostStep>('choose');
  const [video, setVideo] = useState<SelectedVideo | null>(null);
  const [photo, setPhoto] = useState<{ url: string; blob: Blob | File } | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [dealMedia, setDealMedia] = useState<DealMedia>('video');
  const [caption, setCaption] = useState('');
  const [feedCategory, setFeedCategory] = useState<FeedCategory>('update');
  const [dealCategory, setDealCategory] = useState<string>(DEAL_CATEGORIES[0]);
  const [priceMode, setPriceMode] = useState<PriceMode>('price');
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
  const [postError, setPostError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const catalogItems = useCatalogStore((s) => s.items);
  const isPro = !!authBusiness?.isPro;

  // A template link (e.g. from a deal shortcut) jumps straight into the deal flow.
  useEffect(() => {
    const state = location.state as RouterTemplateState | null;
    if (!state) return;
    if (state.headline) setDeal((d) => ({ ...d, headline: state.headline ?? '' }));
    if (state.discountType === 'fixed' && state.discountValue) {
      setPriceMode('price');
      setDeal((d) => ({ ...d, dealPrice: String(state.discountValue) }));
    }
    if (state.discountType === 'percent' && state.discountValue) {
      setPriceMode('percent');
      setDeal((d) => ({ ...d, discountPercent: String(state.discountValue) }));
    }
    if (state.defaultDuration) setDeal((d) => ({ ...d, duration: state.defaultDuration ?? 4 }));
    setStep('deal');
  }, [location.state]);

  const handleAIAutopilot = () => {
    if (isPro) setStep('ai-autopilot');
    else setUpgradeOpen(true);
  };

  const charCount = caption.length;
  const charOver = charCount > 130;

  const pricingValid =
    priceMode === 'free' ||
    (priceMode === 'price' && !!deal.dealPrice) ||
    (priceMode === 'percent' && !!deal.discountPercent);

  const canPostUpdate = !!video && !uploading && !posting && caption.trim().length > 0;
  const canPostDeal =
    (dealMedia === 'video' ? !!video : !!photo) &&
    !uploading &&
    !photoUploading &&
    !posting &&
    deal.headline.trim().length > 0 &&
    pricingValid;
  const canPost = step === 'update' ? canPostUpdate : step === 'deal' ? canPostDeal : false;

  const handleLocationPick = (place: AddedLocation) => {
    setLocation(place.placeName ?? place.name);
    setLocationCoords({ lat: place.lat, lng: place.lng });
  };

  const pickPhoto = () => {
    if (typeof document === 'undefined') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const localUrl = URL.createObjectURL(file);
      setPhoto({ url: localUrl, blob: file });
      setPhotoUploading(true);
      try {
        const hosted = await uploadImage(file);
        if (hosted) setPhoto({ url: hosted, blob: file });
      } catch {
        /* keep local preview */
      } finally {
        setPhotoUploading(false);
      }
    };
    input.click();
  };

  const postCoords = () =>
    locationCoords ??
    (userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : null) ??
    { lat: 26.0118, lng: -80.1495 };

  // ── FLOW A: video update → posts(post_type='feed')
  const submitUpdate = async () => {
    if (!video) return;
    setPostError(null);
    setPosting(true);
    try {
      let videoUrl: string | undefined;
      try {
        videoUrl = (await upload(video.blob)).url;
      } catch {
        videoUrl = video.url;
      }

      let realPostId: string | null = null;
      if (authBusiness) {
        try {
          realPostId = await createPost({
            businessId: authBusiness.id,
            caption,
            videoUrl,
            postType: 'feed',
            postCategory: feedCategory,
          });
        } catch (e) {
          setPostError(
            `Couldn't save your update${e instanceof Error ? ` — ${e.message}` : ''}. Please try again.`,
          );
          setPosting(false);
          return;
        }
      }

      const coords = postCoords();
      prependPost({
        id: realPostId ?? `p_${Date.now()}`,
        businessId: authBusiness?.id ?? 'self',
        businessName: authBusiness?.name ?? 'Your Business',
        businessCategory: authBusiness?.category ?? 'Featured',
        businessEmoji: '✨',
        caption,
        likeCount: 0,
        commentCount: 0,
        distanceMiles: 0,
        isLiked: false,
        isPinned: false,
        postCategory: feedCategory,
        createdAt: new Date(),
        videoUrl,
        thumbnailGradient: DEFAULT_GRADIENT,
        lat: coords.lat,
        lng: coords.lng,
      });

      setSuccess(true);
      window.setTimeout(() => navigate('/feed'), 1800);
    } finally {
      setPosting(false);
    }
  };

  // ── FLOW B: deal (photo or video) → posts(post_type='deal') + deals
  const submitDeal = async () => {
    setPostError(null);
    setPosting(true);
    try {
      let mediaUrl: string | undefined;
      const mediaType: 'image' | 'video' = dealMedia === 'video' ? 'video' : 'image';
      if (dealMedia === 'video' && video) {
        try {
          mediaUrl = (await upload(video.blob)).url;
        } catch {
          mediaUrl = video.url;
        }
      } else if (dealMedia === 'photo' && photo) {
        mediaUrl = photo.url;
      }

      const originalPrice =
        priceMode === 'price' && deal.originalPrice ? Number(deal.originalPrice) : null;
      const dealPrice =
        priceMode === 'price' && deal.dealPrice
          ? Number(deal.dealPrice)
          : priceMode === 'free'
            ? 0
            : null;
      const discountPercent =
        priceMode === 'percent' && deal.discountPercent ? Number(deal.discountPercent) : null;
      const expiresAt = new Date(Date.now() + deal.duration * 3600000);
      const cleanCategory = dealCategory.replace(/^[^\w]+\s*/, '');

      let realDealId: string | null = null;
      if (authBusiness) {
        try {
          // Deal posts live in both tables: a 'deal' post + the deals row.
          await createPost({
            businessId: authBusiness.id,
            caption: caption || deal.headline,
            videoUrl: dealMedia === 'video' ? mediaUrl : undefined,
            thumbnailUrl: dealMedia === 'photo' ? mediaUrl : undefined,
            postType: 'deal',
          });
          realDealId = await createDeal({
            businessId: authBusiness.id,
            headline: deal.headline,
            description: caption,
            originalPrice,
            dealPrice,
            discountPercent,
            expiresAt,
            mediaUrl: mediaUrl ?? null,
            mediaType,
            dealCategory: cleanCategory,
          });
        } catch (e) {
          setPostError(
            `Couldn't save your deal${e instanceof Error ? ` — ${e.message}` : ''}. Please try again.`,
          );
          setPosting(false);
          return;
        }
      }

      const coords = postCoords();
      const newDeal: Deal = {
        id: realDealId ?? `d_${Date.now()}`,
        businessId: authBusiness?.id,
        businessName: authBusiness?.name ?? 'Your Business',
        category: authBusiness?.category ?? 'Food',
        emoji: '⚡',
        headline: deal.headline,
        description: caption,
        originalPrice,
        dealPrice,
        discountPercent,
        expiresAt,
        distanceMiles: 0,
        isFeatured: false,
        isPro,
        viewCount: 0,
        claimCount: 0,
        stripeProductId: `prod_${realDealId ?? Date.now()}`,
        mediaUrl,
        mediaType,
        dealCategory: cleanCategory,
        lat: coords.lat,
        lng: coords.lng,
      };
      addDeal(newDeal);

      setSuccess(true);
      window.setTimeout(() => navigate('/deals'), 1800);
    } finally {
      setPosting(false);
    }
  };

  // ── AI Autopilot post: turn the AI draft into a real deal.
  const submitAIDeal = async (draft: AIDealDraft) => {
    setPostError(null);
    setPosting(true);
    try {
      const expiresAt = new Date(Date.now() + draft.durationHours * 3600000);
      const item = catalogItems.find((i) => i.id === draft.catalogItemId);
      let realDealId: string | null = null;
      if (authBusiness) {
        try {
          await createPost({
            businessId: authBusiness.id,
            caption: draft.description || draft.headline,
            thumbnailUrl: draft.imageUrl,
            postType: 'deal',
          });
          realDealId = await createDeal({
            businessId: authBusiness.id,
            headline: draft.headline,
            description: draft.description,
            originalPrice: draft.pricingType === 'fixed' ? draft.originalPrice : null,
            dealPrice: draft.pricingType === 'fixed' ? draft.dealPrice : null,
            discountPercent: draft.pricingType === 'percent' ? draft.discountPercent : null,
            expiresAt,
            mediaUrl: draft.imageUrl,
            mediaType: 'image',
            dealCategory: 'Flash Sale',
          });
        } catch (e) {
          setPostError(
            `Couldn't save your AI deal${e instanceof Error ? ` — ${e.message}` : ''}.`,
          );
          setPosting(false);
          return;
        }
      }
      const coords = postCoords();
      addDeal({
        id: realDealId ?? `d_${Date.now()}`,
        businessId: authBusiness?.id,
        businessName: authBusiness?.name ?? 'Your Business',
        category: authBusiness?.category ?? item?.category ?? 'Food',
        emoji: '⚡',
        headline: draft.headline,
        description: draft.description,
        originalPrice: draft.pricingType === 'fixed' ? draft.originalPrice : null,
        dealPrice: draft.pricingType === 'fixed' ? draft.dealPrice : null,
        discountPercent: draft.pricingType === 'percent' ? draft.discountPercent : null,
        expiresAt,
        distanceMiles: 0,
        isFeatured: true,
        isPro: true,
        viewCount: 0,
        claimCount: 0,
        stripeProductId: `prod_${realDealId ?? Date.now()}`,
        mediaUrl: draft.imageUrl,
        mediaType: 'image',
        dealCategory: 'Flash Sale',
        lat: coords.lat,
        lng: coords.lng,
      });
      setSuccess(true);
      window.setTimeout(() => navigate('/deals'), 1800);
    } finally {
      setPosting(false);
    }
  };

  const headerTitle =
    step === 'choose'
      ? 'New Post'
      : step === 'update'
        ? 'New Update'
        : step === 'ai-autopilot'
          ? 'AI Autopilot'
          : 'New Deal';

  return (
    <motion.div
      className={styles.overlay}
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 32, stiffness: 280 }}
    >
      <header className={styles.header}>
        {step === 'choose' ? (
          <button
            type="button"
            className={styles.closeBtn}
            onClick={() => navigate(-1)}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        ) : (
          <button
            type="button"
            className={styles.backBtn}
            onClick={() =>
              setStep(step === 'deal' || step === 'ai-autopilot' ? 'deal-chooser' : 'choose')
            }
            aria-label="Back"
          >
            <ArrowLeft size={20} />
          </button>
        )}
        <h2 className={styles.title}>{headerTitle}</h2>
        {step === 'update' || step === 'deal' ? (
          <button
            type="button"
            className={styles.postBtn}
            disabled={!canPost}
            onClick={step === 'update' ? submitUpdate : submitDeal}
          >
            Post
          </button>
        ) : (
          <span />
        )}
      </header>

      <div className={styles.body}>
        {(uploading || posting) && (
          <>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${uploading ? progress : posting ? 90 : 0}%` }}
              />
            </div>
            <div className={styles.progressLabel}>
              {uploading ? `Uploading… ${progress}%` : 'Posting…'}
            </div>
          </>
        )}

        {postError && !posting && <div className={styles.postError}>{postError}</div>}

        <AnimatePresence mode="wait">
          {success ? (
            <SuccessCard key="success" isDeal={step === 'deal'} />
          ) : step === 'choose' ? (
            <motion.div
              key="choose"
              className={styles.form}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <h3 className={styles.chooserIntro}>What are you posting today?</h3>
              <p className={styles.chooserSub}>
                Updates are short videos. Deals carry a price or discount.
              </p>
              <div className={styles.chooserGrid}>
                <button
                  type="button"
                  className={`${styles.chooserCard} ${styles.chooserCardUpdate}`}
                  onClick={() => setStep('update')}
                >
                  <span className={styles.chooserEmoji}>🎥</span>
                  <div>
                    <div className={styles.chooserCardTitle}>Update</div>
                    <div className={styles.chooserCardSub}>
                      Share a 15–90 sec video. No pricing — just what's happening.
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  className={`${styles.chooserCard} ${styles.chooserCardDeal}`}
                  onClick={() => setStep('deal-chooser')}
                >
                  <span className={styles.chooserEmoji}>⚡</span>
                  <div>
                    <div className={styles.chooserCardTitle}>Deal</div>
                    <div className={styles.chooserCardSub}>
                      Photo or video with a discount, countdown, and claim.
                    </div>
                  </div>
                </button>
              </div>
            </motion.div>
          ) : step === 'deal-chooser' ? (
            <motion.div
              key="deal-chooser"
              className={styles.form}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <h3 className={styles.chooserIntro}>How do you want to build it?</h3>
              <p className={styles.chooserSub}>
                Flash deals are always free. Pro unlocks AI Autopilot.
              </p>
              <div className={styles.chooserGrid}>
                <button
                  type="button"
                  className={styles.chooserCard}
                  onClick={() => setStep('deal')}
                >
                  <span className={styles.chooserEmoji}>✍️</span>
                  <div>
                    <div className={styles.chooserCardTitle}>Create Manually</div>
                    <div className={styles.chooserCardSub}>
                      Pick your media, price, and duration yourself. Free for everyone.
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  className={`${styles.chooserCard} ${styles.chooserCardAI}`}
                  onClick={handleAIAutopilot}
                >
                  <span className={styles.chooserEmoji}><Sparkles size={30} /></span>
                  <div>
                    <div className={styles.chooserCardTitle}>
                      AI Autopilot <span className={styles.proTag}>⭐ PRO</span>
                    </div>
                    <div className={styles.chooserCardSub}>
                      AI writes the copy, makes the image, and picks the best time.
                    </div>
                  </div>
                </button>
              </div>
            </motion.div>
          ) : step === 'ai-autopilot' ? (
            <motion.div
              key="ai"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <AIDealAutopilot
                businessId={authBusiness?.id ?? 'demo'}
                onPost={submitAIDeal}
                onDiscard={() => setStep('deal-chooser')}
                onStartOver={() => {
                  setStep('deal-chooser');
                  window.setTimeout(() => setStep('ai-autopilot'), 0);
                }}
              />
            </motion.div>
          ) : step === 'update' ? (
            <motion.div
              key="update"
              className={styles.form}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <VideoSelector selected={video} onSelect={setVideo} />

              {video && (
                <>
                  <div>
                    <div className={styles.sectionLabel}>Category</div>
                    <div className={styles.categoryGrid}>
                      {FEED_CATEGORIES.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className={`${styles.tagChip} ${feedCategory === c.id ? styles.tagChipActive : ''}`}
                          onClick={() => setFeedCategory(c.id)}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className={styles.captionLabel}>
                    Caption
                    <textarea
                      className={styles.textarea}
                      maxLength={150}
                      placeholder="Tell people what's happening..."
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                    />
                    <span className={`${styles.counter} ${charOver ? styles.counterRed : ''}`}>
                      {charCount}/150
                    </span>
                  </label>

                  <LocationRow label={location_} onClick={() => setLocationSheetOpen(true)} />
                </>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="deal"
              className={styles.form}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className={styles.mediaTypeToggle}>
                <button
                  type="button"
                  className={`${styles.priceModeBtn} ${dealMedia === 'video' ? styles.priceModeActive : ''}`}
                  onClick={() => setDealMedia('video')}
                >
                  🎥 Video
                </button>
                <button
                  type="button"
                  className={`${styles.priceModeBtn} ${dealMedia === 'photo' ? styles.priceModeActive : ''}`}
                  onClick={() => setDealMedia('photo')}
                >
                  📷 Photo
                </button>
              </div>

              {dealMedia === 'video' ? (
                <VideoSelector selected={video} onSelect={setVideo} />
              ) : (
                <button type="button" className={styles.photoPicker} onClick={pickPhoto}>
                  {photo ? (
                    <>
                      <img src={photo.url} alt="" className={styles.photoPreview} />
                      <span className={styles.photoChange}>
                        {photoUploading ? 'Uploading…' : 'Change'}
                      </span>
                    </>
                  ) : (
                    <span className={styles.photoEmpty}>
                      <ImagePlus size={28} /> Add a photo
                    </span>
                  )}
                </button>
              )}

              <div>
                <div className={styles.sectionLabel}>Deal type</div>
                <div className={styles.categoryGrid}>
                  {DEAL_CATEGORIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`${styles.tagChip} ${dealCategory === c ? styles.tagChipActive : ''}`}
                      onClick={() => setDealCategory(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.dealBox}>
                <input
                  className={styles.input}
                  placeholder="Deal headline (e.g. Half-price pastries)"
                  value={deal.headline}
                  onChange={(e) => setDeal({ ...deal, headline: e.target.value })}
                />

                <div className={styles.priceModeToggle}>
                  <button
                    type="button"
                    className={`${styles.priceModeBtn} ${priceMode === 'price' ? styles.priceModeActive : ''}`}
                    onClick={() => setPriceMode('price')}
                  >
                    Set prices
                  </button>
                  <button
                    type="button"
                    className={`${styles.priceModeBtn} ${priceMode === 'percent' ? styles.priceModeActive : ''}`}
                    onClick={() => setPriceMode('percent')}
                  >
                    % off
                  </button>
                  <button
                    type="button"
                    className={`${styles.priceModeBtn} ${priceMode === 'free' ? styles.priceModeActive : ''}`}
                    onClick={() => setPriceMode('free')}
                  >
                    Free
                  </button>
                </div>

                {priceMode === 'price' && (
                  <div className={styles.priceRow}>
                    <input
                      className={styles.input}
                      type="number"
                      inputMode="decimal"
                      min="0"
                      placeholder="Original $"
                      value={deal.originalPrice}
                      onChange={(e) => setDeal({ ...deal, originalPrice: e.target.value })}
                    />
                    <input
                      className={styles.input}
                      type="number"
                      inputMode="decimal"
                      min="0"
                      placeholder="Deal $"
                      value={deal.dealPrice}
                      onChange={(e) => setDeal({ ...deal, dealPrice: e.target.value })}
                    />
                  </div>
                )}
                {priceMode === 'percent' && (
                  <input
                    className={styles.input}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max="100"
                    placeholder="Discount % off"
                    value={deal.discountPercent}
                    onChange={(e) => setDeal({ ...deal, discountPercent: e.target.value })}
                  />
                )}
                {priceMode === 'free' && (
                  <div className={styles.previewChip}>🎁 This will be posted as a freebie</div>
                )}

                <div className={styles.durationRow}>
                  {DURATIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      className={`${styles.durationChip} ${deal.duration === d ? styles.durationChipActive : ''}`}
                      onClick={() => setDeal({ ...deal, duration: d })}
                    >
                      {d}hr
                    </button>
                  ))}
                </div>
                <div className={styles.previewChip}>
                  ⏱ Countdown: {deal.duration}h 00m 00s ·{' '}
                  {priceMode === 'percent' && deal.discountPercent
                    ? `${deal.discountPercent}% off`
                    : priceMode === 'price' && deal.dealPrice
                      ? `$${deal.dealPrice}${deal.originalPrice ? ` (was $${deal.originalPrice})` : ''}`
                      : priceMode === 'free'
                        ? 'Free'
                        : 'Set a price'}
                </div>
              </div>

              <label className={styles.captionLabel}>
                Description (optional)
                <textarea
                  className={styles.textarea}
                  maxLength={150}
                  placeholder="Add details about this deal..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                />
              </label>

              <LocationRow label={location_} onClick={() => setLocationSheetOpen(true)} />
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

      <AIUpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        onTrialStarted={() => setStep('ai-autopilot')}
      />
    </motion.div>
  );
}

function LocationRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className={styles.locationRow}
      onClick={onClick}
      aria-label="Change post location"
    >
      <MapPin size={14} className={styles.locationIcon} />
      <span className={styles.locationText}>{label}</span>
      <span className={styles.changeBtn}>Change</span>
    </button>
  );
}

function SuccessCard({ isDeal }: { isDeal: boolean }) {
  return (
    <motion.div
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
      <h3>{isDeal ? 'Deal Posted! ⚡' : 'Update Posted! 🎉'}</h3>
      <p>{isDeal ? 'Your deal is live with a countdown' : 'Your update is live on the feed'}</p>
    </motion.div>
  );
}
