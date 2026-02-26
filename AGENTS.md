# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

NBA Daily Showdown — a React + Vite frontend (port 5173) with a FastAPI Python backend (port 8000). No database; the backend fetches live NBA stats from `stats.nba.com` via the `nba_api` Python package. See `README.md` for full details.

### Running services

- **Backend**: `cd backend && uvicorn main:app --reload --port 8000`
- **Frontend**: `cd frontend && npm run dev`
- **Lint**: `cd frontend && npm run lint` (1 pre-existing `no-unused-vars` error on `motion` import in `App.jsx`)
- **Build**: `cd frontend && npm run build`

### Important caveats

- **NBA API unreachable from cloud VMs**: `stats.nba.com` blocks or rate-limits requests from datacenter IPs. The TLS handshake succeeds but the response never arrives (hangs indefinitely). The app will stay in "LOADING..." state. This is an external network limitation, not a code bug. To test the full game flow, run locally or use a proxy/VPN.
- **No `requirements.txt`**: Python backend dependencies (`fastapi uvicorn nba_api pandas`) are installed via pip directly. The update script handles this.
- **`~/.local/bin` must be on PATH**: pip installs `uvicorn` and `fastapi` CLI tools to `~/.local/bin`. The update script ensures this is on PATH.
- **Backend `get_target_date()` checks 7 days back**: Each check hits the NBA API, which compounds the timeout issue in cloud environments.
- **CORS**: Backend allows origins `localhost:5173` and `localhost:3000` only.
