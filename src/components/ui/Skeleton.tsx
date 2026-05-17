import styles from './Skeleton.module.css';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  className?: string;
}

export function Skeleton({ width = '100%', height = 14, radius = 8, className }: SkeletonProps) {
  return (
    <div
      className={[styles.box, className ?? ''].filter(Boolean).join(' ')}
      style={{ width, height, borderRadius: radius }}
    />
  );
}
