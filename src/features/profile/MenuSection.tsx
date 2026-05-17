import { useEffect, useMemo, useState } from 'react';
import { Plus, Upload } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { useUserStore, type MenuItem } from '../../stores/userStore';
import { showToast } from '../../stores/toastStore';
import { MenuItemRow } from './MenuItemRow';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import styles from './MenuSection.module.css';

export function MenuSection() {
  const items = useUserStore((s) => s.profile.menuItems);
  const toggleAvail = useUserStore((s) => s.toggleMenuItemAvailability);
  const updateItem = useUserStore((s) => s.updateMenuItem);
  const addItem = useUserStore((s) => s.addMenuItem);
  const deleteItem = useUserStore((s) => s.deleteMenuItem);

  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<MenuItem | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    items.forEach((item) => {
      const arr = map.get(item.category) ?? [];
      arr.push(item);
      map.set(item.category, arr);
    });
    return Array.from(map.entries());
  }, [items]);

  return (
    <section className={styles.section}>
      <header className={styles.head}>
        <h3 className={styles.title}>Menu & Prices</h3>
        <div className={styles.headActions}>
          <button
            type="button"
            className={styles.addBtn}
            onClick={() => setAddOpen(true)}
          >
            <Plus size={12} /> Add Item
          </button>
          <button
            type="button"
            className={styles.importBtn}
            onClick={() => setImportOpen(true)}
          >
            <Upload size={12} /> Import
          </button>
        </div>
      </header>

      {grouped.map(([category, list]) => (
        <div key={category}>
          <div className={styles.catLabel}>{category}</div>
          <div className={styles.list}>
            {list.map((item) => (
              <MenuItemRow
                key={item.id}
                item={item}
                onToggle={() => toggleAvail(item.id)}
                onEdit={() => setEditing(item)}
                onDelete={() => setConfirmDelete(item)}
              />
            ))}
          </div>
        </div>
      ))}

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />
      <ItemForm
        open={addOpen || !!editing}
        item={editing}
        onClose={() => {
          setAddOpen(false);
          setEditing(null);
        }}
        onSave={(item) => {
          if (editing) {
            updateItem(editing.id, item);
            showToast('Menu item updated ✓');
          } else {
            addItem({ ...item, id: `m_${Date.now()}` });
            showToast('Menu item added ✓');
          }
          setAddOpen(false);
          setEditing(null);
        }}
      />

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)}>
        <div className={styles.confirm}>
          <h4>Delete this item?</h4>
          <p>{confirmDelete?.name} — this can't be undone.</p>
          <div className={styles.confirmActions}>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (confirmDelete) {
                  deleteItem(confirmDelete.id);
                  showToast('Item removed');
                }
                setConfirmDelete(null);
              }}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}

function ImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { getRootProps, getInputProps } = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    onDrop: () => {
      showToast('PDF received — processing menu');
      onClose();
    },
  });
  const [url, setUrl] = useState('');

  return (
    <Modal open={open} onClose={onClose} label="Import menu">
      <div className={styles.importSheet}>
        <h3>Import menu</h3>

        <div {...getRootProps({ className: styles.importRow })}>
          <input {...getInputProps()} />
          <span className={styles.importEmoji}>📄</span>
          <div>
            <div className={styles.importTitle}>Upload PDF menu</div>
            <div className={styles.importSub}>We extract dishes and prices</div>
          </div>
        </div>

        <div className={styles.importRow}>
          <span className={styles.importEmoji}>🔗</span>
          <div className={styles.importColumn}>
            <div className={styles.importTitle}>Import from URL</div>
            <input
              type="url"
              className={styles.importInput}
              placeholder="Paste your menu link"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
        </div>

        <button
          type="button"
          className={styles.importRow}
          onClick={() => {
            onClose();
            showToast('Add items manually below');
          }}
        >
          <span className={styles.importEmoji}>✍️</span>
          <div>
            <div className={styles.importTitle}>Build manually</div>
            <div className={styles.importSub}>Add items one at a time</div>
          </div>
        </button>
      </div>
    </Modal>
  );
}

function ItemForm({
  open,
  item,
  onClose,
  onSave,
}: {
  open: boolean;
  item: MenuItem | null;
  onClose: () => void;
  onSave: (item: MenuItem) => void;
}) {
  const [form, setForm] = useState<MenuItem>(
    item ?? {
      id: '',
      name: '',
      description: '',
      price: 0,
      category: 'Mains',
      emoji: '🍽️',
      isAvailable: true,
    },
  );

  useEffect(() => {
    if (open) {
      setForm(
        item ?? {
          id: '',
          name: '',
          description: '',
          price: 0,
          category: 'Mains',
          emoji: '🍽️',
          isAvailable: true,
        },
      );
    }
  }, [item, open]);

  return (
    <Modal open={open} onClose={onClose} label="Menu item">
      <div className={styles.importSheet}>
        <h3>{item ? 'Edit item' : 'Add menu item'}</h3>
        <label className={styles.formLabel}>
          Name
          <input
            className={styles.formInput}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <label className={styles.formLabel}>
          Description
          <input
            className={styles.formInput}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </label>
        <div className={styles.formRow}>
          <label className={styles.formLabel}>
            Price
            <input
              className={styles.formInput}
              type="number"
              value={form.price || ''}
              onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
            />
          </label>
          <label className={styles.formLabel}>
            Category
            <input
              className={styles.formInput}
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
          </label>
        </div>
        <label className={styles.formLabel}>
          Emoji
          <input
            className={styles.formInput}
            value={form.emoji}
            maxLength={4}
            onChange={(e) => setForm({ ...form, emoji: e.target.value })}
          />
        </label>
        <div className={styles.confirmActions}>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!form.name || !form.price}
            onClick={() => onSave(form)}
          >
            {item ? 'Save changes' : 'Add item'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

