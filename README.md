# Pindrapp

> See it once. Find it forever.

A mobile-first social discovery app for local businesses: feed → save to map → claim flash deals. Built with React + TypeScript + Vite, Mapbox GL, Stripe, and Cloudinary.

## Quick start

```bash
npm install
npm run dev             # web only (mock payments)
npm run dev:all         # web + Stripe payment-intent server (requires server/.env)
```

App runs at `http://localhost:5173`. The Stripe backend (optional) runs at `http://localhost:3001`.

## Auth + database (Supabase)

Auth, user profiles, businesses, posts, deals, saved places and likes are
all backed by Supabase. **When the Supabase env vars are not set the entire
auth flow is bypassed** and the app runs against the local zustand mock data
— useful for offline UI work but read-only.

### 1. Create the project + run the schema

1. Create a Supabase project at <https://supabase.com>.
2. Project Settings → API → copy the **Project URL** and **anon public key**
   into `.env`:
   ```
   VITE_SUPABASE_URL=https://xxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJh...
   ```
3. SQL Editor → New query → paste the entire contents of
   [`supabase/schema.sql`](./supabase/schema.sql) → Run. This creates the
   `users`, `businesses`, `posts`, `deals`, `saved_places`, `likes` tables,
   row-level-security policies, and the `avatars` + `videos` storage buckets.
   The script is idempotent — safe to re-run.

### 2. Google OAuth

1. Google Cloud Console → APIs & Services → Credentials → **Create
   credentials → OAuth client ID** (type: Web application).
2. **Authorized JavaScript origins**: your dev URL (`http://localhost:5173`)
   and your prod URL (`https://your-app.onrender.com`).
3. **Authorized redirect URIs** (this is the important one): copy from
   Supabase → Authentication → Providers → Google → it'll look like
   `https://xxxxxxx.supabase.co/auth/v1/callback`.
4. Copy the Client ID + Client Secret back into Supabase → Authentication →
   Providers → Google → enable.

### 3. Apple OAuth

1. Apple Developer → Identifiers → **+** → App IDs → enable
   **Sign in with Apple** capability on a new (or existing) App ID.
2. Identifiers → **+** → Services IDs → create one (e.g.
   `app.pindrapp.web`). Enable Sign in with Apple, configure
   **Return URLs** = `https://xxxxxxx.supabase.co/auth/v1/callback`.
3. Keys → **+** → Sign in with Apple → enable for your App ID → download
   the `.p8` key file.
4. Supabase → Authentication → Providers → Apple → enable, then paste:
   - **Services ID** (e.g. `app.pindrapp.web`)
   - **Team ID** (top-right of Apple Developer)
   - **Key ID** (from the key you just generated)
   - **Private key** (paste the contents of the `.p8`)

### 4. Phone OTP

Supabase → Authentication → Providers → **Phone** → enable. The default
provider is Twilio — add your Twilio credentials. (Alternatively MessageBird
or Vonage.) Set the OTP length to 6 and the OTP expiry to 60 s.

### 5. Site URL

Supabase → Authentication → URL Configuration:
- **Site URL**: `http://localhost:5173` (dev) or your prod URL
- **Redirect URLs (allow list)**: both `http://localhost:5173/auth/callback`
  and `https://your-app.onrender.com/auth/callback`

## Environment

Copy `.env.example` to `.env` and fill in keys:

```
VITE_MAPBOX_TOKEN=                # pk.* token from mapbox.com (map tiles + geocoder)
VITE_STRIPE_PUBLISHABLE_KEY=      # pk_test_* / pk_live_*
VITE_CLOUDINARY_CLOUD_NAME=       # cloud name for video uploads
VITE_CLOUDINARY_UPLOAD_PRESET=    # unsigned upload preset
```

For real Stripe payments, also create `server/.env`:

```
STRIPE_SECRET_KEY=sk_test_...
PORT=3001
```

Without these keys the app stays fully usable:
- Map screen shows a fallback panel instead of tiles (pins, sheet, search bar still work).
- Checkout simulates payment success and adds the business to your map.
- Video uploads fall back to a local blob URL.

## What's inside

```
src/
  app/            App entry, routes, font-loading gate
  components/
    layout/       AppShell, BottomNav, TopBar
    ui/           Button, Badge, Avatar, Card, Modal, Toast, BottomSheet, Skeleton, EmptyState
  features/
    map/          MapScreen with custom pins, search bar, draggable bottom sheet
    deals/        DealsScreen with live countdowns, urgency styling, Stripe checkout
    feed/         FeedScreen with story rail, video cards, save-to-map animation
    post/         PostScreen overlay with templates, recorder, Cloudinary upload
    profile/      ProfileScreen with menu, deal templates, swipe-to-edit
  stores/         Zustand stores (map, deal, feed, user, toast)
  hooks/          useCountdown, useGeolocation, useVideoUpload
  lib/            mapbox, stripe, api, haptics
  styles/         globals.css, tokens.css
server/           Stripe payment-intent API (optional)
```

## Design system

| Token        | Value         | Use                                   |
|--------------|---------------|---------------------------------------|
| `--orange`   | `#FF5C1A`     | Brand, CTAs, active nav               |
| `--blue`     | `#1A3AFF`     | Map pins, save actions                |
| `--green`    | `#00D97E`     | Deals only — claim buttons, countdowns|
| `--red`      | `#FF3A3A`     | Live badge, urgency                   |
| `--bg-page`  | `#07070D`     | Page background                       |
| `--bg-shell` | `#0A0A0F`     | App shell column                      |

Rule: Green = deals only. Blue = map/save only. Orange = brand/CTA only. Never mix.

Fonts: **Syne** (headings) + **DM Sans** (body), loaded from Google Fonts.

## Scripts

| Script              | What it does                                |
|---------------------|---------------------------------------------|
| `npm run dev`       | Vite dev server                             |
| `npm run dev:server`| Express + Stripe payment-intent server      |
| `npm run dev:all`   | Both, concurrently                          |
| `npm run build`     | tsc + production build (PWA included)       |
| `npm run preview`   | Serve `dist/`                               |
| `npm run lint`      | ESLint                                      |

## PWA

The build emits a service worker and `manifest.webmanifest`. On iOS, open the deployed site in Safari and tap **Share → Add to Home Screen**.

Icons are generated by `scripts/generate-icons.cjs` (run once after install if needed).
