# 🍒 Cherry Directory v2
**တောင်ကြီးမြို့ Business Directory Platform**

---

## ✅ Features — ပြည့်စုံသည့်နေရာများ

| Feature | Status | Notes |
|---------|--------|-------|
| Business Directory (Search + Filter) | ✅ | Categories, city, ward filter |
| News & Events (Pinned, types) | ✅ | news / event / announcement |
| Public Chat (Realtime) | ✅ | Guest + Member, rooms |
| Emoji Reactions | ✅ | Posts, listings, chat |
| Star Reviews | ✅ | Member only, auto avg |
| Member / Admin / Moderator Login | ✅ | Supabase Auth |
| Guest Mode (no login) | ✅ | Browse & read |
| Image Upload (Cloudinary CDN) | ✅ | Logo, cover, avatar, chat |
| Submit Listing | ✅ | With GPS location |
| **Business Claim** | ✅ | Owner verify with admin review |
| **Bookmarks** | ✅ | Listings + Posts, DB-backed |
| **PWA + Offline Mode** | ✅ | Service Worker, cache-first |
| **Push Notifications** | ✅ | Web Push API + toggle |
| **SEO + Open Graph** | ✅ | Per-page dynamic meta tags |
| **Myanmar ↔ English toggle** | ✅ | Full i18n, persisted |
| **Map Integration** | ✅ | OpenStreetMap (free) + Google Maps link |
| **WhatsApp direct contact** | ✅ | wa.me link |
| **Viber / Telegram direct** | ✅ | viber:// + t.me links |
| **Analytics Dashboard** | ✅ | 14-day charts, admin only |
| **Telegram Bot Notifications** | ✅ | Edge Function (deploy separately) |
| PWA Install prompt | ✅ | "Add to Home Screen" |

---

## 🚀 Setup — ၅ ဆင့်

### 1. Install
```bash
npm install
```

### 2. Environment Variables
`.env` ဖိုင် ဖန်တီးပြီး ဖြည့်ပါ (`.env.example` ကြည့်ပါ):
```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_CLOUDINARY_CLOUD_NAME=your-name
VITE_CLOUDINARY_UPLOAD_PRESET=cherry-directory-uploads
VITE_VAPID_PUBLIC_KEY=BJ...   (optional, for push notifications)
VITE_BASE_URL=https://your-domain.com
```

### 3. Supabase Database
[supabase.com](https://supabase.com) > SQL Editor တွင် `supabase-schema.sql` ကို paste ပြီး **Run** နှိပ်ပါ

### 4. Cloudinary
1. [cloudinary.com](https://cloudinary.com) > Settings > Upload
2. Upload Preset အသစ်: name=`cherry-directory-uploads`, Signing=**Unsigned**

### 5. Run
```bash
npm run dev        # Development
npm run build      # Production build
```

---

## 📱 PWA Setup

`public/icons/` folder ထဲ icon ပုံများ ထည့်ပါ:
- `icon-72.png`, `icon-96.png`, `icon-128.png`, `icon-192.png`, `icon-512.png`

Tool: [realfavicongenerator.net](https://realfavicongenerator.net)

---

## 🔔 Push Notifications Setup

```bash
# 1. VAPID keys generate လုပ်ပါ
npx web-push generate-vapid-keys

# 2. .env ထဲ public key ထည့်ပါ
VITE_VAPID_PUBLIC_KEY=BJ...

# 3. Supabase ထဲ private key ထည့်ပါ
supabase secrets set VAPID_PRIVATE_KEY=your-private-key
```

---

## 📢 Telegram Bot Setup

```bash
# 1. @BotFather မှ bot token ရယူပါ
# 2. Supabase edge function deploy လုပ်ပါ
supabase functions deploy telegram-notify

# 3. Secrets set လုပ်ပါ
supabase secrets set TELEGRAM_BOT_TOKEN=1234567890:ABC...
supabase secrets set TELEGRAM_CHAT_ID=@your_channel_username
```

Bot ကို channel/group ထဲ admin ဖြစ်အောင် add ပါ။

---

## 🗺️ Map + GPS

- **OpenStreetMap** embed — free, no API key
- Submit listing တွင် "GPS ရယူမည်" button နှိပ်ပါ
- Manual lat/lng ထည့်နိုင်သည်
- Google Maps link — listing ကြည့်ရာတွင် တိုက်ရိုက် open

---

## 👥 User Roles

| Role | Permissions |
|------|-------------|
| **Guest** | Browse, read, view chat |
| **Member** | + Chat, react, review, submit listing, bookmark |
| **Moderator** | + Approve listings/posts, moderate chat |
| **Admin** | + Full access, analytics, user roles, claims |

Admin/Moderator role assign: Supabase Dashboard > Table Editor > `profiles` > `role` column

---

## 🗂 Project Structure

```
cherry-directory-v2/
├── public/
│   ├── manifest.json          # PWA manifest
│   ├── sw.js                  # Service Worker (offline + push)
│   └── icons/                 # PWA icons (add manually)
├── src/
│   ├── components/
│   │   ├── Header.jsx         # Lang toggle, PWA install, clock
│   │   ├── Layout.jsx         # Bottom nav + FABs
│   │   ├── UI.jsx             # Cards, Stars, Reactions, Skeleton
│   │   ├── MapEmbed.jsx       # OpenStreetMap (no API key)
│   │   └── AnalyticsChart.jsx # Chart.js wrapper
│   ├── contexts/
│   │   ├── AuthContext.jsx    # Auth state
│   │   └── LangContext.jsx    # Myanmar/English i18n
│   ├── hooks/
│   │   ├── usePWA.js          # SW, push subscription, install
│   │   ├── useSEO.js          # Per-page meta/OG tags
│   │   └── useBookmarks.js    # DB-backed bookmarks
│   ├── lib/
│   │   ├── supabase.js
│   │   └── cloudinary.js
│   └── pages/
│       ├── HomePage.jsx
│       ├── DirectoryPage.jsx
│       ├── ListingDetailPage.jsx  # Map, claim, bookmark, SEO
│       ├── ClaimPage.jsx          # Business claim form
│       ├── BookmarksPage.jsx
│       ├── NewsPage.jsx
│       ├── PostDetailPage.jsx
│       ├── ChatPage.jsx           # Realtime, rooms, images
│       ├── LoginPage.jsx
│       ├── ProfilePage.jsx        # Push toggle, PWA install
│       ├── SubmitListingPage.jsx  # GPS, WhatsApp, cover
│       └── AdminPage.jsx          # Analytics, claims, all tabs
├── supabase/
│   └── functions/
│       └── telegram-notify/   # Edge Function
├── supabase-schema.sql        # Complete DB schema + RLS
├── .env.example
└── README.md
```

---

## 📦 Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + Vite + TailwindCSS |
| Fonts | Pyidaungsu (Myanmar) + Syne (Display) + DM Sans |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Realtime | Supabase Realtime (Chat) |
| Images | Cloudinary CDN |
| Maps | OpenStreetMap via Leaflet.js (free) |
| Charts | Chart.js (CDN) |
| Notifications | Web Push API + Supabase Edge Function |
| Telegram | Bot API via Edge Function |
| PWA | Service Worker + Web App Manifest |
| i18n | Custom LangContext (Myanmar/English) |
| Router | React Router v6 |
| Icons | Lucide React |
| Deploy | Vercel / Netlify |

---

Made with ❤️ for Taunggyi • Cherry Directory v2
