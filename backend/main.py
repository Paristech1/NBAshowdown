from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
import os
import random
import time
import threading
import requests

# --- Constants ---
DAYS_LOOKBACK = 7
TOP_PLAYERS_PER_TEAM = 6
CACHE_TTL_SECONDS = 1800  # 30 minutes

NBA_CDN_BASE = "https://cdn.nba.com/static/json"
SCOREBOARD_URL = f"{NBA_CDN_BASE}/liveData/scoreboard/todaysScoreboard_00.json"
BOXSCORE_URL = f"{NBA_CDN_BASE}/liveData/boxscore/boxscore_{{game_id}}.json"
SCHEDULE_URL = f"{NBA_CDN_BASE}/staticData/scheduleLeagueV2.json"

HTTP_TIMEOUT = 15

app = FastAPI()

allowed_origins = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:3000,https://*.vercel.app"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in allowed_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- TTL cache ---
_cache = {}
_cache_lock = threading.Lock()


def _cache_get(key):
    with _cache_lock:
        entry = _cache.get(key)
        if entry is None:
            return None
        data, ts = entry
        if time.time() - ts > CACHE_TTL_SECONDS:
            del _cache[key]
            return None
        return data


def _cache_set(key, data):
    with _cache_lock:
        _cache[key] = (data, time.time())


# --- Schedule cache (loaded once per app lifetime, refreshed hourly) ---
_schedule_cache = {"data": None, "ts": 0}
_schedule_lock = threading.Lock()


