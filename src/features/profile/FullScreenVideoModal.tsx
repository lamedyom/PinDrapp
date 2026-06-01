import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Heart, Share2, X } from 'lucide-react';
import ReactPlayer from 'react-player';
import type { FeedPost } from '../../stores/feedStore';
import { useFeedStore } from '../../stores/feedStore';
import { shareContent } from '../../lib/share';
import styles from './FullScreenVideoModal.module.css';

interface Props {
  post: FeedPost | null;
  onClose: () => void;
}

const PROFILE_URL = 'https://pindrapp.onrender.com/profile';

export function FullScreenVideoModal({ post, onClose }: Props) {
  // Lock body scroll while open and close on Escape.
  useEffect(() => {
    if (!post) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [post, onClose]);

  const likePost = useFeedStore((s) => s.likePost);
  // Re-read the live post from the store so like state stays in sync with the
  // feed card behind us.
  const live = useFeedStore((s) =>
    post ? (s.posts.find((p) => p.id === post.id) ?? post) : null,
  );

  return createPortal(
    <AnimatePresence>
      {post && live && (
        <motion.div
          className={styles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className={styles.topBar}>
            <span className={styles.bizName}>{live.businessName}</span>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={onClose}
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          <div className={styles.player}>
            {live.videoUrl ? (
              <ReactPlayer
                src={live.videoUrl}
                playing
                controls
                loop
                width="100%"
                height="100%"
                playsInline
                style={{ position: 'absolute', inset: 0 }}
              />
            ) : (
              <span className={styles.emoji}>{live.businessEmoji}</span>
            )}
          </div>

          <div className={styles.bottom}>
            <p className={styles.caption}>{live.caption}</p>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => likePost(live.id)}
                aria-label={live.isLiked ? 'Unlike' : 'Like'}
              >
                <Heart
                  size={20}
                  fill={live.isLiked ? '#FF3A3A' : 'transparent'}
                  stroke={live.isLiked ? '#FF3A3A' : '#fff'}
                  strokeWidth={1.8}
                />
                <span>{live.likeCount}</span>
              </button>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() =>
                  shareContent({
                    title: live.businessName,
                    text: live.caption,
                    url: `${PROFILE_URL}/${live.businessId}`,
                  })
                }
                aria-label="Share"
              >
                <Share2 size={20} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
