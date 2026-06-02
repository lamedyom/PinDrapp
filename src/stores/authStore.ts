import type { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { showToast } from './toastStore';

export type UserType = 'business' | 'consumer';

// How long we'll wait for Supabase before giving up and entering offline mode.
const AUTH_INIT_TIMEOUT_MS = 5000;

/** Resolve `promise`, or `fallback` if it doesn't settle within `ms`. */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(fallback);
      }
    }, ms);
    promise.then(
      (v) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(v);
        }
      },
      () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(fallback);
        }
      },
    );
  });
}

// Guard so React StrictMode's double-effect (and any re-mounts) can't kick off
// two getSession calls / two onAuthStateChange subscriptions.
let authInitStarted = false;


export interface UserProfile {
  id: string;
  authId: string;
  userType: UserType | null;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
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
  /** Pro subscriber — unlocks AI Autopilot, analytics, priority placement. */
  isPro: boolean;
  proSince: Date | null;
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
  /** True when the user tapped "Continue as Guest" — browsing without a session. */
  isGuest: boolean;
  /** Which guest-gated action is currently asking for sign-up (null = none). */
  guestPromptType: GuestPromptType | null;

  initialize: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setUserType: (type: UserType) => Promise<void>;
  saveBusinessProfile: (
    fields: Omit<BusinessProfile, 'id' | 'userId' | 'followerCount' | 'isPro' | 'proSince'>,
  ) => Promise<void>;
  /** Persist a partial business row (per-step onboarding save). Upserts on
   *  user_id so a half-completed onboarding can resume from where it left off. */
  upsertBusinessFields: (fields: {
    name?: string;
    category?: string;
    bio?: string | null;
    address?: string | null;
    lat?: number | null;
    lng?: number | null;
    website?: string | null;
    instagram?: string | null;
    phone?: string | null;
    avatarUrl?: string | null;
  }) => Promise<void>;
  /** Mark the signed-in user as fully onboarded. Idempotent. */
  markOnboarded: () => Promise<void>;
  markConsumerOnboarded: () => Promise<void>;
  updateConsumerProfile: (fields: {
    name?: string;
    avatarUrl?: string | null;
    bio?: string | null;
  }) => Promise<void>;
  /** Opens the guest-prompt sheet for a specific action. */
  showGuestPrompt: (type: GuestPromptType) => void;
  hideGuestPrompt: () => void;
  /** Tap "Continue as Guest" — browse without a session; restricted actions
   *  still surface the sign-up sheet. */
  continueAsGuest: () => void;
}

