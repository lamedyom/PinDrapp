import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, LogOut, MapPin, X } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import type { SavedPlace } from '../../stores/mapStore';
import { useMapStore } from '../../stores/mapStore';
import { isSupabaseConfigured } from '../../lib/supabase';
import {
  fetchFollowing,
  fetchSavedPlaces,
  fetchUserClaimedDeals,
  unsavePlaceFor,
  uploadImage,
  type ClaimedDealRecord,
  type FollowedBusiness,
} from '../../lib/supabaseApi';
import { showToast } from '../../stores/toastStore';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Modal } from '../../components/ui/Modal';
import { tapHaptic } from '../../lib/haptics';
import styles from './ConsumerProfileScreen.module.css';

export function ConsumerProfileScreen() {
  const navigate = useNavigate();
  const profile = useAuthStore((s) => s.profile);
  const authUser = useAuthStore((s) => s.authUser);

  const [saved, setSaved] = useState<SavedPlace[]>([]);
  const [following, setFollowing] = useState<FollowedBusiness[]>([]);
  const [claimed, setClaimed] = useState<ClaimedDealRecord[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmUnpin, setConfirmUnpin] = useState<SavedPlace | null>(null);

  const name = profile?.name?.trim() || 'Your Profile';
  const avatarUrl = profile?.avatarUrl ?? null;
  const bio = profile?.bio ?? '';

  const memberSince = useMemo(() => {
    const iso = authUser?.created_at;
    const d = iso ? new Date(iso) : new Date();
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [authUser?.created_at]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!profile) {
        setSaved([]);
        setFollowing([]);
        setClaimed([]);
        return;
      }
      // Real Supabase reads only — no mock fallback. Empty results show empty states.
      const [savedRes, followRes, claimedRes] = await Promise.all([
        fetchSavedPlaces(profile.id),
        fetchFollowing(profile.id),
        fetchUserClaimedDeals(profile.id),
      ]);
      if (cancelled) return;
      setSaved(savedRes.filter((p) => p.businessId));
      setFollowing(followRes);
      setClaimed(claimedRes);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  const goToBusiness = (businessId?: string) => {
    if (businessId) navigate(`/profile/${businessId}`);
  };

  const handleUnpin = async () => {
    if (!confirmUnpin || !profile?.id) return;
    const place = confirmUnpin;
    setConfirmUnpin(null);
    // Optimistic local removal — restore on failure.
    setSaved((s) => s.filter((p) => p.id !== place.id));
    useMapStore.getState().removeSavedPlace(place.id);
    showToast('Removed from your map');
    if (place.businessId) {
      try {
        await unsavePlaceFor(profile.id, place.businessId);
      } catch {
        setSaved((s) => [place, ...s]);
        useMapStore.getState().addSavedPlace(place);
        showToast('Could not remove. Try again.');
      }
    }
  };

  return (
    <div className={styles.screen}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.avatar}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className={styles.avatarImg} loading="lazy" />
          ) : (
            <span className={styles.initials}>{initialsOf(name)}</span>
          )}
        </div>
        <div className={styles.identity}>
          <h1 className={styles.name}>{name}</h1>
          <div className={styles.memberSince}>Member since {memberSince}</div>
          {bio && <p className={styles.bio}>{bio}</p>}
        </div>
      </div>

      <div className={styles.headerActions}>
        <Button size="md" variant="outline" onClick={() => setEditOpen(true)}>
          Edit Profile
        </Button>
        {isSupabaseConfigured() && (
          <Button
            size="md"
            variant="ghost"
            leftIcon={<LogOut size={14} />}
            onClick={() => useAuthStore.getState().signOut()}
          >
            Sign Out
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className={styles.stats}>
        <Stat label="Saved Places" value={saved.length} />
        <Stat label="Following" value={following.length} />
        <Stat label="Deals Claimed" value={claimed.length} />
      </div>

      {/* Saved places */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>📍 My Map</h2>
        {saved.length === 0 ? (
          <EmptyCard
            message="Businesses you save will appear here"
            action={
              <Button size="sm" variant="primary" onClick={() => navigate('/map')}>
                Explore businesses
              </Button>
            }
          />
        ) : (
          <div className={`${styles.savedRow} no-scrollbar`}>
            {saved.map((p) => (
              <div key={p.id} className={styles.savedCard}>
                {p.type !== 'home' && p.type !== 'work' && (
                  <button
                    type="button"
                    className={styles.savedUnpin}
                    aria-label={`Remove ${p.name} from your map`}
                    onClick={(e) => {
                      e.stopPropagation();
                      tapHaptic();
                      setConfirmUnpin(p);
                    }}
                  >
                    <X size={12} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => goToBusiness(p.businessId)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    width: '100%',
                    padding: 0,
                    textAlign: 'left',
                  }}
                >
                  <div className={styles.savedEmoji}>{p.emoji}</div>
                  <div className={styles.savedName}>{p.name}</div>
                  <div className={styles.savedCat}>{p.category ?? ''}</div>
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Following */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Following</h2>
        {following.length === 0 ? (
          <EmptyCard message="Follow businesses to see their updates first" />
        ) : (
          <div className={styles.followGrid}>
            {following.map((b) => (
              <button
                key={b.businessId}
                type="button"
                className={styles.followItem}
                onClick={() => goToBusiness(b.businessId)}
              >
                <div className={`${styles.followAvatar} ${b.isPro ? styles.followAvatarPro : ''}`}>
                  {b.avatarUrl ? (
                    <img src={b.avatarUrl} alt="" className={styles.followAvatarImg} loading="lazy" />
                  ) : (
                    <span>{b.emoji}</span>
                  )}
                </div>
                <div className={styles.followName}>{b.name}</div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Deal history */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Deal History</h2>
        {claimed.length === 0 ? (
          <EmptyCard message="Deals you claim will appear here" />
        ) : (
          <div className={styles.claimList}>
            {claimed.map((d) => (
              <div key={d.id} className={styles.claimRow}>
                <div className={styles.claimInfo}>
                  <div className={styles.claimHeadline}>{d.headline}</div>
                  <div className={styles.claimMeta}>
                    {d.businessName} ·{' '}
                    {d.claimedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
                {d.amountPaid > 0 && (
                  <div className={styles.claimSaved}>${d.amountPaid.toFixed(2)}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <ConsumerEditModal open={editOpen} onClose={() => setEditOpen(false)} />

      <ConfirmDialog
        open={!!confirmUnpin}
        title={`Remove ${confirmUnpin?.name ?? ''} from your map?`}
        body="You can save it again any time from the feed or a profile."
        confirmLabel="Remove"
        onConfirm={() => void handleUnpin()}
        onCancel={() => setConfirmUnpin(null)}
      />
    </div>
  );
}

function ConsumerEditModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const profile = useAuthStore((s) => s.profile);
  const updateConsumerProfile = useAuthStore((s) => s.updateConsumerProfile);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(profile?.name ?? '');
      setBio(profile?.bio ?? '');
      setPhoto(profile?.avatarUrl ?? null);
    }
  }, [open, profile]);

  const pickPhoto = () => {
    if (typeof document === 'undefined') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setPhoto(URL.createObjectURL(file));
      try {
        const url = await uploadImage(file);
        if (url) setPhoto(url);
      } catch {
        /* keep local preview */
      }
    };
    input.click();
  };

  const save = async () => {
    setSaving(true);
    await updateConsumerProfile({ name: name.trim(), bio: bio.trim(), avatarUrl: photo });
    setSaving(false);
    showToast('Profile updated ✓');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} label="Edit profile">
      <div className={styles.editSheet}>
        <h3 className={styles.editTitle}>Edit profile</h3>
        <button type="button" className={styles.editPhoto} onClick={pickPhoto}>
          {photo ? (
            <img src={photo} alt="" className={styles.editPhotoImg} loading="lazy" />
          ) : (
            <span className={styles.editPhotoEmpty}>
              <Camera size={20} /> Add photo
            </span>
          )}
        </button>
        <label className={styles.editLabel}>
          Display name
          <input
            className={styles.editInput}
            value={name}
            maxLength={50}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className={styles.editLabel}>
          Bio <span className={styles.optional}>(optional)</span>
          <textarea
            className={styles.editTextarea}
            value={bio}
            maxLength={100}
            placeholder="Tell the community a little about you"
            onChange={(e) => setBio(e.target.value)}
          />
          <span className={styles.counter}>{bio.length}/100</span>
        </label>
        <div className={styles.editActions}>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={saving || name.trim().length < 2} onClick={save}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.stat}>
      <div className={styles.statValue}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  );
}

function EmptyCard({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div className={styles.emptyCard}>
      <MapPin size={20} className={styles.emptyIcon} />
      <p className={styles.emptyMsg}>{message}</p>
      {action}
    </div>
  );
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
