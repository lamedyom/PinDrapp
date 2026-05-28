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
