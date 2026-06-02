-- Pindrapp Supabase schema
-- Run this in Supabase Dashboard → SQL Editor (or via `supabase db push`).
-- Idempotent: safe to re-run.

-- ============================================================================
-- Extensions
-- ============================================================================
create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- ============================================================================
-- users
-- ============================================================================
create table if not exists public.users (
  id            uuid primary key default gen_random_uuid(),
  auth_id       uuid not null unique references auth.users(id) on delete cascade,
  user_type     text check (user_type in ('business', 'consumer')),
  name          text not null default '',
  avatar_url    text,
  onboarded     boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists users_auth_id_idx on public.users(auth_id);

-- Short optional bio shown on a consumer's profile.
alter table public.users
  add column if not exists bio text;

-- ============================================================================
-- businesses (1 per business user)
-- ============================================================================
create table if not exists public.businesses (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null unique references public.users(id) on delete cascade,
  name            text not null,
  category        text not null,
  bio             text default '',
  address         text,
  lat             double precision,
  lng             double precision,
  website         text,
  instagram       text,
  phone           text,
  avatar_url      text,
  follower_count  integer not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists businesses_user_id_idx on public.businesses(user_id);
create index if not exists businesses_location_idx on public.businesses(lat, lng);

-- Optional wide cover photo shown at the top of the business profile.
alter table public.businesses
  add column if not exists cover_photo_url text;

-- Pro tier — visibility / AI / analytics. Free businesses get full flash-deal
-- and feed access; Pro adds verified badge, priority placement, AI Autopilot.
alter table public.businesses
  add column if not exists is_pro boolean not null default false;
alter table public.businesses
  add column if not exists pro_since timestamptz;
alter table public.businesses
  add column if not exists stripe_customer_id text;
alter table public.businesses
  add column if not exists stripe_subscription_id text;

-- Drop the deprecated deals-per-month limit column if a prior schema had it.
alter table public.businesses drop column if exists deals_this_month;

create index if not exists businesses_is_pro_idx on public.businesses(is_pro);

-- ============================================================================
-- posts (video updates from a business)
-- ============================================================================
create table if not exists public.posts (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses(id) on delete cascade,
  caption       text not null default '',
  video_url     text,
  thumbnail_url text,
  like_count    integer not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists posts_business_idx on public.posts(business_id);
create index if not exists posts_created_idx on public.posts(created_at desc);

-- post_type splits the two content streams: 'feed' (video updates, no pricing)
-- vs 'deal' (flash deals). A post belongs to exactly one stream.
alter table public.posts
  add column if not exists post_type text
  check (post_type in ('feed', 'deal')) default 'feed';

create index if not exists posts_type_created_idx on public.posts(post_type, created_at desc);

-- post_category labels a feed post (announcement, menuItem, event,
-- behindTheScenes, newStock, update). Deal posts leave this null and use
-- deals.deal_category instead.
alter table public.posts
  add column if not exists post_category text;

-- ============================================================================
-- deals (flash deals attached to a business / optionally a post)
-- ============================================================================
create table if not exists public.deals (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses(id) on delete cascade,
  headline         text not null,
  description      text default '',
  original_price   double precision,
  deal_price       double precision,
  discount_percent double precision,
  expires_at       timestamptz,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);

create index if not exists deals_business_idx on public.deals(business_id);
create index if not exists deals_active_idx on public.deals(is_active, expires_at);

-- Deals can be backed by an image OR a video, and carry a deal category.
alter table public.deals
  add column if not exists media_url text;
alter table public.deals
  add column if not exists media_type text
  check (media_type in ('image', 'video'));
alter table public.deals
  add column if not exists deal_category text;

-- Per-deal analytics for the Pro dashboard.
alter table public.deals
  add column if not exists view_count integer not null default 0;
alter table public.deals
  add column if not exists claim_count integer not null default 0;

-- Atomic increment helpers. SECURITY DEFINER so any viewer can bump the
-- counter on a deal they don't own (RLS would otherwise block the UPDATE).
create or replace function public.increment_deal_views(deal_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.deals set view_count = view_count + 1 where id = deal_id;
$$;

create or replace function public.increment_deal_claims(deal_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.deals set claim_count = claim_count + 1 where id = deal_id;
$$;

-- ============================================================================
-- saved_places (a consumer pinning a business to their map)
-- ============================================================================
create table if not exists public.saved_places (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (user_id, business_id)
);

create index if not exists saved_places_user_idx on public.saved_places(user_id);

-- ============================================================================
-- likes (a consumer liking a post)
-- ============================================================================
create table if not exists public.likes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  post_id    uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, post_id)
);

create index if not exists likes_post_idx on public.likes(post_id);

-- ============================================================================
-- followers (a consumer following a business)
-- ============================================================================
create table if not exists public.followers (
  id          uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (follower_id, business_id)
);

create index if not exists followers_business_idx on public.followers(business_id);
create index if not exists followers_follower_idx on public.followers(follower_id);

-- Keep businesses.follower_count in sync with the followers table. SECURITY
-- DEFINER so a follower can bump a count on a business they don't own (RLS
-- would otherwise block the UPDATE).
create or replace function public.bump_follower_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.businesses set follower_count = follower_count + 1 where id = new.business_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.businesses set follower_count = greatest(0, follower_count - 1) where id = old.business_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists followers_count_trigger on public.followers;
create trigger followers_count_trigger
  after insert or delete on public.followers
  for each row execute function public.bump_follower_count();

-- ============================================================================
-- hypes (a consumer publicly recommending a post or deal — "I recommend this")
-- ============================================================================
-- One row per (user, post) or (user, deal). Exactly one of post_id / deal_id
-- is set; the other stays NULL. Mirrors the like/unlike model.
create table if not exists public.hypes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  post_id    uuid references public.posts(id) on delete cascade,
  deal_id    uuid references public.deals(id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((post_id is not null and deal_id is null) or (post_id is null and deal_id is not null))
);

create unique index if not exists hypes_user_post_uidx
  on public.hypes(user_id, post_id) where post_id is not null;
create unique index if not exists hypes_user_deal_uidx
  on public.hypes(user_id, deal_id) where deal_id is not null;
create index if not exists hypes_post_idx on public.hypes(post_id);
create index if not exists hypes_deal_idx on public.hypes(deal_id);

-- Posts get a denormalized hype_count column so the feed query stays a single
-- read. Trigger below keeps it in sync.
alter table public.posts
  add column if not exists hype_count int not null default 0;

-- Likes get a nullable deal_id (we already use post_id for post likes). The
-- existing post_id NOT NULL constraint is relaxed so a row can carry one or
-- the other. Same shape as `hypes`.
alter table public.likes
  alter column post_id drop not null;
alter table public.likes
  add column if not exists deal_id uuid references public.deals(id) on delete cascade;

-- The original (user_id, post_id) UNIQUE constraint can stay — it permits
-- one row per (user, post) and any number of NULL post_id rows alongside.
-- Add a parallel unique for (user, deal).
create unique index if not exists likes_user_deal_uidx
  on public.likes(user_id, deal_id) where deal_id is not null;
create index if not exists likes_deal_idx on public.likes(deal_id);

-- Keep posts.hype_count in sync with the hypes table. SECURITY DEFINER so a
-- consumer hyping any post can bump the count on a post they don't own.
create or replace function public.bump_hype_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    if (new.post_id is not null) then
      update public.posts set hype_count = hype_count + 1 where id = new.post_id;
    end if;
    return new;
  elsif (tg_op = 'DELETE') then
    if (old.post_id is not null) then
      update public.posts set hype_count = greatest(0, hype_count - 1) where id = old.post_id;
    end if;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists hypes_count_trigger on public.hypes;
create trigger hypes_count_trigger
  after insert or delete on public.hypes
  for each row execute function public.bump_hype_count();

-- Standalone RPC helpers (the trigger above keeps the counter in sync for the
-- common case; these RPCs are documented in the social-actions spec so the
-- client can call them explicitly when needed).
create or replace function public.increment_post_hypes(post_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.posts set hype_count = hype_count + 1 where id = post_id;
$$;

create or replace function public.decrement_post_hypes(post_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.posts set hype_count = greatest(0, hype_count - 1) where id = post_id;
$$;

alter table public.hypes enable row level security;

drop policy if exists hypes_read on public.hypes;
create policy hypes_read on public.hypes for select using (true);

drop policy if exists hypes_self_write on public.hypes;
create policy hypes_self_write on public.hypes
  for insert with check (user_id in (select id from public.users where auth_id = auth.uid()));

drop policy if exists hypes_self_delete on public.hypes;
create policy hypes_self_delete on public.hypes
  for delete using (user_id in (select id from public.users where auth_id = auth.uid()));

-- ============================================================================
-- catalog_items (a business's product/service menu — shown only in-profile)
-- ============================================================================
create table if not exists public.catalog_items (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid references public.businesses(id) on delete cascade,
  name           text not null,
  description    text default '',
  category       text default 'General',
  photo_url      text,
  regular_price  numeric(10, 2),
  sale_price     numeric(10, 2),
  tags           text[] default '{}',
  is_available   boolean default true,
  sort_order     int default 0,
  created_at     timestamptz not null default now()
);

create index if not exists catalog_items_business_id_idx on public.catalog_items(business_id);

alter table public.catalog_items enable row level security;

-- ============================================================================
-- scheduled_posts (Pro AI Autopilot — deals queued for a future post time)
-- ============================================================================
create table if not exists public.scheduled_posts (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses(id) on delete cascade,
  deal_data     jsonb not null,
  image_url     text,
  scheduled_for timestamptz not null,
  status        text not null default 'pending'
    check (status in ('pending', 'posted', 'cancelled')),
  created_at    timestamptz not null default now()
);

create index if not exists scheduled_posts_due_idx
  on public.scheduled_posts(status, scheduled_for);

alter table public.scheduled_posts enable row level security;

drop policy if exists scheduled_owner_write on public.scheduled_posts;
create policy scheduled_owner_write on public.scheduled_posts
  for all
  using (
    business_id in (
      select b.id from public.businesses b
      join public.users u on u.id = b.user_id
      where u.auth_id = auth.uid()
    )
  )
  with check (
    business_id in (
      select b.id from public.businesses b
      join public.users u on u.id = b.user_id
      where u.auth_id = auth.uid()
    )
  );

-- ============================================================================
-- deal_claims (a record per successful deal redemption — drives the consumer's
-- Deal History and the business's "Deal Claims" stat)
-- ============================================================================
create table if not exists public.deal_claims (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  deal_id     uuid not null references public.deals(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  amount_paid numeric(10, 2) not null default 0,
  claimed_at  timestamptz not null default now()
);

create index if not exists deal_claims_user_idx on public.deal_claims(user_id, claimed_at desc);
create index if not exists deal_claims_business_idx on public.deal_claims(business_id, claimed_at desc);

alter table public.deal_claims enable row level security;

drop policy if exists deal_claims_self_read on public.deal_claims;
create policy deal_claims_self_read on public.deal_claims
  for select
  using (
    user_id in (select id from public.users where auth_id = auth.uid())
    or business_id in (
      select b.id from public.businesses b
      join public.users u on u.id = b.user_id
      where u.auth_id = auth.uid()
    )
  );

drop policy if exists deal_claims_self_insert on public.deal_claims;
create policy deal_claims_self_insert on public.deal_claims
  for insert
  with check (user_id in (select id from public.users where auth_id = auth.uid()));

drop policy if exists catalog_read on public.catalog_items;
create policy catalog_read on public.catalog_items for select using (true);

drop policy if exists catalog_owner_write on public.catalog_items;
create policy catalog_owner_write on public.catalog_items
  for all
  using (
    business_id in (
      select b.id from public.businesses b
      join public.users u on u.id = b.user_id
      where u.auth_id = auth.uid()
    )
  )
  with check (
    business_id in (
      select b.id from public.businesses b
      join public.users u on u.id = b.user_id
      where u.auth_id = auth.uid()
    )
  );

-- ============================================================================
-- like_count maintenance — keep posts.like_count in sync with the likes table
-- via a trigger. SECURITY DEFINER so a consumer liking a post can bump the
-- count on a post they don't own (RLS would otherwise block the UPDATE).
-- ============================================================================
create or replace function public.bump_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.posts set like_count = like_count + 1 where id = new.post_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.posts set like_count = greatest(0, like_count - 1) where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists likes_count_trigger on public.likes;
create trigger likes_count_trigger
  after insert or delete on public.likes
  for each row execute function public.bump_like_count();

-- ============================================================================
-- Row-level security policies
-- ============================================================================
alter table public.users         enable row level security;
alter table public.businesses    enable row level security;
alter table public.posts         enable row level security;
alter table public.deals         enable row level security;
alter table public.saved_places  enable row level security;
alter table public.likes         enable row level security;
alter table public.followers     enable row level security;

-- USERS: each auth user can only see and update their own row.
drop policy if exists users_self_select on public.users;
create policy users_self_select on public.users
  for select using (auth.uid() = auth_id);

drop policy if exists users_self_insert on public.users;
create policy users_self_insert on public.users
  for insert with check (auth.uid() = auth_id);

drop policy if exists users_self_update on public.users;
create policy users_self_update on public.users
  for update using (auth.uid() = auth_id) with check (auth.uid() = auth_id);

-- BUSINESSES: anyone (signed in) can read; only the owner can write.
drop policy if exists businesses_read on public.businesses;
create policy businesses_read on public.businesses for select using (true);

drop policy if exists businesses_owner_write on public.businesses;
create policy businesses_owner_write on public.businesses
  for all
  using (
    user_id in (select id from public.users where auth_id = auth.uid())
  )
  with check (
    user_id in (select id from public.users where auth_id = auth.uid())
  );

-- POSTS: anyone can read; only the owning business can write.
drop policy if exists posts_read on public.posts;
create policy posts_read on public.posts for select using (true);

drop policy if exists posts_owner_write on public.posts;
create policy posts_owner_write on public.posts
  for all
  using (
    business_id in (
      select b.id from public.businesses b
      join public.users u on u.id = b.user_id
      where u.auth_id = auth.uid()
    )
  )
  with check (
    business_id in (
      select b.id from public.businesses b
      join public.users u on u.id = b.user_id
      where u.auth_id = auth.uid()
    )
  );

-- DEALS: same pattern as posts.
drop policy if exists deals_read on public.deals;
create policy deals_read on public.deals for select using (true);

drop policy if exists deals_owner_write on public.deals;
create policy deals_owner_write on public.deals
  for all
  using (
    business_id in (
      select b.id from public.businesses b
      join public.users u on u.id = b.user_id
      where u.auth_id = auth.uid()
    )
  )
  with check (
    business_id in (
      select b.id from public.businesses b
      join public.users u on u.id = b.user_id
      where u.auth_id = auth.uid()
    )
  );

-- Explicit DELETE policies for posts + deals. The `*_owner_write` FOR ALL
-- policies above already grant DELETE to owners, but PostgREST treats these
-- DELETE-specific policies as additive so apps that grep for an explicit
-- "owner delete" rule (CDC tooling, audits) find it.
drop policy if exists posts_owner_delete on public.posts;
create policy posts_owner_delete on public.posts
  for delete
  using (
    business_id in (
      select b.id from public.businesses b
      join public.users u on u.id = b.user_id
      where u.auth_id = auth.uid()
    )
  );

drop policy if exists deals_owner_delete on public.deals;
create policy deals_owner_delete on public.deals
  for delete
  using (
    business_id in (
      select b.id from public.businesses b
      join public.users u on u.id = b.user_id
      where u.auth_id = auth.uid()
    )
  );

-- SAVED_PLACES: each user reads/writes only their own.
drop policy if exists saved_places_self on public.saved_places;
create policy saved_places_self on public.saved_places
  for all
  using (user_id in (select id from public.users where auth_id = auth.uid()))
  with check (user_id in (select id from public.users where auth_id = auth.uid()));

-- LIKES: each user reads/writes only their own; counts can be read by anyone.
drop policy if exists likes_read on public.likes;
create policy likes_read on public.likes for select using (true);

drop policy if exists likes_self_write on public.likes;
create policy likes_self_write on public.likes
  for insert with check (user_id in (select id from public.users where auth_id = auth.uid()));

drop policy if exists likes_self_delete on public.likes;
create policy likes_self_delete on public.likes
  for delete using (user_id in (select id from public.users where auth_id = auth.uid()));

-- FOLLOWERS: anyone can read counts; each user manages only their own follows.
drop policy if exists followers_read on public.followers;
create policy followers_read on public.followers for select using (true);

drop policy if exists followers_self_write on public.followers;
create policy followers_self_write on public.followers
  for all
  using (follower_id in (select id from public.users where auth_id = auth.uid()))
  with check (follower_id in (select id from public.users where auth_id = auth.uid()));

-- ============================================================================
-- Realtime — add the tables the client subscribes to into the
-- supabase_realtime publication so postgres_changes events are emitted.
-- ============================================================================
do $$
begin
  -- add tables only if not already members of the publication
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'posts'
  ) then
    alter publication supabase_realtime add table public.posts;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'deals'
  ) then
    alter publication supabase_realtime add table public.deals;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'likes'
  ) then
    alter publication supabase_realtime add table public.likes;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'saved_places'
  ) then
    alter publication supabase_realtime add table public.saved_places;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'followers'
  ) then
    alter publication supabase_realtime add table public.followers;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'deal_claims'
  ) then
    alter publication supabase_realtime add table public.deal_claims;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'hypes'
  ) then
    alter publication supabase_realtime add table public.hypes;
  end if;
end $$;

-- ============================================================================
-- Storage buckets
-- ============================================================================
-- Run this in Storage → Create new bucket UI, or:
insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
  values ('videos', 'videos', true)
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
  values ('deal-images', 'deal-images', true)
  on conflict (id) do nothing;

drop policy if exists deal_images_public_read on storage.objects;
create policy deal_images_public_read on storage.objects
  for select using (bucket_id = 'deal-images');

drop policy if exists deal_images_authed_write on storage.objects;
create policy deal_images_authed_write on storage.objects
  for insert
  with check (bucket_id = 'deal-images' and auth.role() = 'authenticated');

-- Anyone can read avatars/videos (public buckets). Authed users can upload
-- their own.
drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists avatars_authed_write on storage.objects;
create policy avatars_authed_write on storage.objects
  for insert
  with check (bucket_id = 'avatars' and auth.role() = 'authenticated');

drop policy if exists videos_public_read on storage.objects;
create policy videos_public_read on storage.objects
  for select using (bucket_id = 'videos');

drop policy if exists videos_authed_write on storage.objects;
create policy videos_authed_write on storage.objects
  for insert
  with check (bucket_id = 'videos' and auth.role() = 'authenticated');
