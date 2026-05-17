import styles from './DealTemplates.module.css';

export type TemplateKey = 'flashDeal' | 'todaysSpecial' | 'newArrival';

interface DealTemplatesProps {
  onPick: (tpl: TemplateKey) => void;
}

const TEMPLATES: {
  key: TemplateKey;
  emoji: string;
  title: string;
  sub: string;
  accent: 'orange' | 'blue' | 'green';
}[] = [
  { key: 'flashDeal', emoji: '⚡', title: 'Flash Deal', sub: 'Timed offer with checkout', accent: 'orange' },
  { key: 'todaysSpecial', emoji: '🍽️', title: "Today's Special", sub: "Show what's on right now", accent: 'blue' },
  { key: 'newArrival', emoji: '📦', title: 'New Arrival', sub: 'New stock or product drop', accent: 'green' },
];

export function DealTemplates({ onPick }: DealTemplatesProps) {
  return (
    <section className={styles.section}>
      <div className={styles.label}>Start with a template</div>
      <div className={`${styles.row} no-scrollbar`}>
        {TEMPLATES.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`${styles.card} ${styles[t.accent]}`}
            onClick={() => onPick(t.key)}
          >
            <span className={styles.emoji}>{t.emoji}</span>
            <div className={styles.title}>{t.title}</div>
            <div className={styles.sub}>{t.sub}</div>
          </button>
        ))}
      </div>
    </section>
  );
}
