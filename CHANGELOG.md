# NBA Daily Showdown — Development Changelog

> Sprint summary for PM standup. Covers all work completed on the app from initial state to current production-ready build.

---

## Starting Point

The app was a single-file React frontend (`App.jsx`) and a single-file FastAPI backend (`main.py`) with basic functionality: fetch NBA stats from `stats.nba.com` via the `nba_api` Python package, display two player cards side-by-side, let the user pick one, repeat until a winner is crowned. It had several hard limitations: only grabbed 5 games and 3 players per team, only showed PTS/REB/AST, no caching, no error handling, hardcoded CORS, and the data source (`stats.nba.com`) was blocked from any server/cloud environment.

---

## What Was Delivered

### 1. Data Source Migration (Critical)

**Problem:** `stats.nba.com` blocks all datacenter/cloud IPs. The app couldn't load data on any server — Vercel, AWS, Heroku, or any CI environment. Requests hung indefinitely.

**Solution:** Replaced the entire `nba_api` + `pandas` backend with NBA's public CDN (`cdn.nba.com/static/json/...`). Three endpoints now power the app:

| Endpoint | Purpose |
|---|---|
| `todaysScoreboard_00.json` | Today's live scoreboard + game IDs |
| `boxscore_{game_id}.json` | Full box score per game (all player stats) |
| `scheduleLeagueV2.json` | Full season schedule for historical date lookups |

**Result:** ~400ms response times (down from 30s+ timeouts), works from any environment, no API key needed, no rate limiting. Removed `nba_api` and `pandas` dependencies entirely — backend now only needs `fastapi`, `uvicorn`, `requests`.

---

### 2. Bug Fixes (7 total)

| # | Bug | Fix |
|---|---|---|
| 1 | Game limit hardcoded to 5 | Removed cap. All games processed via `ThreadPoolExecutor` with 5 concurrent workers |
| 2 | Only top 3 players per team by PTS | Now top 6 per team, ranked by composite score: `PTS + REB*1.2 + AST*1.5` |
| 3 | Missing stats (only PTS/REB/AST) | Added STL, BLK, TOV, FG%, 3P%, FT%, PLUS_MINUS, MIN to every player object |
| 4 | Broken headshot images for G-League players | `onError` fallback swaps to a silhouette placeholder SVG |
| 5 | CORS hardcoded to localhost | Reads from `ALLOWED_ORIGINS` env var, defaults to `localhost:5173,localhost:3000,*.vercel.app` |
| 6 | Game state lost on refresh | Full state persisted to `localStorage`; game resumes where you left off. Cleared on "Play Again" |
| 7 | No caching — every request re-hits API | 30-minute TTL cache with thread-safe dict. Instant loads after first fetch |

---

### 3. New Features (7 total)

**Feature 1: Expanded Stats Display**
- Primary stat grid now shows PTS, REB, AST, STL, BLK, +/- (was only PTS/REB/AST)
- Color coding: green border if above league average, red if below
- Collapsible "Full Stats" panel reveals FG%, 3P%, FT%, MIN, TOV on tap

**Feature 2: Game Score / Rating System**
- Every player gets a computed Performance Score: `PTS + REB*1.2 + AST*1.5 + STL*2 + BLK*2 - TOV*1.5`
- Displayed as a golden "GAME SCORE" badge on every card
- Winner screen shows Game Score vs Deck Average and the delta (+/-)

**Feature 3: Session History / Match Log**
- Every head-to-head matchup is tracked in state
- Winner screen displays "Path to Victory" — full log of every opponent beaten with scores
- Example: *Kyle Kuzma 31.3 beat Victor Wembanyama 33.6 → beat Jarrett Allen 46.2 → WINNER*
- Stored in localStorage so it persists across refreshes

**Feature 4: Social Media Sharing**
- Four branded share buttons on the winner screen:
  - **Twitter/X** — opens `x.com/intent/post` with pre-filled text including player, team, score, and #NBAShowdown
  - **Facebook** — opens `facebook.com/sharer/sharer.php` with quote text
  - **Reddit** — opens `reddit.com/submit` with title + self-text body
  - **Instagram** — generates a 1080x1080 branded share card (canvas-drawn with player name, team, game score, full stat line, date, branding) and downloads it as PNG for posting to stories/feed
- Hint text below buttons explains the Instagram flow

**Feature 5: Error Boundary + Loading Skeleton**
- React `ErrorBoundary` class component wraps the app — shows friendly message + Refresh button on crashes
- Loading state replaced plain "LOADING..." text with animated shimmer skeleton cards