/** Which restricted action the visitor just tried — drives the prompt copy. */
export type GuestPromptType = 'like' | 'save' | 'follow' | 'claim' | 'post';

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
    isGuest: false,
    guestPromptType: null,

    initialize: async () => {
      if (authInitStarted) return;
      authInitStarted = true;

      if (!isSupabaseConfigured() || !supabase) {
        // eslint-disable-next-line no-console
        console.log('[pindrapp] Supabase not configured — running on mock data');
        set((s) => {
          s.stage = 'disabled';
        });
        return;
      }
      const sb = supabase;
      // eslint-disable-next-line no-console
      console.log('[pindrapp] starting auth init…');

      // Race the entire session+profile load against a hard timeout. If
      // Supabase is unreachable (network blocked, project paused, slow auth
      // lock), the timeout wins and we drop into offline/guest mode rather
      // than freezing on the splash forever.
      const TIMED_OUT = Symbol('timeout');
      const loaded = await withTimeout(
        (async () => {
          // Chain: auth.users.id → public.users.auth_id → public.users.id → businesses.user_id
          const { data } = await sb.auth.getSession();
          const session = data.session;
          // eslint-disable-next-line no-console
          console.log('[pindrapp] auth chain · step 0 — session:', {
            signed_in: !!session,
            'auth.users.id': session?.user.id,
            email: session?.user.email,
          });
          let profile: UserProfile | null = null;
          let business: BusinessProfile | null = null;
          if (session) {
            profile = await loadProfile(session.user.id);
            // eslint-disable-next-line no-console
            console.log('[pindrapp] auth chain · step 1 — users WHERE auth_id =', session.user.id, '→', {
              'public.users.id': profile?.id,
              user_type: profile?.userType,
            });
            if (profile?.userType === 'business') {
              business = await loadBusiness(profile.id);
              // eslint-disable-next-line no-console
              console.log('[pindrapp] auth chain · step 2 — businesses WHERE user_id =', profile.id, '→', {
                'businesses.id': business?.id,
                name: business?.name,
              });
            }
          }
          return { session, profile, business };
        })(),
        AUTH_INIT_TIMEOUT_MS,
        TIMED_OUT as unknown as { session: Session | null; profile: UserProfile | null; business: BusinessProfile | null },
      );

      if ((loaded as unknown) === TIMED_OUT) {
        // eslint-disable-next-line no-console
        console.warn('[pindrapp] auth init timed out — entering offline mode');
        set((s) => {
          s.stage = 'disabled';
          s.error = 'auth-timeout';
        });
        showToast('Running in offline mode');
      } else {
        const { session, profile, business } = loaded;
        // eslint-disable-next-line no-console
        console.log('[pindrapp] auth init done →', deriveStageFor(session, profile, business));
        set((s) => {
          s.session = session;
          s.authUser = session?.user ?? null;
          s.profile = profile;
          s.business = business;
          s.stage = deriveStageFor(session, profile, business);
        });
      }

      // Keep the app in sync with future auth changes. The body is deferred
      // out of the callback with setTimeout(0): supabase-js holds an internal
      // lock while the callback runs, and making DB/auth calls inside it can
      // deadlock. Deferring releases the lock first.
      sb.auth.onAuthStateChange((event, sess) => {
        setTimeout(() => {
          void (async () => {
            try {
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
              const p = await withTimeout(loadProfile(sess.user.id), AUTH_INIT_TIMEOUT_MS, null);
              const b =
                p?.userType === 'business'
                  ? await withTimeout(loadBusiness(p.id), AUTH_INIT_TIMEOUT_MS, null)
                  : null;
              set((s) => {
                s.session = sess;
                s.authUser = sess.user;
                s.profile = p;
                s.business = b;
                s.stage = deriveStageFor(sess, p, b);
              });
            } catch (err) {
              // eslint-disable-next-line no-console
              console.error('[pindrapp] auth state change failed:', err);
              set((s) => {
                s.session = sess ?? null;
                s.authUser = sess?.user ?? null;
                s.profile = null;
                s.business = null;
                s.stage = sess ? 'pickingType' : 'unauthenticated';
              });
            }
          })();
        }, 0);
      });
    },

    signOut: async () => {
      if (supabase) await supabase.auth.signOut();
      set((s) => {
        s.session = null;
        s.authUser = null;
        s.profile = null;
        s.business = null;
        s.isGuest = false;
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

    upsertBusinessFields: async (fields) => {
      const sb = supabase;
      const { profile, business } = get();
      if (!sb || !profile) return;
      // Map camelCase → snake_case for Supabase. Only include provided fields.
      const payload: Record<string, unknown> = { user_id: profile.id };
      if (fields.name !== undefined) payload.name = fields.name;
      if (fields.category !== undefined) payload.category = fields.category;
      if (fields.bio !== undefined) payload.bio = fields.bio;
      if (fields.address !== undefined) payload.address = fields.address;
      if (fields.lat !== undefined) payload.lat = fields.lat;
      if (fields.lng !== undefined) payload.lng = fields.lng;
      if (fields.website !== undefined) payload.website = fields.website;
      if (fields.instagram !== undefined) payload.instagram = fields.instagram;
      if (fields.phone !== undefined) payload.phone = fields.phone;
      if (fields.avatarUrl !== undefined) payload.avatar_url = fields.avatarUrl;
      // On the first call there's no business row yet, so name + category
      // (the step-1 requireds) are needed for the INSERT to succeed.
      if (!business && (payload.name === undefined || payload.category === undefined)) {
        return;
      }
      const { data, error } = await sb
        .from('businesses')
        .upsert(payload, { onConflict: 'user_id' })
        .select()
        .single();
      if (error || !data) return;
      set((s) => {
        s.business = rowToBusiness(data);
      });
    },

    markOnboarded: async () => {
      const sb = supabase;
      const { profile } = get();
      if (!sb || !profile || profile.onboarded) return;
      await sb.from('users').update({ onboarded: true }).eq('id', profile.id);
      set((s) => {
        if (s.profile) s.profile.onboarded = true;
        s.stage = deriveStageFor(s.session, { ...profile, onboarded: true }, s.business);
      });
    },

    updateConsumerProfile: async (fields) => {
      const { profile } = get();
      // Optimistically update the local profile first.
      set((s) => {
        if (!s.profile) return;
        if (fields.name !== undefined) s.profile.name = fields.name;
        if (fields.avatarUrl !== undefined) s.profile.avatarUrl = fields.avatarUrl;
        if (fields.bio !== undefined) s.profile.bio = fields.bio;
      });
      const sb = supabase;
      if (!sb || !profile) return;
      const payload: Record<string, unknown> = {};
      if (fields.name !== undefined) payload.name = fields.name;
      if (fields.avatarUrl !== undefined) payload.avatar_url = fields.avatarUrl;
      if (fields.bio !== undefined) payload.bio = fields.bio;
      if (Object.keys(payload).length > 0) {
        await sb.from('users').update(payload).eq('id', profile.id);
      }
    },

    showGuestPrompt: (type) =>
      set((s) => {
        s.guestPromptType = type;
      }),

    hideGuestPrompt: () =>
      set((s) => {
        s.guestPromptType = null;
      }),

    continueAsGuest: () =>
      set((s) => {
        s.isGuest = true;
        s.profile = null;
        s.business = null;
        // Move past unauthenticated so AuthGate stops bouncing to /auth/splash.
        s.stage = 'disabled';
      }),
  })),
);

// ----- internal helpers -----

interface UserRow {
  id: string;
  auth_id: string;
  user_type: UserType | null;
  name: string;
  avatar_url: string | null;
  bio: string | null;
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
  is_pro: boolean | null;
  pro_since: string | null;
}

function rowToProfile(r: UserRow): UserProfile {
  return {
    id: r.id,
    authId: r.auth_id,
    userType: r.user_type,
    name: r.name,
    avatarUrl: r.avatar_url,
    bio: r.bio ?? null,
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
    isPro: !!r.is_pro,
    proSince: r.pro_since ? new Date(r.pro_since) : null,
  };
}

/**
 * Step 1 of the business lookup chain.
 *
 *   auth.users.id  →  public.users WHERE auth_id = <that id>  →  public.users.id
 *
 * Never use auth.users.id as a foreign key directly — businesses.user_id
 * references public.users.id, not auth.users.id.
 */
async function loadProfile(authId: string): Promise<UserProfile | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('auth_id', authId)
    .maybeSingle();
  return data ? rowToProfile(data as UserRow) : null;
}

/**
 * Step 2 of the business lookup chain.
 *
 *   public.users.id  →  public.businesses WHERE user_id = <that id>
 *
 * Caller MUST pass the public.users.id (the value returned by loadProfile),
 * not the auth.users.id.
 */
async function loadBusiness(userId: string): Promise<BusinessProfile | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from('businesses')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  return data ? rowToBusiness(data as BusinessRow) : null;
}
