import styles from './Avatar.module.css';

interface AvatarProps {
  emoji?: string;
  imageUrl?: string | null;
  size?: number;
  background?: string;
  rounded?: number;
}

export function Avatar({
  emoji,
  imageUrl,
  size = 40,
  background = 'rgba(255, 92, 26, 0.12)',
  rounded,
}: AvatarProps) {
  const borderRadius = rounded ?? Math.max(10, Math.round(size * 0.28));
  return (
    <div
      className={styles.avatar}
      style={{
        width: size,
        height: size,
        background,
        borderRadius,
        fontSize: Math.round(size * 0.55),
      }}
    >
      {imageUrl ? <img src={imageUrl} alt="" loading="lazy" /> : <span>{emoji}</span>}
    </div>
  );
}
