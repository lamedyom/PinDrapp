import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import styles from './BottomSheet.module.css';

interface Snap {
  collapsed: number;
  default: number;
  expanded: number;
}

interface BottomSheetProps {
  snap: Snap;
  initial?: keyof Snap;
  children: ReactNode;
}

export function BottomSheet({ snap, initial = 'default', children }: BottomSheetProps) {
  const [vh, setVh] = useState<number>(() =>
    typeof window === 'undefined' ? 800 : window.innerHeight,
  );

  useEffect(() => {
    const onResize = () => setVh(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const heights = {
    collapsed: Math.round(vh * (snap.collapsed > 1 ? snap.collapsed / vh : snap.collapsed)),
    default: Math.round(vh * (snap.default > 1 ? snap.default / vh : snap.default)),
    expanded: Math.round(vh * (snap.expanded > 1 ? snap.expanded / vh : snap.expanded)),
  };

  const initialHeight = heights[initial];
  const expandedHeight = heights.expanded;

  const y = useMotionValue(expandedHeight - initialHeight);
  const dragRef = useRef<HTMLDivElement>(null);

  const snapPoints = [
    expandedHeight - heights.collapsed,
    expandedHeight - heights.default,
    0,
  ];

  const handleDragEnd = (
    _: MouseEvent | TouchEvent | PointerEvent,
    info: { velocity: { y: number } },
  ) => {
    void _;
    const current = y.get();
    const velocity = info.velocity.y;
    let target = current;
    if (Math.abs(velocity) > 500) {
      target = velocity > 0 ? snapPoints[0] : snapPoints[2];
    } else {
      target = snapPoints.reduce((prev, p) =>
        Math.abs(p - current) < Math.abs(prev - current) ? p : prev,
      );
    }
    y.set(target);
  };

  const bgOpacity = useTransform(y, [0, expandedHeight - heights.collapsed], [0.9, 0.6]);

  return (
    <motion.div
      ref={dragRef}
      className={styles.sheet}
      style={{
        height: expandedHeight,
        y,
        background: bgOpacity.get() ? 'rgba(10,10,15,0.92)' : undefined,
      }}
      drag="y"
      dragConstraints={{ top: 0, bottom: expandedHeight - heights.collapsed }}
      dragElastic={0.08}
      dragMomentum={false}
      onDragEnd={handleDragEnd}
    >
      <div className={styles.handle} aria-hidden />
      <div className={styles.content}>{children}</div>
    </motion.div>
  );
}
