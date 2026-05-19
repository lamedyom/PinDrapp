import { useMemo, useState } from 'react';
import { Camera, LogOut, MapPin, Share2 } from 'lucide-react';
import { useUserStore } from '../../stores/userStore';
import { useFeedStore } from '../../stores/feedStore';
import { useAuthStore } from '../../stores/authStore';
import { Button } from '../../components/ui/Button';
import { isSupabaseConfigured } from '../../lib/supabase';
import { MenuSection } from './MenuSection';
import { DealTemplatesSection } from './DealTemplatesSection';
import { EditProfileModal } from './EditProfileModal';
import { SavedPlacesSection } from './SavedPlacesSection';
import styles from './ProfileScreen.module.css';

export function ProfileScreen() {
  const profile = useUserStore((s) => s.profile);
  const openEdit = useUserStore((s) => s.openEditModal);
  const updateProfile = useUserStore((s) => s.updateProfile);
  const authBusiness = useAuthStore((s) => s.business);
  const posts = useFeedStore((s) => s.posts);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  // When a Supabase-backed business exists, overlay its data on top of the
  // mock profile so the screen reflects the signed-in business.
  const effective: typeof profile = useMemo(() => {
    if (!authBusiness) return profile;
    return {
      ...profile,
      name: authBusiness.name || profile.name,
      category: authBusiness.category || profile.category,
      bio: authBusiness.bio || profile.bio,
      address: authBusiness.address ?? profile.address,
      website: authBusiness.website ?? profile.website,
      instagram: authBusiness.instagram ?? profile.instagram,
      phone: authBusiness.phone ?? profile.phone,
      imageUrl: authBusiness.avatarUrl ?? effective.imageUrl,
      followerCount: authBusiness.followerCount || profile.followerCount,
    };
  }, [authBusiness, profile]);

  const myPosts = useMemo(() => posts.slice(0, 9), [posts]);

  const handleAvatarPick = async () => {
    if (typeof document === 'undefined') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      updateProfile({ imageUrl: url });
    };
    input.click();
  };

  return (
    <div className={styles.screen}>
      <div className={styles.hero}>
        <div className={styles.heroEmoji}>{effective.coverEmoji}</div>
        <div className={styles.heroFade} />
      </div>

      <div className={styles.avatarRow}>
        <div className={styles.avatarWrap}>
          {effective.imageUrl ? (
            <img src={effective.imageUrl} alt="" className={styles.avatarImg} />
          ) : (
            <span className={styles.avatarEmoji}>{effective.coverEmoji}</span>
          )}
          <button
            type="button"
            className={styles.avatarCamera}
            aria-label="Change profile photo"
            onClick={handleAvatarPick}
          >
            <Camera size={14} />
          </button>
        </div>
      </div>

      <div className={styles.identity}>
        <h1 className={styles.name}>{effective.name}</h1>
        <div className={styles.category}>{effective.category.toUpperCase()}</div>
        <div className={styles.locationRow}>
          <MapPin size={12} /> {effective.address}
        </div>
        <p className={styles.bio}>{effective.bio}</p>
        <div className={styles.actions}>
          <Button size="md" variant="outline" onClick={openEdit}>
            Edit Profile
          </Button>
          <Button size="md" variant="ghost" leftIcon={<Share2 size={14} />}>
            Share Profile
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
      </div>

      <div className={styles.stats}>
        <Stat label="Followers" value={effective.followerCount} />
        <Stat label="Posts" value={profile.postCount} />
        <Stat label="Map Saves" value={profile.mapSaveCount} />
        <Stat label="Deal Claims" value={profile.dealClaimCount} />
      </div>

      <div className={styles.mapCallout}>
        <div className={styles.mapCalloutIcon}>
          <MapPin size={20} />
        </div>
        <div>
          <div className={styles.mapCalloutTitle}>
            Saved to {profile.mapSaveCount} people's maps
          </div>
          <div className={styles.mapCalloutSub}>
            People who saw your content and pinned your business
          </div>
        </div>
      </div>

      <SavedPlacesSection />

      <MenuSection />

      <section className={styles.postsBlock}>
        <h3 className={styles.postsTitle}>Recent Posts</h3>
        <div className={styles.postsGrid}>
          {myPosts.map((post) => (
            <button
              key={post.id}
              type="button"
              className={styles.postCell}
              style={{ background: post.thumbnailGradient }}
              onClick={() => setSelectedPostId(post.id)}
            >
              <span className={styles.postEmoji}>{post.businessEmoji}</span>
              {post.hasDeal && <span className={styles.postDot} />}
            </button>
          ))}
        </div>
      </section>

      <DealTemplatesSection />

      <EditProfileModal />

      {selectedPostId && (
        <div
          className={styles.postLightbox}
          onClick={() => setSelectedPostId(null)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setSelectedPostId(null);
          }}
          aria-label="Close post"
        >
          <div className={styles.postLightboxInner}>
            {posts.find((p) => p.id === selectedPostId)?.caption}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.stat}>
      <div className={styles.statValue}>{value.toLocaleString()}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  );
}
