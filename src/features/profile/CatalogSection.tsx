import { useEffect, useMemo, useState } from 'react';
import { Camera, Pencil, Plus, Trash2, UtensilsCrossed } from 'lucide-react';
import {
  useCatalogStore,
  CATALOG_TAGS,
  type CatalogItem,
} from '../../stores/catalogStore';
import { useAuthStore } from '../../stores/authStore';
import { showToast } from '../../stores/toastStore';
import { saveCatalogItem, deleteCatalogItem, uploadImage } from '../../lib/supabaseApi';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { ToggleSwitch } from './ToggleSwitch';
import { EmptyState } from '../../components/ui/EmptyState';
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

const EMPTY_DRAFT: CatalogItem = {
  id: '',
  name: '',
  description: '',
  category: 'General',
  photoUrl: null,
  regularPrice: null,
  salePrice: null,
  tags: [],
  isAvailable: true,
  sortOrder: 0,
};

function CatalogItemForm({
  open,
  item,
  onClose,
  onSave,
}: {
  open: boolean;
  item: CatalogItem | null;
  onClose: () => void;
  onSave: (item: CatalogItem) => void;
}) {
  const [form, setForm] = useState<CatalogItem>(item ?? EMPTY_DRAFT);
  const [customTag, setCustomTag] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open) setForm(item ?? EMPTY_DRAFT);
  }, [item, open]);

  const toggleTag = (tag: string) => {
    setForm((f) => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter((t) => t !== tag) : [...f.tags, tag],
    }));
  };

  const handlePhoto = () => {
    if (typeof document === 'undefined') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      // Show a local preview immediately; swap for the hosted URL if upload works.
      setForm((f) => ({ ...f, photoUrl: URL.createObjectURL(file) }));
      setUploading(true);
      try {
        const url = await uploadImage(file);
        if (url) setForm((f) => ({ ...f, photoUrl: url }));
      } catch {
        /* keep the local preview */
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  const canSave = form.name.trim().length > 0 && !!form.photoUrl && !uploading;

  return (
    <Modal open={open} onClose={onClose} label="Catalog item">
      <div className={styles.formSheet}>
        <h3 className={styles.formTitle}>{item ? 'Edit item' : 'Add to catalog'}</h3>

        <button type="button" className={styles.photoPicker} onClick={handlePhoto}>
          {form.photoUrl ? (
            <img src={form.photoUrl} alt="" className={styles.photoPreview} />
          ) : (
            <span className={styles.photoEmpty}>
              <Camera size={20} /> Add photo
            </span>
          )}
          {uploading && <span className={styles.photoUploading}>Uploading…</span>}
        </button>

        <label className={styles.formLabel}>
          Name
          <input
            className={styles.formInput}
            value={form.name}
            placeholder="e.g. Margherita Pizza"
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>

        <label className={styles.formLabel}>
          Category
          <input
            className={styles.formInput}
            value={form.category}
            placeholder="e.g. Pizzas"
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          />
        </label>

        <label className={styles.formLabel}>
          Description
          <textarea
            className={styles.formTextarea}
            value={form.description}
            placeholder="Short description"
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </label>

        <div className={styles.formRow}>
          <label className={styles.formLabel}>
            Regular price
            <input
              className={styles.formInput}
              type="number"
              inputMode="decimal"
              min="0"
              value={form.regularPrice ?? ''}
              placeholder="$"
              onChange={(e) =>
                setForm({
                  ...form,
                  regularPrice: e.target.value ? Number(e.target.value) : null,
                })
              }
            />
          </label>
          <label className={styles.formLabel}>
            Sale price <span className={styles.optional}>(optional)</span>
            <input
              className={styles.formInput}
              type="number"
              inputMode="decimal"
              min="0"
              value={form.salePrice ?? ''}
              placeholder="$"
              onChange={(e) =>
                setForm({
                  ...form,
                  salePrice: e.target.value ? Number(e.target.value) : null,
                })
              }
            />
          </label>
        </div>

        <div className={styles.formLabel}>
          Tags
          <div className={styles.tagPicker}>
            {[...CATALOG_TAGS, ...form.tags.filter((t) => !CATALOG_TAGS.includes(t as never))].map(
              (tag) => (
                <button
                  key={tag}
                  type="button"
                  className={`${styles.tagChip} ${form.tags.includes(tag) ? styles.tagChipActive : ''}`}
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </button>
              ),
            )}
          </div>
          <div className={styles.customTagRow}>
            <input
              className={styles.formInput}
              value={customTag}
              placeholder="Add custom tag"
              onChange={(e) => setCustomTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && customTag.trim()) {
                  e.preventDefault();
                  toggleTag(customTag.trim());
                  setCustomTag('');
                }
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (customTag.trim()) {
                  toggleTag(customTag.trim());
                  setCustomTag('');
                }
              }}
            >
              Add
            </Button>
          </div>
        </div>

        <div className={styles.availRow}>
          <span>Available</span>
          <ToggleSwitch
            on={form.isAvailable}
            onChange={() => setForm({ ...form, isAvailable: !form.isAvailable })}
            ariaLabel="Available"
          />
        </div>

        <div className={styles.formActions}>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!canSave} onClick={() => onSave(form)}>
            {item ? 'Save changes' : 'Add item'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
