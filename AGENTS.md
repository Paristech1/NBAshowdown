# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

NBA Daily Showdown — a React + Vite frontend (port 5173) with a FastAPI Python backend (port 8000). No database; the backend fetches live NBA stats from NBA's public CDN (`cdn.nba.com`). See `README.md` for full details.

### Running services

- **Backend**: `cd backend && uvicorn main:app --reload --port 8000`
- **Frontend**: `cd frontend && npm run dev`
- **Lint**: `cd frontend && npm run lint`
- **Build**: `cd frontend && npm run build`

### Important caveats

- **`~/.local/bin` must be on PATH**: pip installs `uvicorn` and `fastapi` CLI to `~/.local/bin`. Run `export PATH="$HOME/.local/bin:$PATH"` before starting the backend, or ensure it's in your shell profile.
- **CORS**: Backend reads `ALLOWED_ORIGINS` env var (comma-separated). Defaults to `http://localhost:5173,http://localhost:3000`.
- **Caching**: Backend caches API responses for 30 minutes. Restart the backend to clear the cache.
- **Data source**: Uses NBA CDN endpoints (`cdn.nba.com/static/json/...`) which work reliably from any environment including cloud VMs. No API key needed.
- **PWA**: Service worker is only active in production builds (`npm run build && npm run preview`), not in dev mode.
