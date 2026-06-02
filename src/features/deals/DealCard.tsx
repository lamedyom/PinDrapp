import { useEffect, useRef } from 'react';
import {
  Heart,
  MapPin,
  Megaphone,
  Share2,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { motion } from 'framer-motion';
import type { Deal } from '../../stores/dealStore';
import { useDealStore } from '../../stores/dealStore';
import { useCountdown } from '../../hooks/useCountdown';
import { tapHaptic } from '../../lib/haptics';
import { trackDealClaim, trackDealView } from '../../lib/supabaseApi';
import { shareContent } from '../../lib/share';
import styles from './DealCard.module.css';

const DEAL_URL = 'https://pindrapp.onrender.com/deals';

interface DealCardProps {
  deal: Deal;
  /** True when this card is rendered in the "Top Deals" Pro showcase. */
  featuredLabel?: boolean;
}

const CATEGORY_GRADIENT: Record<string, string> = {
  Food: 'linear-gradient(160deg,#2a1015,#0d1f1a)',
  Bakery: 'linear-gradient(160deg,#2a1a00,#1a1000)',
  Coffee: 'linear-gradient(160deg,#1a1000,#0d0a05)',
  Shopping: 'linear-gradient(160deg,#1a0d2e,#2a0d3c)',
  Beauty: 'linear-gradient(160deg,#2e0d2a,#3c0d2a)',
  Services: 'linear-gradient(160deg,#0d1f3c,#1a0d2e)',
  Entertainment: 'linear-gradient(160deg,#1a0d2e,#2a0d3c)',
};

export function DealCard({ deal, featuredLabel }: DealCardProps) {
  const openCheckout = useDealStore((s) => s.openCheckout);
  const likeDeal = useDealStore((s) => s.likeDeal);
  const hypeDeal = useDealStore((s) => s.hypeDeal);
  const followDealBusiness = useDealStore((s) => s.followDealBusiness);
  const pinDealBusiness = useDealStore((s) => s.pinDealBusiness);
  const c = useCountdown(deal.expiresAt);
  const urgent = !c.isExpired && c.totalSecondsLeft < 3600;
  const cardRef = useRef<HTMLDivElement>(null);
  const trackedRef = useRef(false);

  // Track a view once the card is at least 50% in view.
  useEffect(() => {
    const el = cardRef.current;
    if (!el || trackedRef.current) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5 && !trackedRef.current) {
            trackedRef.current = true;
            trackDealView(deal.id);
            obs.disconnect();
          }
        }
      },
      { threshold: [0, 0.5, 1] },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [deal.id]);

  const bg = CATEGORY_GRADIENT[deal.category] ?? 'linear-gradient(160deg,#1a1018,#0d1118)';

  return (
    <motion.div
      ref={cardRef}
      className={[
        styles.card,
        deal.isFeatured ? styles.featured : '',
        deal.isPro ? styles.pro : '',
        urgent ? styles.urgent : '',
        c.isExpired ? styles.expired : '',
      ]
        .filter(Boolean)
        .join(' ')}
      layout
    >
      <div className={styles.media} style={{ background: bg }}>
        {featuredLabel ? (
          <span className={styles.featuredBadge}>★ FEATURED</span>
        ) : deal.isPro ? (
          <span className={styles.proDot}>⭐ PRO</span>
        ) : null}
        {deal.mediaUrl && deal.mediaType === 'video' ? (
          <video
            className={styles.mediaEl}
            src={deal.mediaUrl}
            autoPlay
            muted
            loop
            playsInline
          />
        ) : deal.mediaUrl ? (
          <img className={styles.mediaEl} src={deal.mediaUrl} alt={deal.headline} loading="lazy" />
        ) : (
          <span className={styles.emoji}>{deal.emoji}</span>
        )}
        <div className={styles.gradient} />
        <div
          className={[styles.countdown, urgent ? styles.countdownUrgent : ''].join(' ')}
          aria-label="Time left"
        >
          {c.isExpired ? (
            <span className={styles.expiredText}>EXPIRED</span>
          ) : (
            <>
              <span className={styles.pulseDot} />
              <span className={styles.countText}>
                {pad(c.hours)}:{pad(c.minutes)}:{pad(c.seconds)}
              </span>
            </>
          )}
        </div>
        <div className={styles.businessRow}>
          <span className={styles.greenDot} /> {deal.businessName}
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.headline}>{deal.headline}</div>
        <p className={styles.desc}>{deal.description}</p>

        <div className={styles.footer}>
          <PriceDisplay deal={deal} />
          <div className={styles.footerActions}>
            <button
              type="button"
              className={styles.shareBtn}
              onClick={() => {
                tapHaptic();
                void shareContent({
                  title: `${deal.headline} — ${deal.businessName}`,
                  text: `Flash deal on Pindrapp: ${deal.headline}`,
                  url: `${DEAL_URL}/${deal.id}`,
                });
              }}
              aria-label={`Share ${deal.headline}`}
            >
              <Share2 size={14} />
            </button>
            <button
              type="button"
              className={styles.claim}
              disabled={c.isExpired}
              onClick={() => {
                tapHaptic();
                trackDealClaim(deal.id);
                openCheckout(deal.id);
              }}
            >
              Claim Deal
            </button>
          </div>
        </div>

        <div className={styles.socialRow}>
          <button
            type="button"
            className={`${styles.socialBtn} ${deal.isLiked ? styles.socialBtnActive : ''}`}
            onClick={() => {
              tapHaptic();
              likeDeal(deal.id);
            }}
            aria-label={deal.isLiked ? 'Unlike deal' : 'Like deal'}
          >
            <Heart
              size={18}
              fill={deal.isLiked ? '#FF3A3A' : 'transparent'}
              stroke={deal.isLiked ? '#FF3A3A' : 'currentColor'}
              strokeWidth={1.7}
            />
            <span>{deal.likeCount ?? 0}</span>
          </button>
          <button
            type="button"
            className={`${styles.socialBtn} ${deal.isHyped ? styles.socialBtnActive : ''}`}
            onClick={() => {
              tapHaptic();
              hypeDeal(deal.id);
            }}
            aria-label={deal.isHyped ? 'Unhype deal' : 'Hype deal'}
          >
            <Megaphone
              size={18}
              fill={deal.isHyped ? '#FF5C1A' : 'transparent'}
              stroke={deal.isHyped ? '#FF5C1A' : 'currentColor'}
              strokeWidth={1.7}
            />
            <span>{deal.hypeCount ?? 0}</span>
          </button>
          <button
            type="button"
            className={`${styles.socialBtn} ${deal.isFollowing ? styles.socialBtnActive : ''}`}
            onClick={() => {
              tapHaptic();
              followDealBusiness(deal.id);
            }}
            aria-label={deal.isFollowing ? 'Unfollow' : `Follow ${deal.businessName}`}
          >
            {deal.isFollowing ? (
              <UserCheck size={18} stroke="#00D97E" strokeWidth={1.9} />
            ) : (
              <UserPlus size={18} stroke="currentColor" strokeWidth={1.7} />
            )}
            <span>{deal.isFollowing ? 'Following' : 'Follow'}</span>
          </button>
          <button
            type="button"
            className={`${styles.socialBtn} ${deal.isPinned ? styles.socialBtnActive : ''}`}
            onClick={() => {
              tapHaptic();
              pinDealBusiness(deal.id);
            }}
            aria-label={deal.isPinned ? 'Remove from map' : 'Save to map'}
          >
            <MapPin
              size={18}
              fill={deal.isPinned ? '#1A3AFF' : 'transparent'}
              stroke={deal.isPinned ? '#1A3AFF' : 'currentColor'}
              strokeWidth={1.7}
            />
            <span>{deal.isPinned ? 'Saved' : 'Save'}</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function PriceDisplay({ deal }: { deal: Deal }) {
  if (deal.dealPrice && deal.originalPrice) {
    return (
      <div className={styles.price}>
        <span className={styles.priceMain}>${deal.dealPrice}</span>
        <span className={styles.priceWas}>was ${deal.originalPrice}</span>
      </div>
    );
  }
  if (deal.discountPercent) {
    return (
      <div className={styles.price}>
        <span className={styles.priceMain}>−{deal.discountPercent}%</span>
      </div>
    );
  }
  if (deal.dealPrice) {
    return (
      <div className={styles.price}>
        <span className={styles.priceMain}>${deal.dealPrice}</span>
      </div>
    );
  }
  return null;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}
