# The Caddy 🏌️

A full-stack mobile golf social platform. Track live scores, plan golf trips, and connect with your golf crew.

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile | React Native + Expo (TypeScript) |
| Navigation | Expo Router (file-based) |
| Backend | Node.js + Express (TypeScript) |
| Database | PostgreSQL + Prisma ORM |
| Auth | Email OTP + JWT (no passwords) |
| Real-time | Socket.io (live leaderboard) |
| File Storage | Cloudinary |

## Monorepo Structure

```
/the-caddy
  /apps
    /api        ← Express API
    /mobile     ← Expo React Native app
  /packages
    /shared     ← Shared TypeScript types
```

## Quick Start

### 1. Prerequisites

- Node.js 18+
- PostgreSQL running locally
- Yarn (workspaces)

### 2. Install dependencies

```bash
yarn install
```

### 3. Set up the API

```bash
cp apps/api/.env.example apps/api/.env
# Edit .env with your DB credentials, SMTP, Cloudinary keys

cd apps/api
yarn db:generate    # Generate Prisma client
yarn db:migrate     # Run migrations (creates DB tables)
yarn db:seed        # Seed with demo data (6 players, 1 event, 1 round, scores, itinerary, social posts)
```

### 4. Start the API

```bash
# From root
yarn dev:api

# API runs on http://localhost:4000
```

### 5. Start the mobile app

```bash
# From root
yarn dev:mobile

# Opens Expo Go on your phone or simulator
```

> **Physical device**: Update `apps/mobile/constants/api.ts` — change `localhost` to your machine's local IP (e.g., `192.168.1.100`).

---

## Features

### 5 Tab Screens

| Tab | Description |
|---|---|
| **Home** | Active event hero card, live leaderboard preview (top 5), quick-access admin button |
| **Schedule** | Rounds list with course photos, expandable 18-hole scorecards, color-coded scores |
| **Itinerary** | Trip activities grouped by day with map links, photos, type icons |
| **Social** | Friends / Discover dual feed, post with photo/video, likes, course tagging |
| **History** | Hall of Champions, year filter, photo galleries, tournament recaps |

### Additional Screens

- `/leaderboard` — Full live leaderboard, net/gross toggle, Socket.io auto-updates
- `/round/[id]` — 18-hole scorecard, color-coded by score type, inline score entry for scorekeepers
- `/profile/[id]` — Avatar, bio, handicap, career stats (eagles/birdies/pars), round history, follow button
- `/event/[id]` — Event detail, participants, RSVP accept/decline
- `/event/create` — Create new event (scorekeepers+)
- `/admin` — Admin hub
- `/admin/scores` — Per-hole score entry grid
- `/admin/rounds` — Create/manage rounds
- `/admin/players` — Edit player names & handicaps
- `/admin/history` — Add past tournament results

### Auth Flow

```
User enters email → POST /api/auth/request-otp → 6-digit code sent via email
→ User enters code → POST /api/auth/verify-otp → JWT returned → stored in AsyncStorage
```

### Score Color Coding

| Type | Color |
|---|---|
| Eagle (−2 or better) | Blue |
| Birdie (−1) | Green |
| Par (E) | Off-white |
| Bogey (+1) | Orange |
| Double bogey+ | Red |

### Roles

| Role | Permissions |
|---|---|
| `USER` | Read-only, follow/social |
| `SCOREKEEPER` | Manage rounds, enter scores, create events |
| `SUPER_ADMIN` | Full access including history management |

---

## API Endpoints

| Method | Path | Auth |
|---|---|---|
| POST | `/api/auth/request-otp` | — |
| POST | `/api/auth/verify-otp` | — |
| GET | `/api/users/:id` | — |
| PUT | `/api/users/:id` | ✓ |
| GET | `/api/users/:id/stats` | — |
| POST | `/api/users/:id/follow` | ✓ |
| DELETE | `/api/users/:id/follow` | ✓ |
| GET | `/api/events` | — |
| POST | `/api/events` | SCOREKEEPER+ |
| GET | `/api/events/:id` | — |
| PUT | `/api/events/:id` | SCOREKEEPER+ |
| POST | `/api/events/:id/invite` | SCOREKEEPER+ |
| PUT | `/api/events/:id/respond` | ✓ |
| GET | `/api/events/:id/leaderboard` | — |
| GET | `/api/events/:id/itinerary` | — |
| POST | `/api/rounds` | SCOREKEEPER+ |
| GET | `/api/rounds/:id` | — |
| GET | `/api/rounds/:id/scorecard` | — |
| POST | `/api/scores` | SCOREKEEPER+ |
| GET | `/api/posts?feed=friends\|discover` | ✓ |
| POST | `/api/posts` | ✓ |
| POST | `/api/posts/:id/like` | ✓ |
| DELETE | `/api/posts/:id` | ✓ |
| POST | `/api/itinerary` | SCOREKEEPER+ |
| PUT | `/api/itinerary/:id` | SCOREKEEPER+ |
| DELETE | `/api/itinerary/:id` | SCOREKEEPER+ |
| GET | `/api/history` | — |
| POST | `/api/history` | SUPER_ADMIN |
| PUT | `/api/history/:id` | SUPER_ADMIN |

---

## Environment Variables (API)

```env
DATABASE_URL=postgresql://user:password@localhost:5432/the_caddy
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=The Caddy <noreply@thecaddy.app>
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
PORT=4000
CLIENT_URL=http://localhost:8081
```

## Design System

- **Primary**: Forest green `#1B4332`
- **Accent**: Gold `#D4AF37`
- **Text**: Off-white `#F5F5DC`
- **Cards**: Dark green `#1a3d2b` with subtle gold border
- All UI components in `apps/mobile/components/ui/`
