from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from nba_api.stats.endpoints import scoreboardv2, boxscoretraditionalv3
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
import os
import random
import time
import threading

# --- Constants ---
DAYS_LOOKBACK = 7
TOP_PLAYERS_PER_TEAM = 6
API_DELAY_SECONDS = 0.6
CACHE_TTL_SECONDS = 1800  # 30 minutes

app = FastAPI()

# Bug 5: Read CORS origins from environment variable
allowed_origins = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:3000"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in allowed_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Bug 7: Simple TTL cache
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


def get_target_date():
    """
    Finds the most recent date with NBA games.
    Checks up to DAYS_LOOKBACK days back to handle off-days.
    """
    today = datetime.now()

    for days_back in range(1, DAYS_LOOKBACK + 1):
        check_date = today - timedelta(days=days_back)
        date_str = check_date.strftime('%m/%d/%Y')

        try:
            board = scoreboardv2.ScoreboardV2(game_date=date_str, timeout=15)
            games_df = board.game_header.get_data_frame()

            if not games_df.empty:
                print(f"Found {len(games_df)} games on {date_str}")
                return date_str
        except Exception as e:
            print(f"Error checking {date_str}: {e}")
            continue

    return (today - timedelta(days=1)).strftime('%m/%d/%Y')


def _fetch_box_score(game_id):
    """Fetch box score for a single game, returns list of player dicts."""
    players_out = []
    try:
        time.sleep(API_DELAY_SECONDS)
        box = boxscoretraditionalv3.BoxScoreTraditionalV3(game_id=game_id, timeout=30)
        data = box.get_dict()

        if 'boxScoreTraditional' not in data:
            print(f"No box score data for {game_id}")
            return players_out

        bs = data['boxScoreTraditional']
        teams = [bs['homeTeam'], bs['awayTeam']]

        for team in teams:
            team_id = team['teamId']
            team_abbr = team['teamTricode']
            team_players = []

            for p in team.get('players', []):
                stats = p.get('statistics', {})
                minutes = stats.get('minutes', '')

                if not minutes or minutes == "00:00":
                    continue

                try:
                    pts = int(stats.get('points', 0))
                    reb = int(stats.get('reboundsTotal', 0))
                    ast = int(stats.get('assists', 0))
                    stl = int(stats.get('steals', 0))
                    blk = int(stats.get('blocks', 0))
                    tov = int(stats.get('turnovers', 0))
                    plus_minus = float(stats.get('plusMinusPoints', 0))

                    fg_pct = 0.0
                    fga = int(stats.get('fieldGoalsAttempted', 0))
                    fgm = int(stats.get('fieldGoalsMade', 0))
                    if fga > 0:
                        fg_pct = round(fgm / fga * 100, 1)

                    tp_pct = 0.0
                    tpa = int(stats.get('threePointersAttempted', 0))
                    tpm = int(stats.get('threePointersMade', 0))
                    if tpa > 0:
                        tp_pct = round(tpm / tpa * 100, 1)

                    ft_pct = 0.0
                    fta = int(stats.get('freeThrowsAttempted', 0))
                    ftm = int(stats.get('freeThrowsMade', 0))
                    if fta > 0:
                        ft_pct = round(ftm / fta * 100, 1)

                    composite = pts + reb * 1.2 + ast * 1.5

                    player_obj = {
                        'PLAYER_ID': p['personId'],
                        'PLAYER_NAME': f"{p['firstName']} {p['familyName']}",
                        'TEAM_ID': team_id,
                        'TEAM_ABBREVIATION': team_abbr,
                        'PTS': pts,
                        'REB': reb,
                        'AST': ast,
                        'STL': stl,
                        'BLK': blk,
                        'TOV': tov,
                        'FG_PCT': fg_pct,
                        'TP_PCT': tp_pct,
                        'FT_PCT': ft_pct,
                        'PLUS_MINUS': plus_minus,
                        'MIN': minutes,
                        '_composite': composite,
                    }
                    team_players.append(player_obj)
                except (ValueError, TypeError):
                    continue

            # Bug 2: Top 6 by composite score instead of top 3 by PTS
            top = sorted(team_players, key=lambda x: x['_composite'], reverse=True)[:TOP_PLAYERS_PER_TEAM]
            for p in top:
                del p['_composite']
            players_out.extend(top)

    except Exception as e:
        print(f"Error fetching game {game_id}: {e}")
        import traceback
        traceback.print_exc()

    return players_out


@app.get("/api/daily-deck")
def daily_deck(date: str = Query(default=None, description="Date in YYYY-MM-DD format")):
    # Feature 5: Accept optional date query parameter
    if date:
        try:
            parsed = datetime.strptime(date, "%Y-%m-%d")
            target_date = parsed.strftime('%m/%d/%Y')
        except ValueError:
            return {"message": "Invalid date format. Use YYYY-MM-DD.", "pairs": []}
    else:
        target_date = get_target_date()

    # Bug 7: Check cache first
    cache_key = f"daily_deck_{target_date}"
    cached = _cache_get(cache_key)
    if cached is not None:
        print(f"Cache hit for {target_date}")
        return cached

    print(f"Fetching games for: {target_date}")

    board = scoreboardv2.ScoreboardV2(game_date=target_date, timeout=15)
    games_df = board.game_header.get_data_frame()

    if games_df.empty:
        return {"message": f"No games found for {target_date}.", "pairs": []}

    game_ids = games_df['GAME_ID'].unique().tolist()

    # Bug 1: Process ALL games using ThreadPoolExecutor instead of capping at 5
    player_pool = []
    with ThreadPoolExecutor(max_workers=3) as executor:
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
            'id': i,
            'player_left': player_pool[i],
            'player_right': player_pool[i + 1]
        })

    print(f"Generated {len(pairs)} pairs from {len(game_ids)} games.")

    # Bug 7: Store in cache
    _cache_set(cache_key, pairs)

    return pairs
