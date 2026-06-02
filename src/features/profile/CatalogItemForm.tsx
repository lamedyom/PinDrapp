import { useEffect, useState } from 'react';
import { Camera } from 'lucide-react';
import { CATALOG_TAGS, type CatalogItem } from '../../stores/catalogStore';
import { uploadImage } from '../../lib/supabaseApi';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { ToggleSwitch } from './ToggleSwitch';
import styles from './CatalogSection.module.css';

export const EMPTY_CATALOG_DRAFT: CatalogItem = {
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

export function CatalogItemForm({
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
  const [form, setForm] = useState<CatalogItem>(item ?? EMPTY_CATALOG_DRAFT);
  const [customTag, setCustomTag] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open) setForm(item ?? EMPTY_CATALOG_DRAFT);
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
            <img src={form.photoUrl} alt="" className={styles.photoPreview} loading="lazy" />
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
                setForm({ ...form, regularPrice: e.target.value ? Number(e.target.value) : null })
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
                setForm({ ...form, salePrice: e.target.value ? Number(e.target.value) : null })
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
            {item ? 'Save changes' : 'Save Item'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
