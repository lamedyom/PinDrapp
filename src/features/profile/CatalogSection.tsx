import { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2, UtensilsCrossed } from 'lucide-react';
import { useCatalogStore, type CatalogItem } from '../../stores/catalogStore';
import { useAuthStore } from '../../stores/authStore';
import { showToast } from '../../stores/toastStore';
import { saveCatalogItem, deleteCatalogItem } from '../../lib/supabaseApi';
import { ToggleSwitch } from './ToggleSwitch';
import { EmptyState } from '../../components/ui/EmptyState';
import { CatalogItemForm } from './CatalogItemForm';
import styles from './CatalogSection.module.css';

interface CatalogSectionProps {
  isOwner: boolean;
}

const EMPTY_ITEMS: CatalogItem[] = [];

export function CatalogSection({ isOwner }: CatalogSectionProps) {
  const items = useCatalogStore((s) => s.items) ?? EMPTY_ITEMS;
  const upsertItem = useCatalogStore((s) => s.upsertItem);
  const removeItem = useCatalogStore((s) => s.removeItem);
  const toggleAvailability = useCatalogStore((s) => s.toggleAvailability);
  const businessId = useAuthStore((s) => s.business?.id);

  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [adding, setAdding] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<string, CatalogItem[]>();
    for (const item of items) {
      const arr = map.get(item.category) ?? [];
      arr.push(item);
      map.set(item.category, arr);
    }
    return Array.from(map.entries());
  }, [items]);

  const handleSave = async (draft: CatalogItem) => {
    const item: CatalogItem = {
      ...draft,
      id: draft.id || `cat_${Date.now()}`,
    };
    upsertItem(item);
    showToast(draft.id ? 'Item updated ✓' : 'Item added ✓');
    setEditing(null);
    setAdding(false);
    if (businessId) {
      try {
        const saved = await saveCatalogItem({
          id: draft.id || undefined,
          businessId,
          name: item.name,
          description: item.description,
          category: item.category,
          photoUrl: item.photoUrl,
          regularPrice: item.regularPrice,
          salePrice: item.salePrice,
          tags: item.tags,
          isAvailable: item.isAvailable,
          sortOrder: item.sortOrder,
        });
        if (saved) upsertItem(saved);
      } catch {
        /* keep optimistic copy */
      }
    }
  };

  const handleDelete = (item: CatalogItem) => {
    removeItem(item.id);
    showToast('Item removed');
    void deleteCatalogItem(item.id).catch(() => {});
  };

  return (
    <section className={styles.section}>
      <header className={styles.head}>
        <h3 className={styles.title}>Catalog</h3>
        {isOwner && (
          <button type="button" className={styles.addBtn} onClick={() => setAdding(true)}>
            <Plus size={12} /> Edit Catalog
          </button>
        )}
      </header>

      {items.length === 0 ? (
        <EmptyState
          icon={<UtensilsCrossed size={32} />}
          message={
            isOwner
              ? 'Add your products or menu items so customers can browse them.'
              : 'No catalog items yet.'
          }
        />
      ) : (
        grouped.map(([category, list]) => (
          <div key={category} className={styles.group}>
            <div className={styles.catLabel}>{category}</div>
            <div className={styles.list}>
              {list.map((item) => (
                <div
                  key={item.id}
                  className={`${styles.row} ${!item.isAvailable ? styles.unavailable : ''}`}
                >
                  <div className={styles.thumb}>
                    {item.photoUrl ? (
                      <img src={item.photoUrl} alt="" className={styles.thumbImg} />
                    ) : (
                      <span className={styles.thumbPlaceholder}>🍽️</span>
                    )}
                  </div>
                  <div className={styles.info}>
                    <div className={styles.nameRow}>
                      <span className={styles.name}>{item.name}</span>
                      {!item.isAvailable && (
                        <span className={styles.soldOut}>Unavailable</span>
                      )}
                    </div>
                    {item.description && (
                      <p className={styles.desc}>{item.description}</p>
                    )}
                    {item.tags.length > 0 && (
                      <div className={styles.tagRow}>
                        {item.tags.map((t) => (
                          <span key={t} className={styles.tag}>
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className={styles.priceCol}>
                    {item.salePrice != null && item.regularPrice != null ? (
                      <>
                        <span className={styles.salePrice}>${item.salePrice}</span>
                        <span className={styles.regStrike}>${item.regularPrice}</span>
                      </>
                    ) : item.regularPrice != null ? (
                      <span className={styles.salePrice}>${item.regularPrice}</span>
                    ) : null}
                    {isOwner && (
                      <div className={styles.ownerActions}>
                        <ToggleSwitch
                          on={item.isAvailable}
                          onChange={() => toggleAvailability(item.id)}
                          ariaLabel="Toggle availability"
                        />
                        <button
                          type="button"
                          className={styles.iconBtn}
                          aria-label="Edit item"
                          onClick={() => setEditing(item)}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          className={styles.iconBtn}
                          aria-label="Delete item"
                          onClick={() => handleDelete(item)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      <CatalogItemForm
        open={adding || !!editing}
        item={editing}
        onClose={() => {
          setAdding(false);
          setEditing(null);
        }}
        onSave={handleSave}
      />
    </section>
  );
}
