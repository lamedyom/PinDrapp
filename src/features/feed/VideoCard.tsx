import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronDown,
  Heart,
  MapPin,
  Megaphone,
  MoreHorizontal,
  Share2,
  Trash2,
  UserCheck,
  UserPlus,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ReactPlayer from 'react-player';
import type { FeedPost } from '../../stores/feedStore';
import { useFeedStore } from '../../stores/feedStore';
import { useAuthStore } from '../../stores/authStore';
import { tapHaptic } from '../../lib/haptics';
import { shareContent } from '../../lib/share';
import { deletePost } from '../../lib/supabaseApi';
import { showToast } from '../../stores/toastStore';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import styles from './VideoCard.module.css';

const PROFILE_URL = 'https://pindrapp.onrender.com/profile';

interface VideoCardProps {
  post: FeedPost;
  /** True when this is the card the user is currently looking at. */
  isActive: boolean;
}

export function VideoCard({ post, isActive }: VideoCardProps) {
  const navigate = useNavigate();
  const likePost = useFeedStore((s) => s.likePost);
  const hypePost = useFeedStore((s) => s.hypePost);
  const pinPost = useFeedStore((s) => s.pinPost);
  const followFromPost = useFeedStore((s) => s.followFromPost);
  const removePost = useFeedStore((s) => s.removePost);
  const isMuted = useFeedStore((s) => s.isMuted);
  const toggleMute = useFeedStore((s) => s.toggleMute);
  const authBusiness = useAuthStore((s) => s.business);
  const isMine = !!authBusiness && authBusiness.id === post.businessId;

  const [likeBurst, setLikeBurst] = useState(0);
  const [hypeBurst, setHypeBurst] = useState(0);
  const [doubleTapHeart, setDoubleTapHeart] = useState<{ x: number; y: number; key: number } | null>(null);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const lastTapRef = useRef(0);

  // Reset caption expansion when the card scrolls out of view.
  useEffect(() => {
    if (!isActive) setCaptionExpanded(false);
  }, [isActive]);

  const handleLike = () => {
    tapHaptic();
    likePost(post.id);
    setLikeBurst((n) => n + 1);
  };

  const handleHype = () => {
    tapHaptic();
    hypePost(post.id);
    setHypeBurst((n) => n + 1);
  };

  const handleSave = () => {
    tapHaptic();
    pinPost(post.id);
  };

  const handleFollow = () => {
    tapHaptic();
    followFromPost(post.id);
  };

  const handleShare = () => {
    tapHaptic();
    void shareContent({
      title: post.businessName,
      text: post.caption,
      url: `${PROFILE_URL}/${post.businessId}`,
    });
  };

  // Double-tap anywhere on the media area: like + show a heart burst at the
  // tap coordinates. onClick fires after both touch and mouse taps, so it
  // works in every environment we care about.
  const handleMediaTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const now = Date.now();
    if (now - lastTapRef.current < 320) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setDoubleTapHeart({ x, y, key: now });
      if (!post.isLiked) likePost(post.id);
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(15);
      }
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  };

  const goToProfile = () => {
    if (post.businessId) navigate(`/profile/${post.businessId}`);
  };

  const handleDelete = async () => {
    if (!authBusiness) return;
    removePost(post.id);
    setConfirmDelete(false);
    setMenuOpen(false);
    try {
      await deletePost(post.id, authBusiness.id);
      showToast('Post deleted');
    } catch {
      useFeedStore.getState().prependPost(post);
      showToast('Could not delete post. Try again.');
    }
  };

  return (
    <article
      id={`post-${post.id}`}
      data-post-id={post.id}
      className={styles.card}
      style={post.videoUrl ? undefined : { background: post.thumbnailGradient }}
    >
      {/* ── Media layer — full bleed video OR gradient + emoji fallback */}
      <div className={styles.media} onClick={handleMediaTap}>
        {post.videoUrl ? (
          <ReactPlayer
            src={post.videoUrl}
            playing={isActive}
            muted={isMuted}
            loop
            width="100%"
            height="100%"
            playsInline
            style={{ position: 'absolute', inset: 0, objectFit: 'cover' }}
          />
        ) : (
          <div className={styles.fallback}>
            <span className={styles.fallbackEmoji}>{post.businessEmoji}</span>
          </div>
        )}
        <div className={styles.scrim} aria-hidden />
        <AnimatePresence>
          {doubleTapHeart && (
            <motion.div
              key={doubleTapHeart.key}
              className={styles.doubleTapHeart}
              style={{ left: doubleTapHeart.x, top: doubleTapHeart.y }}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: [1, 1, 0], scale: [1.2, 1, 0.9] }}
              transition={{ duration: 0.8 }}
              onAnimationComplete={() => setDoubleTapHeart(null)}
            >
              <Heart size={80} fill="#fff" stroke="#fff" strokeWidth={1.5} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Top bar — business pill on the left, distance + mute + owner menu on the right */}
      <div className={styles.topBar}>
        <button
          type="button"
          className={styles.bizPill}
          onClick={goToProfile}
          aria-label={`Open ${post.businessName} profile`}
        >
          <div className={styles.bizPillAvatar}>{post.businessEmoji}</div>
          <div className={styles.bizPillCopy}>
            <div className={styles.bizPillName}>{post.businessName}</div>
            <div className={styles.bizPillCat}>{post.businessCategory}</div>
          </div>
        </button>
        <div className={styles.topRight}>
          {Number.isFinite(post.distanceMiles) && (
            <div className={styles.distance}>
              <MapPin size={11} /> {post.distanceMiles.toFixed(1)}mi
            </div>
          )}
          <button
            type="button"
            className={styles.muteBtn}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
            onClick={() => {
              tapHaptic();
              toggleMute();
            }}
          >
            {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
          {isMine && (
            <div className={styles.menuWrap}>
              <button
                type="button"
                className={styles.muteBtn}
                aria-label="Post options"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((m) => !m);
                }}
                onBlur={() => window.setTimeout(() => setMenuOpen(false), 120)}
              >
                <MoreHorizontal size={15} />
              </button>
              {menuOpen && (
                <div className={styles.menu}>
                  <button
                    type="button"
                    className={styles.menuItemDanger}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setMenuOpen(false);
                      setConfirmDelete(true);
                    }}
                  >
                    <Trash2 size={13} /> Delete Post
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Right action stack: avatar / heart / save / share */}
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.actionAvatar}
          onClick={goToProfile}
          aria-label="Business profile"
        >
          {post.businessEmoji}
        </button>
        <button
          type="button"
          className={styles.actionBtn}
          onClick={handleLike}
          aria-label={post.isLiked ? 'Unlike' : 'Like'}
        >
          <motion.span
            key={likeBurst}
            animate={{ scale: [1, 1.35, 1] }}
            transition={{ duration: 0.28 }}
            className={styles.actionIcon}
          >
            <Heart
              size={30}
              fill={post.isLiked ? '#FF3A3A' : 'transparent'}
              stroke={post.isLiked ? '#FF3A3A' : '#fff'}
              strokeWidth={1.6}
            />
          </motion.span>
          <span className={styles.actionLabel}>{post.likeCount}</span>
        </button>
        <button
          type="button"
          className={styles.actionBtn}
          onClick={handleHype}
          aria-label={post.isHyped ? 'Unhype' : 'Hype'}
        >
          <motion.span
            key={hypeBurst}
            animate={{ scale: [1, 1.35, 1] }}
            transition={{ duration: 0.28 }}
            className={styles.actionIcon}
          >
            <Megaphone
              size={30}
              fill={post.isHyped ? '#FF5C1A' : 'transparent'}
              stroke={post.isHyped ? '#FF5C1A' : '#fff'}
              strokeWidth={1.6}
            />
          </motion.span>
          <span className={styles.actionLabel}>
            {post.hypeCount > 0 ? post.hypeCount : 'Hype'}
          </span>
        </button>
        <button
          type="button"
          className={styles.actionBtn}
          onClick={handleSave}
          aria-label={post.isPinned ? 'Remove from your map' : 'Save to map'}
        >
          <MapPin
            size={30}
            fill={post.isPinned ? '#1A3AFF' : 'transparent'}
            stroke={post.isPinned ? '#1A3AFF' : '#fff'}
            strokeWidth={1.6}
          />
          <span className={styles.actionLabel}>{post.isPinned ? 'Saved' : 'Save'}</span>
        </button>
        <button
          type="button"
          className={styles.actionBtn}
          onClick={handleFollow}
          aria-label={post.isFollowing ? 'Unfollow' : `Follow ${post.businessName}`}
        >
          {post.isFollowing ? (
            <UserCheck size={30} stroke="#00D97E" strokeWidth={1.8} />
          ) : (
            <UserPlus size={30} stroke="#fff" strokeWidth={1.6} />
          )}
          <span className={styles.actionLabel}>{post.isFollowing ? 'Following' : 'Follow'}</span>
        </button>
        <button
          type="button"
          className={styles.actionBtn}
          onClick={handleShare}
          aria-label="Share"
        >
          <Share2 size={28} stroke="#fff" strokeWidth={1.7} />
          <span className={styles.actionLabel}>Share</span>
        </button>
      </div>

      {/* ── Bottom info overlay */}
      <div className={styles.bottom}>
        <div className={styles.bottomName}>{post.businessName}</div>
        <div className={styles.bottomCat}>{post.businessCategory.toUpperCase()}</div>
        <p
          className={`${styles.caption} ${captionExpanded ? styles.captionExpanded : ''}`}
          onClick={() => setCaptionExpanded((v) => !v)}
        >
          {post.caption}
          {!captionExpanded && post.caption.length > 90 && (
            <span className={styles.more}> …more</span>
          )}
        </p>
        {/* Active-deal pill — only present when the FeedPost type gets a deal
            attached. The current schema gates that out of the feed, so this
            stays dormant for the day a deal_id ever lands on FeedPost. */}
      </div>

      {/* ── Visible-to-touch swipe-down affordance (purely cosmetic) */}
      <div className={styles.swipeHint} aria-hidden>
        <ChevronDown size={20} />
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this post?"
        body="This will permanently remove your update from the feed and your profile."
        confirmLabel="Delete"
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDelete(false)}
      />
    </article>
  );
}
