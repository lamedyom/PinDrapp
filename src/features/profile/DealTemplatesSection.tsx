import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useUserStore } from '../../stores/userStore';
import { Button } from '../../components/ui/Button';
import styles from './DealTemplatesSection.module.css';

export function DealTemplatesSection() {
  const navigate = useNavigate();
  const templates = useUserStore((s) => s.profile.dealTemplates);

  return (
    <section className={styles.section}>
      <header className={styles.head}>
        <h3 className={styles.title}>Flash Deal Templates</h3>
        <button type="button" className={styles.newBtn}>
          <Plus size={12} /> New Template
        </button>
      </header>

      <div className={styles.list}>
        {templates.map((t) => (
          <div key={t.id} className={styles.card}>
            <div className={styles.emoji}>{t.emoji}</div>
            <div className={styles.copy}>
              <div className={styles.name}>{t.name}</div>
              <div className={styles.headline}>{t.headline}</div>
              <div className={styles.discount}>
                {t.discountType === 'fixed'
                  ? `$${t.discountValue} off`
                  : `${t.discountValue}% off`}{' '}
                · {t.defaultDuration}hr
              </div>
            </div>
            <Button
              size="sm"
              variant="deal"
              onClick={() =>
                navigate('/post', {
                  state: {
                    templateId: t.id,
                    headline: t.headline,
                    discountType: t.discountType,
                    discountValue: t.discountValue,
                    defaultDuration: t.defaultDuration,
                    emoji: t.emoji,
                  },
                })
              }
            >
              Launch Deal
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
