import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Sparkles } from 'lucide-react';
import {
  suggestDeal,
  regenerateDealImage,
  type AISuggestionResponse,
} from '../../lib/aiService';
import { useCatalogStore } from '../../stores/catalogStore';
import { Button } from '../../components/ui/Button';
import styles from './AIDealAutopilot.module.css';

const LOADING_MESSAGES = [
  'Scanning your menu for opportunities…',
  'Analyzing what’s selling nearby…',
  'Checking competitor deals…',
  'Writing your deal copy…',
  'Creating your deal image…',
  'Finding the best time to post…',
  'Putting it all together…',
];

const DURATIONS = [2, 4, 8, 24];

export interface AIDealDraft {
  catalogItemId: string;
  headline: string;
  description: string;
  pricingType: 'fixed' | 'percent';
  originalPrice: number | null;
  dealPrice: number | null;
  discountPercent: number | null;
  durationHours: number;
  postNow: boolean;
  scheduledFor: string; // ISO
  imageUrl: string;
  imagePrompt: string;
  reasoning: string;
}

interface AIDealAutopilotProps {
  businessId: string;
  onPost: (draft: AIDealDraft) => void;
  onDiscard: () => void;
  onStartOver: () => void;
}

export function AIDealAutopilot({
  businessId,
  onPost,
  onDiscard,
  onStartOver,
}: AIDealAutopilotProps) {
  const catalog = useCatalogStore((s) => s.items);
  const [phase, setPhase] = useState<'loading' | 'error' | 'ready'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AISuggestionResponse | null>(null);
  const [draft, setDraft] = useState<AIDealDraft | null>(null);
  const [messageIdx, setMessageIdx] = useState(0);
  const [regenCount, setRegenCount] = useState(0);
  const [regenLoading, setRegenLoading] = useState(false);
  const fetchedRef = useRef(false);

  // Rotate loading messages every 1.4s while loading.
  useEffect(() => {
    if (phase !== 'loading') return;
    const t = window.setInterval(() => setMessageIdx((i) => (i + 1) % LOADING_MESSAGES.length), 1400);
    return () => window.clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    suggestDeal(businessId)
      .then((res) => {
        setData(res);
        setDraft(responseToDraft(res));
        setPhase('ready');
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'AI is unavailable right now.');
        setPhase('error');
      });
  }, [businessId]);

  const handleRegen = async () => {
    if (!draft || regenLoading || regenCount >= 3) return;
    setRegenLoading(true);
    try {
      const res = await regenerateDealImage({
        businessId,
        imagePrompt: draft.imagePrompt,
        catalogItemPhoto: data?.catalogItemPhoto ?? null,
        regenerationCount: regenCount,
      });
      setDraft({ ...draft, imageUrl: res.generatedImageUrl });
      setRegenCount((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not regenerate image');
    } finally {
      setRegenLoading(false);
    }
  };

  if (phase === 'loading') {
    return (
      <div className={styles.loading}>
        <motion.div
          className={styles.spinner}
          animate={{ rotate: 360 }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
        />
        <div className={styles.loadingTitle}>✨ AI Autopilot</div>
        <motion.div
          key={messageIdx}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={styles.loadingMsg}
        >
          {LOADING_MESSAGES[messageIdx]}
        </motion.div>
      </div>
    );
  }

  if (phase === 'error' || !draft || !data) {
    return (
      <div className={styles.errorCard}>
        <h3>AI hit a snag</h3>
        <p>{error ?? 'Please try again in a moment.'}</p>
        <Button variant="outline" onClick={onDiscard}>
          Close
        </Button>
      </div>
    );
  }

  const bestTimeLabel = formatBestTime(draft.scheduledFor);

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <div className={styles.headerTitle}>
          <Sparkles size={16} /> Your AI Deal
        </div>
        <button type="button" className={styles.linkBtn} onClick={onStartOver}>
          Start Over
        </button>
      </header>

      {/* Generated image + regenerate */}
      <div className={styles.imageWrap}>
        <img src={draft.imageUrl} alt="AI-generated deal" className={styles.image} loading="lazy" />
        <button
          type="button"
          className={styles.regenBtn}
          onClick={handleRegen}
          disabled={regenCount >= 3 || regenLoading}
        >
          <RefreshCw size={12} className={regenLoading ? styles.spin : ''} />{' '}
          {regenLoading ? 'Generating…' : 'Generate Different Image'}{' '}
          <span className={styles.regenCount}>{3 - regenCount}/3 left</span>
        </button>
      </div>

      {/* Fields */}
      <label className={styles.label}>
        Item
        <select
          className={styles.input}
          value={draft.catalogItemId}
          onChange={(e) => setDraft({ ...draft, catalogItemId: e.target.value })}
        >
          {catalog.length === 0 && (
            <option value="">No catalog items — add some first</option>
          )}
          {catalog.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.label}>
        Headline
        <input
          className={styles.input}
          maxLength={60}
          value={draft.headline}
          onChange={(e) => setDraft({ ...draft, headline: e.target.value })}
        />
      </label>

      <label className={styles.label}>
        Description
        <textarea
          className={styles.textarea}
          maxLength={150}
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        />
      </label>

      <div className={styles.label}>
        Pricing
        <div className={styles.toggle}>
          <button
            type="button"
            className={`${styles.toggleBtn} ${draft.pricingType === 'fixed' ? styles.toggleActive : ''}`}
            onClick={() => setDraft({ ...draft, pricingType: 'fixed' })}
          >
            Fixed Price
          </button>
          <button
            type="button"
            className={`${styles.toggleBtn} ${draft.pricingType === 'percent' ? styles.toggleActive : ''}`}
            onClick={() => setDraft({ ...draft, pricingType: 'percent' })}
          >
            Percentage
          </button>
        </div>
        {draft.pricingType === 'fixed' ? (
          <div className={styles.priceRow}>
            <input
              className={styles.input}
              type="number"
              min="0"
              placeholder="Original $"
              value={draft.originalPrice ?? ''}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  originalPrice: e.target.value ? Number(e.target.value) : null,
                })
              }
            />
            <input
              className={styles.input}
              type="number"
              min="0"
              placeholder="Deal $"
              value={draft.dealPrice ?? ''}
              onChange={(e) =>
                setDraft({ ...draft, dealPrice: e.target.value ? Number(e.target.value) : null })
              }
            />
          </div>
        ) : (
          <input
            className={styles.input}
            type="number"
            min="0"
            max="100"
            placeholder="% off"
            value={draft.discountPercent ?? ''}
            onChange={(e) =>
              setDraft({
                ...draft,
                discountPercent: e.target.value ? Number(e.target.value) : null,
              })
            }
          />
        )}
      </div>

      <div className={styles.label}>
        Duration
        <div className={styles.toggle}>
          {DURATIONS.map((d) => (
            <button
              key={d}
              type="button"
              className={`${styles.toggleBtn} ${draft.durationHours === d ? styles.toggleActive : ''}`}
              onClick={() => setDraft({ ...draft, durationHours: d })}
            >
              {d}hr
            </button>
          ))}
        </div>
      </div>

      <div className={styles.label}>
        Post Time
        <div className={styles.toggle}>
          <button
            type="button"
            className={`${styles.toggleBtn} ${draft.postNow ? styles.toggleActive : ''}`}
            onClick={() => setDraft({ ...draft, postNow: true })}
          >
            Post Now
          </button>
          <button
            type="button"
            className={`${styles.toggleBtn} ${!draft.postNow ? styles.toggleActive : ''}`}
            onClick={() => setDraft({ ...draft, postNow: false })}
          >
            ⭐ Best Time: {bestTimeLabel}
          </button>
        </div>
        {!draft.postNow && (
          <div className={styles.bestTimeNote}>{data.postTimeReason}</div>
        )}
      </div>

      <div className={styles.whyCard}>
        <div className={styles.whyHead}>
          <Sparkles size={12} /> Why AI picked this
        </div>
        <p className={styles.whyBody}>{draft.reasoning}</p>
      </div>

      <div className={styles.footer}>
        <Button variant="outline" onClick={onDiscard}>
          ✗ Discard
        </Button>
        <Button variant="primary" fullWidth onClick={() => onPost(draft)}>
          ✓ Looks Good — Post It
        </Button>
      </div>
    </div>
  );
}

function responseToDraft(r: AISuggestionResponse): AIDealDraft {
  const s = r.suggestion;
  return {
    catalogItemId: s.catalog_item_id,
    headline: s.headline,
    description: s.description,
    pricingType: s.pricing_type,
    originalPrice: s.pricing_type === 'fixed' ? s.original_price : null,
    dealPrice: s.pricing_type === 'fixed' ? s.deal_price : null,
    discountPercent: s.pricing_type === 'percent' ? s.discount_percent : null,
    durationHours: s.recommended_duration_hours,
    postNow: s.recommended_post_time_offset_minutes <= 0,
    scheduledFor: r.recommendedPostTime,
    imageUrl: r.generatedImageUrl,
    imagePrompt: s.image_prompt,
    reasoning: s.reasoning,
  };
}

function formatBestTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      weekday: 'short',
    });
  } catch {
    return 'Today';
  }
}
