import { useEffect, useRef, useState } from 'react';
import { Heart, MapPin, MessageCircle, MoreHorizontal, Pin, Share2, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
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
}

export function VideoCard({ post }: VideoCardProps) {
  const likePost = useFeedStore((s) => s.likePost);
  const pinPost = useFeedStore((s) => s.pinPost);
  const removePost = useFeedStore((s) => s.removePost);
  const authBusiness = useAuthStore((s) => s.business);
  const isMine = !!authBusiness && authBusiness.id === post.businessId;

  const [visible, setVisible] = useState(false);
  const [flyingPin, setFlyingPin] = useState(false);
  const [likeBurst, setLikeBurst] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
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

  const handleShare = () => {
    tapHaptic();
    void shareContent({
      title: post.businessName,
      text: post.caption,
      url: `${PROFILE_URL}/${post.businessId}`,
    });
  };

  const handleDelete = async () => {
    if (!authBusiness) return;
    // Optimistic: remove immediately; restore on error.
    removePost(post.id);
    setConfirmDelete(false);
    setMenuOpen(false);
    try {
      await deletePost(post.id, authBusiness.id);
      showToast('Post deleted');
    } catch {
      // Best-effort revert — re-add at the original position is hard once
      // gone, so just re-insert at the top with the data we still hold.
      useFeedStore.getState().prependPost(post);
      showToast('Could not delete post. Try again.');
    }
  };

  return (
    <div
      ref={cardRef}
      id={`post-${post.id}`}
      className={styles.card}
      style={{ background: post.thumbnailGradient }}
    >
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
        <div className={styles.topRight}>
          <div className={styles.distance}>
            <MapPin size={11} /> {post.distanceMiles.toFixed(1)} mi
          </div>
          {isMine && (
            <div className={styles.menuWrap}>
              <button
                type="button"
                className={styles.menuBtn}
                aria-label="Post options"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((m) => !m);
                }}
                onBlur={() => window.setTimeout(() => setMenuOpen(false), 120)}
              >
                <MoreHorizontal size={14} />
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

          <span className={styles.commentBtn} aria-label="Comments (coming soon)">
            <MessageCircle size={17} strokeWidth={1.8} />
            <span className={styles.likeCount}>{post.commentCount ?? 0}</span>
          </span>

          <button
            type="button"
            className={styles.commentBtn}
            onClick={handleShare}
            aria-label={`Share ${post.businessName}`}
          >
            <Share2 size={17} strokeWidth={1.8} />
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

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this post?"
        body="This will permanently remove your update from the feed and your profile."
        confirmLabel="Delete"
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
