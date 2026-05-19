import type { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export type UserType = 'business' | 'consumer';

export interface UserProfile {
  id: string;
  authId: string;
  userType: UserType | null;
  name: string;
  avatarUrl: string | null;
  onboarded: boolean;
}

export interface BusinessProfile {
  id: string;
  userId: string;
  name: string;
  category: string;
  bio: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  website: string | null;
  instagram: string | null;
  phone: string | null;
  avatarUrl: string | null;
  followerCount: number;
}

/** What stage of the auth/onboarding flow we are at. */
export type AuthStage =
  | 'loading' // checking initial session
  | 'unauthenticated' // no session, show splash
  | 'pickingType' // signed in, no userType selected yet
  | 'onboardingBusiness' // userType=business, no business row yet
  | 'onboardingConsumer' // userType=consumer, onboarded=false
  | 'authenticated' // session + onboarded
  | 'disabled'; // Supabase not configured — bypass auth, run on mock data

interface AuthState {
  stage: AuthStage;
  session: Session | null;
  authUser: User | null;
  profile: UserProfile | null;
  business: BusinessProfile | null;
  error: string | null;

  initialize: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setUserType: (type: UserType) => Promise<void>;
  saveBusinessProfile: (
    fields: Omit<BusinessProfile, 'id' | 'userId' | 'followerCount'>,
  ) => Promise<void>;
  markConsumerOnboarded: () => Promise<void>;
}

function deriveStageFor(
  session: Session | null,
  profile: UserProfile | null,
  business: BusinessProfile | null,
): AuthStage {
  if (!session) return 'unauthenticated';
  if (!profile || !profile.userType) return 'pickingType';
  if (profile.userType === 'business' && !business) return 'onboardingBusiness';
  if (profile.userType === 'consumer' && !profile.onboarded) return 'onboardingConsumer';
  return 'authenticated';
}

export const useAuthStore = create<AuthState>()(
  immer((set, get) => ({
    stage: isSupabaseConfigured() ? 'loading' : 'disabled',
    session: null,
    authUser: null,
    profile: null,
    business: null,
    error: null,

    initialize: async () => {
      if (!isSupabaseConfigured() || !supabase) {
        set((s) => {
          s.stage = 'disabled';
        });
        return;
      }
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      let profile: UserProfile | null = null;
      let business: BusinessProfile | null = null;

      if (session) {
        profile = await loadProfile(session.user.id);
        if (profile?.userType === 'business') {
          business = await loadBusiness(profile.id);
        }
      }
      set((s) => {
        s.session = session;
        s.authUser = session?.user ?? null;
        s.profile = profile;
        s.business = business;
        s.stage = deriveStageFor(session, profile, business);
      });

      supabase.auth.onAuthStateChange(async (event, sess) => {
        if (event === 'SIGNED_OUT' || !sess) {
          set((s) => {
            s.session = null;
            s.authUser = null;
            s.profile = null;
            s.business = null;
            s.stage = 'unauthenticated';
          });
          return;
        }
        const p = await loadProfile(sess.user.id);
        const b = p?.userType === 'business' ? await loadBusiness(p.id) : null;
        set((s) => {
          s.session = sess;
          s.authUser = sess.user;
          s.profile = p;
          s.business = b;
          s.stage = deriveStageFor(sess, p, b);
        });
      });
    },

    signOut: async () => {
      if (supabase) await supabase.auth.signOut();
      set((s) => {
        s.session = null;
        s.authUser = null;
        s.profile = null;
        s.business = null;
        s.stage = 'unauthenticated';
      });
    },

    refreshProfile: async () => {
      const { authUser } = get();
      if (!authUser || !supabase) return;
      const profile = await loadProfile(authUser.id);
      const business =
        profile?.userType === 'business' ? await loadBusiness(profile.id) : null;
      set((s) => {
        s.profile = profile;
        s.business = business;
        s.stage = deriveStageFor(s.session, profile, business);
      });
    },

    setUserType: async (type) => {
      const sb = supabase;
      const { authUser } = get();
      if (!sb || !authUser) return;
      // Upsert the user row in `users` keyed on auth_id.
      const { data, error } = await sb
        .from('users')
        .upsert(
          {
            auth_id: authUser.id,
            user_type: type,
            name: authUser.user_metadata?.full_name ?? authUser.email ?? '',
            onboarded: type === 'business' ? false : false,
          },
          { onConflict: 'auth_id' },
        )
        .select()
        .single();
      if (error) {
        set((s) => {
          s.error = error.message;
        });
        return;
      }
      const profile: UserProfile = rowToProfile(data);
      set((s) => {
        s.profile = profile;
        s.stage = deriveStageFor(s.session, profile, null);
      });
    },

    saveBusinessProfile: async (fields) => {
      const sb = supabase;
      const { profile } = get();
      if (!sb || !profile) return;
      const { data, error } = await sb
        .from('businesses')
        .upsert(
          {
            user_id: profile.id,
            name: fields.name,
            category: fields.category,
            bio: fields.bio,
            address: fields.address,
            lat: fields.lat,
            lng: fields.lng,
            website: fields.website,
            instagram: fields.instagram,
            phone: fields.phone,
            avatar_url: fields.avatarUrl,
          },
          { onConflict: 'user_id' },
        )
        .select()
        .single();
      if (error) {
        set((s) => {
          s.error = error.message;
        });
        return;
      }
      // Mark user as onboarded.
      await sb.from('users').update({ onboarded: true }).eq('id', profile.id);
      set((s) => {
        s.business = rowToBusiness(data);
        if (s.profile) s.profile.onboarded = true;
        s.stage = deriveStageFor(s.session, { ...profile, onboarded: true }, rowToBusiness(data));
      });
    },

    markConsumerOnboarded: async () => {
      const sb = supabase;
      const { profile } = get();
      if (!sb || !profile) return;
      await sb.from('users').update({ onboarded: true }).eq('id', profile.id);
      set((s) => {
        if (s.profile) s.profile.onboarded = true;
        s.stage = deriveStageFor(s.session, { ...profile, onboarded: true }, s.business);
      });
    },
  })),
);

// ----- internal helpers -----

interface UserRow {
  id: string;
  auth_id: string;
  user_type: UserType | null;
  name: string;
  avatar_url: string | null;
  onboarded: boolean;
}

interface BusinessRow {
  id: string;
  user_id: string;
  name: string;
  category: string;
  bio: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  website: string | null;
  instagram: string | null;
  phone: string | null;
  avatar_url: string | null;
  follower_count: number;
}

function rowToProfile(r: UserRow): UserProfile {
  return {
    id: r.id,
    authId: r.auth_id,
    userType: r.user_type,
    name: r.name,
    avatarUrl: r.avatar_url,
    onboarded: r.onboarded,
  };
}

function rowToBusiness(r: BusinessRow): BusinessProfile {
  return {
    id: r.id,
    userId: r.user_id,
    name: r.name,
    category: r.category,
    bio: r.bio,
    address: r.address,
    lat: r.lat,
    lng: r.lng,
    website: r.website,
    instagram: r.instagram,
    phone: r.phone,
    avatarUrl: r.avatar_url,
    followerCount: r.follower_count,
  };
}

async function loadProfile(authId: string): Promise<UserProfile | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('auth_id', authId)
    .maybeSingle();
  return data ? rowToProfile(data as UserRow) : null;
}

async function loadBusiness(userId: string): Promise<BusinessProfile | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from('businesses')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  return data ? rowToBusiness(data as BusinessRow) : null;
}
