# NBA Daily Showdown — QA + Performance Plan (App-Specific)

This plan is tailored to the current app architecture:
- **Frontend:** React + Vite SPA (single main game screen).
- **Backend:** FastAPI endpoint `GET /api/daily-deck` with CDN-backed NBA data fetch and in-memory TTL cache.
- **Data source:** `cdn.nba.com` live scoreboard/schedule/boxscore endpoints.

---

## 1) Test-based definition of done

### Functional requirements (current app)

1. `GET /api/daily-deck` returns:
   - A **list of matchup pairs** on success.
   - A **JSON error payload** with `message` + `pairs: []` for invalid date format.
2. Date handling:
   - `date=YYYY-MM-DD` is accepted.
   - Invalid format is rejected gracefully (no 500 crash).
3. Fallback behavior:
   - If schedule lookup has no completed games for target date, backend attempts today scoreboard finals.
4. Cache behavior:
   - Repeated same-date requests within TTL return cached payload.
5. Resilience:
   - Upstream NBA CDN failures are handled without backend process crash.

### Non-functional requirements

1. API latency budgets (container env, warm cache):
   - `p50 < 150ms`
   - `p95 < 400ms`
2. Reliability:
   - Endpoint returns either valid success shape or controlled JSON error shape for >= 99% of requests.
3. Frontend web vitals guardrail (CI/preview):
   - Lighthouse: Desktop >= 90, Mobile >= 85 for main page.
4. Security baseline:
   - Production build has no source maps.
   - Defensive headers present (`nosniff`, `DENY`, HSTS).

---

## 2) QA suite (mapped to this repo)

### Unit/logic tests (backend pytest)

Existing suite should cover and continue to enforce:
- Completed-game filtering from schedule.
- Invalid date rejection path.
- Box score parsing + stat normalization.
- Target-date selection from scoreboard.
- `daily_deck` fallback and pairing generation.
- Cache reuse for same request parameters.

### API/security tests

Add/maintain tests for:
- Security headers middleware behavior:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Strict-Transport-Security` set

### Frontend quality checks

Per PR:
- `npm run lint`
- `npm run build`
- `npm run predeploy:security`

Nightly / pre-release:
- Lighthouse CI on root route (`/`) with score threshold gates.

### Load/performance checks

Run k6 (or equivalent) against `/api/daily-deck`:
- 20 VUs for 10m warm-cache scenario.
- Assert p95 and error-rate thresholds.

---

## 3) CI gate proposal

Required pass checks before deployment:
1. `cd backend && pytest -q`
2. `cd frontend && npm run lint`
3. `cd frontend && npm run build`
4. `cd frontend && npm run predeploy:security`
5. (Release gate) k6 load test summary attached.
6. (Release gate) Lighthouse report attached.

If any threshold fails, deployment is blocked.

---

## 4) Production test cadence

- **Every PR:** unit + lint + build + security scripts.
- **Daily:** smoke check `/api/daily-deck` for response shape.
- **Before release:** load test + Lighthouse report.
- **After release:** monitor p50/p95 latency and error-rate dashboard for 24h.

---

## 5) Notes specific to current implementation

- `daily_deck` currently returns a list for success but an object for invalid/no-data paths. Keep frontend parsing defensive until response schema is unified.
- In-memory TTL cache is per-process; horizontal scaling or restarts invalidate cache.
- Upstream latency/availability from NBA CDN is the largest external dependency; monitor separately from app compute time.