def _get_schedule():
    with _schedule_lock:
        if _schedule_cache["data"] and time.time() - _schedule_cache["ts"] < 3600:
            return _schedule_cache["data"]
    try:
        resp = requests.get(SCHEDULE_URL, timeout=HTTP_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
        game_dates = data.get("leagueSchedule", {}).get("gameDates", [])
        with _schedule_lock:
            _schedule_cache["data"] = game_dates
            _schedule_cache["ts"] = time.time()
        return game_dates
    except Exception as e:
        print(f"Error fetching schedule: {e}")
        with _schedule_lock:
            return _schedule_cache["data"] or []


def _get_games_for_date(target_date_str):
    """
    Find game IDs for a given date (MM/DD/YYYY format).
    Uses the CDN schedule endpoint which lists all season games.
    Schedule dates are formatted as 'MM/DD/YYYY 00:00:00'.
    """
    game_dates = _get_schedule()

    target_dt = datetime.strptime(target_date_str, "%m/%d/%Y")
    target_normalized = target_dt.strftime("%m/%d/%Y")

    for gd in game_dates:
        raw_date = gd.get("gameDate", "")
        gd_date = raw_date.split(" ")[0] if " " in raw_date else raw_date

        if gd_date == target_normalized:
            games = gd.get("games", [])
            finished = [g for g in games if g.get("gameStatus") == 3]
            return [g["gameId"] for g in finished]

    return []


def _get_today_scoreboard_game_ids():
    """Get game IDs from today's live scoreboard (includes in-progress and final)."""
    try:
        resp = requests.get(SCOREBOARD_URL, timeout=HTTP_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
        games = data.get("scoreboard", {}).get("games", [])
        final_games = [g for g in games if g.get("gameStatus") == 3]
        return [g["gameId"] for g in final_games], data.get("scoreboard", {}).get("gameDate", "")
    except Exception as e:
        print(f"Error fetching scoreboard: {e}")
        return [], ""


def get_target_date():
    """
    Find the most recent date with completed NBA games.
    Checks today's scoreboard first, then walks back through the schedule.
    """
    game_ids, game_date = _get_today_scoreboard_game_ids()
    if game_ids:
        today = datetime.now()
        return today.strftime("%m/%d/%Y")

    today = datetime.now()
    for days_back in range(1, DAYS_LOOKBACK + 1):
        check_date = today - timedelta(days=days_back)
        date_str = check_date.strftime("%m/%d/%Y")
        ids = _get_games_for_date(date_str)
        if ids:
            print(f"Found {len(ids)} completed games on {date_str}")
            return date_str

    return (today - timedelta(days=1)).strftime("%m/%d/%Y")


def _fetch_box_score(game_id):
    """Fetch box score for a single game from NBA CDN. Returns list of player dicts."""
    players_out = []
    try:
        url = BOXSCORE_URL.format(game_id=game_id)
        resp = requests.get(url, timeout=HTTP_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()

        game = data.get("game", {})
        if not game:
            print(f"No game data for {game_id}")
            return players_out

        for team_key in ["homeTeam", "awayTeam"]:
            team = game.get(team_key, {})
            team_id = team.get("teamId", 0)
            team_abbr = team.get("teamTricode", "???")
            team_players = []

            for p in team.get("players", []):
                stats = p.get("statistics", {})
                minutes = stats.get("minutes", "")
                if not minutes or minutes.startswith("PT00M") or minutes == "00:00":
                    continue

                try:
                    min_str = minutes
                    if minutes.startswith("PT"):
                        mins = minutes.replace("PT", "").replace("M", ":").replace("S", "").rstrip(".")
                        parts = mins.split(":")
                        if len(parts) >= 2:
                            min_str = f"{int(float(parts[0]))}:{int(float(parts[1])):02d}"
                        else:
                            min_str = minutes

                    pts = int(stats.get("points", 0))
                    reb = int(stats.get("reboundsTotal", 0))
                    ast = int(stats.get("assists", 0))
                    stl = int(stats.get("steals", 0))
                    blk = int(stats.get("blocks", 0))
                    tov = int(stats.get("turnovers", 0))
                    plus_minus = float(stats.get("plusMinusPoints", 0))

                    fga = int(stats.get("fieldGoalsAttempted", 0))
                    fgm = int(stats.get("fieldGoalsMade", 0))
                    fg_pct = round(fgm / fga * 100, 1) if fga > 0 else 0.0

                    tpa = int(stats.get("threePointersAttempted", 0))
                    tpm = int(stats.get("threePointersMade", 0))
                    tp_pct = round(tpm / tpa * 100, 1) if tpa > 0 else 0.0

                    fta = int(stats.get("freeThrowsAttempted", 0))
                    ftm = int(stats.get("freeThrowsMade", 0))
                    ft_pct = round(ftm / fta * 100, 1) if fta > 0 else 0.0

                    composite = pts + reb * 1.2 + ast * 1.5

                    player_obj = {
                        "PLAYER_ID": p.get("personId", 0),
                        "PLAYER_NAME": f"{p.get('firstName', '')} {p.get('familyName', '')}".strip(),
                        "TEAM_ID": team_id,
                        "TEAM_ABBREVIATION": team_abbr,
                        "PTS": pts,
                        "REB": reb,
                        "AST": ast,
                        "STL": stl,
                        "BLK": blk,
                        "TOV": tov,
                        "FG_PCT": fg_pct,
                        "TP_PCT": tp_pct,
                        "FT_PCT": ft_pct,
                        "PLUS_MINUS": plus_minus,
                        "MIN": min_str,
                        "_composite": composite,
                    }
                    team_players.append(player_obj)
                except (ValueError, TypeError):
                    continue

            top = sorted(team_players, key=lambda x: x["_composite"], reverse=True)[:TOP_PLAYERS_PER_TEAM]
            for p in top:
                del p["_composite"]
            players_out.extend(top)

    except Exception as e:
        print(f"Error fetching box score for {game_id}: {e}")
        import traceback
        traceback.print_exc()

    return players_out


@app.get("/api/daily-deck")
def daily_deck(date: str = Query(default=None, description="Date in YYYY-MM-DD format")):
    if date:
        try:
            parsed = datetime.strptime(date, "%Y-%m-%d")
            target_date = parsed.strftime("%m/%d/%Y")
        except ValueError:
            return {"message": "Invalid date format. Use YYYY-MM-DD.", "pairs": []}
    else:
        target_date = get_target_date()

    cache_key = f"daily_deck_{target_date}"
    cached = _cache_get(cache_key)
    if cached is not None:
        print(f"Cache hit for {target_date}")
        return cached

    print(f"Fetching games for: {target_date}")

    game_ids = _get_games_for_date(target_date)

    if not game_ids:
        ids_today, _ = _get_today_scoreboard_game_ids()
        if ids_today:
            game_ids = ids_today

    if not game_ids:
        return {"message": f"No completed games found for {target_date}.", "pairs": []}

    print(f"Found {len(game_ids)} completed games, fetching box scores...")

    player_pool = []
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(_fetch_box_score, gid): gid for gid in game_ids}
        for future in as_completed(futures):
            try:
                player_pool.extend(future.result())
            except Exception as e:
                print(f"Error in thread for {futures[future]}: {e}")

    random.shuffle(player_pool)

    pairs = []
    for i in range(0, len(player_pool) - 1, 2):
        pairs.append({
            "id": i,
            "player_left": player_pool[i],
            "player_right": player_pool[i + 1],
        })

    print(f"Generated {len(pairs)} pairs from {len(game_ids)} games ({len(player_pool)} players).")

    _cache_set(cache_key, pairs)

    return pairs
