import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, MapPin, Pin } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import ReactPlayer from 'react-player';
import type { FeedPost } from '../../stores/feedStore';
import { useFeedStore } from '../../stores/feedStore';
import { useDealStore } from '../../stores/dealStore';
import { useCountdown } from '../../hooks/useCountdown';
import { tapHaptic } from '../../lib/haptics';
import styles from './VideoCard.module.css';

interface VideoCardProps {
  post: FeedPost;
}

export function VideoCard({ post }: VideoCardProps) {
  const navigate = useNavigate();
  const likePost = useFeedStore((s) => s.likePost);
  const pinPost = useFeedStore((s) => s.pinPost);
  const openCheckout = useDealStore((s) => s.openCheckout);
  const deals = useDealStore((s) => s.deals);

  const [visible, setVisible] = useState(false);
  const [flyingPin, setFlyingPin] = useState(false);
  const [likeBurst, setLikeBurst] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => setVisible(entry.intersectionRatio > 0.5));
      },
      { threshold: [0, 0.5, 1] },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const deal = post.dealId ? deals.find((d) => d.id === post.dealId) ?? null : null;
  const countdown = useCountdown(deal?.expiresAt ?? new Date(Date.now() + 60_000));
  const dealHoursLeft = deal && !countdown.isExpired ? Math.max(1, countdown.hours) : null;

  const handleLike = () => {
    tapHaptic();
    likePost(post.id);
    setLikeBurst((n) => n + 1);
  };

  const handleSave = () => {
    tapHaptic();
    setFlyingPin(true);
    window.setTimeout(() => {
      pinPost(post.id);
      setFlyingPin(false);
    }, 500);
  };

  const handleClaim = () => {
    if (!deal) return;
    tapHaptic();
    navigate('/deals');
    window.setTimeout(() => openCheckout(deal.id), 150);
  };

  return (
    <div ref={cardRef} className={styles.card} style={{ background: post.thumbnailGradient }}>
      {visible && post.videoUrl ? (
        <ReactPlayer
          src={post.videoUrl}
          playing
          muted
          loop
          width="100%"
          height="100%"
          style={{ position: 'absolute', inset: 0, objectFit: 'cover' }}
        />
      ) : (
        <div className={styles.emoji}>{post.businessEmoji}</div>
      )}

      <div className={styles.gradient} />

      <div className={styles.top}>
        <div className={styles.bizPill}>
          <div className={styles.bizEmoji}>{post.businessEmoji}</div>
          <div className={styles.bizCopy}>
            <div className={styles.bizName}>{post.businessName}</div>
            <div className={styles.bizCat}>{post.businessCategory}</div>
          </div>
        </div>
        <div
          className={[styles.distance, post.hasDeal ? styles.distanceDeal : ''].join(' ')}
        >
          {post.hasDeal ? (
            <>
              ⚡ DEAL{dealHoursLeft != null ? ` · ${dealHoursLeft}h left` : ''}
            </>
          ) : (
            <>
              <MapPin size={11} /> {post.distanceMiles.toFixed(1)} mi
            </>
          )}
        </div>
      </div>

      <div className={styles.bottom}>
        <p className={styles.caption}>{post.caption}</p>
        <div className={styles.actionRow}>
          <button
            type="button"
            className={styles.likeBtn}
            onClick={handleLike}
            aria-label={post.isLiked ? 'Unlike' : 'Like'}
          >
            <motion.span
              key={likeBurst}
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 0.25 }}
              className={styles.likeIcon}
            >
              <Heart
                size={18}
                fill={post.isLiked ? '#FF3A3A' : 'transparent'}
                stroke={post.isLiked ? '#FF3A3A' : '#fff'}
                strokeWidth={1.8}
              />
            </motion.span>
            <span className={styles.likeCount}>{post.likeCount}</span>
          </button>

          {post.isPinned && (
            <span className={styles.pinned}>
              <Pin size={14} /> Pinned
            </span>
          )}

          <div className={styles.actionsRight}>
            {!post.isPinned && (
              <button
                type="button"
                className={styles.saveBtn}
                onClick={handleSave}
                aria-label="Save to map"
              >
                <Pin size={12} /> Save to Map
              </button>
            )}
            {post.hasDeal && (
              <button type="button" className={styles.claimBtn} onClick={handleClaim}>
                Claim Deal
              </button>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {flyingPin && (
          <motion.div
            className={styles.flyingPin}
            initial={{ opacity: 1, scale: 1, x: 0, y: 0 }}
            animate={{
              opacity: 0,
              scale: 0.3,
              x: -120,
              y: 220,
            }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            exit={{ opacity: 0 }}
          >
            <Pin size={20} fill="#1A3AFF" stroke="#1A3AFF" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
