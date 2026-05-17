import { useRef, useState } from 'react';
import { motion, type PanInfo } from 'framer-motion';
import { Pencil, Trash2 } from 'lucide-react';
import type { MenuItem } from '../../stores/userStore';
import { ToggleSwitch } from './ToggleSwitch';
import styles from './MenuItemRow.module.css';

interface Props {
  item: MenuItem;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const REVEAL = 120;

export function MenuItemRow({ item, onToggle, onEdit, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const startX = useRef(0);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    void _;
    void startX;
    if (info.offset.x < -60) setOpen(true);
    else if (info.offset.x > 30) setOpen(false);
  };

  return (
    <div className={styles.host}>
      <div className={styles.actions}>
        <button type="button" className={styles.editBtn} onClick={onEdit} aria-label="Edit">
          <Pencil size={16} />
        </button>
        <button type="button" className={styles.deleteBtn} onClick={onDelete} aria-label="Delete">
          <Trash2 size={16} />
        </button>
      </div>
      <motion.div
        className={styles.row}
        drag="x"
        dragConstraints={{ left: -REVEAL, right: 0 }}
        dragElastic={0.1}
        animate={{ x: open ? -REVEAL : 0 }}
        onDragEnd={handleDragEnd}
      >
        <div className={styles.emoji}>{item.emoji}</div>
        <div className={styles.copy}>
          <div className={styles.name}>{item.name}</div>
          <div className={styles.desc}>{item.description}</div>
        </div>
        <div className={styles.right}>
          <div className={styles.price}>${item.price}</div>
          <ToggleSwitch
            on={item.isAvailable}
            onChange={onToggle}
            ariaLabel={`${item.name} availability`}
          />
        </div>
      </motion.div>
    </div>
  );
}