**Feature 6: PWA (Progressive Web App)**
- `vite-plugin-pwa` configured with auto-update registration
- Web app manifest with NBA Showdown name, theme color, icons (192x192, 512x512)
- Workbox service worker with runtime caching for NBA CDN images and Fontshare fonts
- Offline fallback from cache when API is down

**Feature 7: Date Picker + Backend Query Param** *(built then removed from UI by request)*
- Backend `/api/daily-deck` accepts optional `?date=YYYY-MM-DD` query parameter
- Schedule lookup walks the full season schedule to find completed games for any date
- UI controls (date picker + team filter) were removed per product feedback — backend support remains for future use

---

### 4. Vercel Deployment Config

| File | Purpose |
|---|---|
| `vercel.json` | Builds (Vite static + Python serverless), routes, security headers |
| `api/index.py` | Thin serverless wrapper that imports FastAPI app from `backend/main.py` |
| `requirements.txt` (root) | Python deps for Vercel runtime |
| `vite.config.dev.js` | Dev config with `/api` proxy to `localhost:8000` |
| `vite.config.prod.js` | Prod config with sourcemap disabled, no proxy |
| `.env.production` | `GENERATE_SOURCEMAP=false` |

**Security headers configured:**
- `X-Frame-Options: DENY` — prevents clickjacking
- `X-Content-Type-Options: nosniff` — prevents MIME sniffing
- `Strict-Transport-Security` with `preload` — forces HTTPS
- `Content-Security-Policy` — scoped to `self`, NBA CDN, and Fontshare only
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` — blocks camera, microphone, geolocation

**Pre-deploy checks in `package.json`:**
- `check:sourcemaps` — fails build if `.map` files leak into production
- `check:secrets` — scans source for hardcoded API keys/passwords/tokens

---

### 5. Codebase Cleanup

- Added `backend/requirements.txt` (was missing entirely)
- Updated `README.md` with env var docs, new feature list, updated tech stack
- Created `AGENTS.md` with cloud-specific dev instructions for CI/agent environments
- Extracted magic numbers into named constants (`DAYS_LOOKBACK`, `TOP_PLAYERS_PER_TEAM`, `CACHE_TTL_SECONDS`, etc.)
- Frontend `API_BASE` changed from hardcoded `localhost:8000` to relative URLs — works on both local dev (via Vite proxy) and Vercel (same-origin)

---

## Files Changed

| File | Status | What |
|---|---|---|
| `backend/main.py` | **Rewritten** | NBA CDN data source, concurrent fetching, caching, env CORS, date param |
| `backend/requirements.txt` | **New** | `fastapi`, `uvicorn`, `requests` |
| `frontend/src/App.jsx` | **Rewritten** | All 7 features, error boundary, localStorage, social sharing |
| `frontend/src/App.css` | **Rewritten** | Expanded stats, game score badge, match log, share buttons, skeleton, responsive |
| `frontend/vite.config.dev.js` | **Modified** | Added dev proxy for `/api` |
| `frontend/vite.config.prod.js` | **New** | Prod build config (no sourcemaps) |
| `frontend/index.html` | **Modified** | Meta tags, apple-touch-icon, PWA, title |
| `frontend/package.json` | **Modified** | Added `vite-plugin-pwa`, security check scripts |
| `frontend/public/pwa-192x192.png` | **New** | PWA icon |
| `frontend/public/pwa-512x512.png` | **New** | PWA icon |
| `frontend/.env.production` | **New** | Disable sourcemaps in prod |
| `vercel.json` | **New** | Deployment config + security headers |
| `api/index.py` | **New** | Vercel serverless wrapper |
| `requirements.txt` (root) | **New** | Vercel Python runtime deps |
| `AGENTS.md` | **New** | Cloud dev environment instructions |
| `CHANGELOG.md` | **New** | This file |
| `README.md` | **Modified** | Updated features, tech stack, env var docs |

---

## What's Left / Suggested Next Steps

These items are not started. Listed in rough priority order for the next sprint:

1. **User accounts + login system** — auth (OAuth or email/password), user profiles, track pick history across sessions
2. **Database integration** — persist each user's Player of the Day picks, enable leaderboards
3. **Head-to-head multiplayer** — challenge friends, compare brackets in real-time
4. **Season-long leaderboards** — aggregate POTD picks across the season, rank users
5. **Custom domain** — point a real domain at the Vercel deployment
6. **Analytics** — add lightweight event tracking (picks, shares, session length)
7. **Accessibility audit** — keyboard navigation, screen reader support, ARIA labels
8. **Backend date endpoint in UI** — the backend already supports `?date=YYYY-MM-DD`; could re-add a minimal date picker if product wants historical showdowns

---

*Last updated: Feb 26, 2026*
