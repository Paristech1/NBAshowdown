# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

NBA Daily Showdown — a React + Vite frontend (port 5173) with a FastAPI Python backend (port 8000). No database; the backend fetches live NBA stats from `stats.nba.com` via the `nba_api` Python package. See `README.md` for full details.

### Running services

- **Backend**: `cd backend && uvicorn main:app --reload --port 8000`
- **Frontend**: `cd frontend && npm run dev`
- **Lint**: `cd frontend && npm run lint`
- **Build**: `cd frontend && npm run build`

### Important caveats

- **NBA API unreachable from cloud VMs**: `stats.nba.com` blocks requests from datacenter IPs. The TLS handshake succeeds but the response never arrives (hangs indefinitely). Use the `/api/mock-deck` endpoint instead of `/api/daily-deck` when testing in cloud environments. To use mock data, temporarily change the fetch URL in `App.jsx` from `api/daily-deck` to `api/mock-deck`.
- **`~/.local/bin` must be on PATH**: pip installs `uvicorn` and `fastapi` CLI to `~/.local/bin`. Run `export PATH="$HOME/.local/bin:$PATH"` before starting the backend, or ensure it's in your shell profile.
- **CORS**: Backend reads `ALLOWED_ORIGINS` env var (comma-separated). Defaults to `http://localhost:5173,http://localhost:3000`.
- **Caching**: Backend caches API responses for 30 minutes. Restart the backend to clear the cache.
- **PWA**: The frontend is configured as a PWA with `vite-plugin-pwa`. Service worker is only active in production builds (`npm run build && npm run preview`), not in dev mode.
