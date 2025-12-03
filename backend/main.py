from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from nba_api.stats.endpoints import scoreboardv2, boxscoretraditionalv3
from datetime import datetime, timedelta
import pandas as pd
import random
import time

app = FastAPI()

# Allow React to communicate with Python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_target_date():
    """
    Intelligently finds the most recent date with NBA games.
    Checks up to 7 days back to handle off-days, weekends, etc.
    """
    today = datetime.now()
    
    # Check up to 7 days back for games
    for days_back in range(1, 8):
        check_date = today - timedelta(days=days_back)
        date_str = check_date.strftime('%m/%d/%Y')
        
        try:
            # Quick check if games exist on this date
            board = scoreboardv2.ScoreboardV2(game_date=date_str)
            games_df = board.game_header.get_data_frame()
            
            if not games_df.empty:
                print(f"Found {len(games_df)} games on {date_str}")
                return date_str
        except Exception as e:
            print(f"Error checking {date_str}: {e}")
            continue
    
    # Fallback to yesterday if no games found
    return (today - timedelta(days=1)).strftime('%m/%d/%Y')

@app.get("/api/daily-deck")
def daily_deck():
    target_date = get_target_date()
    print(f"Fetching games for: {target_date}")
    
    # 1. Get Games
    board = scoreboardv2.ScoreboardV2(game_date=target_date)
    games_df = board.game_header.get_data_frame()
    
    if games_df.empty:
        return {"message": f"No games found. Checked back 7 days from today.", "pairs": []}

    # Filter for completed games just in case
    game_ids = games_df['GAME_ID'].unique().tolist()
    
    player_pool = []

    # 2. Get Box Scores for each game
    # Note: We limit to first 5 games to prevent API timeouts during demo
    for game_id in game_ids[:5]: 
        print(f"Processing Game ID: {game_id}...")
        try:
            box = boxscoretraditionalv3.BoxScoreTraditionalV3(game_id=game_id)
            data = box.get_dict()
            
            if 'boxScoreTraditional' not in data:
                print(f"No box score data for {game_id}")
                continue
                
            bs = data['boxScoreTraditional']
            teams = [bs['homeTeam'], bs['awayTeam']]
            
            for team in teams:
                team_id = team['teamId']
                team_abbr = team['teamTricode']
                players = team.get('players', [])
                
                team_players = []
                for p in players:
                    stats = p.get('statistics', {})
                    minutes = stats.get('minutes', '')
                    
                    # Filter: Played more than 0 minutes (simple check)
                    if not minutes or minutes == "00:00":
                        continue
                        
                    # Extract stats
                    try:
                        pts = int(stats.get('points', 0))
                        reb = int(stats.get('reboundsTotal', 0))
                        ast = int(stats.get('assists', 0))
                        
                        player_obj = {
                            'PLAYER_ID': p['personId'],
                            'PLAYER_NAME': f"{p['firstName']} {p['familyName']}",
                            'TEAM_ID': team_id,
                            'TEAM_ABBREVIATION': team_abbr,
                            'PTS': pts,
                            'REB': reb,
                            'AST': ast,
                            'MIN': minutes
                        }
                        team_players.append(player_obj)
                    except (ValueError, TypeError):
                        continue

                # Get top 3 players per team based on Points (PTS)
                top_team_players = sorted(team_players, key=lambda x: x['PTS'], reverse=True)[:3]
                player_pool.extend(top_team_players)
            
            # Be nice to the API
            time.sleep(0.6) 
        except Exception as e:
            print(f"Error fetching game {game_id}: {e}")
            import traceback
            traceback.print_exc()
            continue

    # 3. Shuffle and Create Pairs
    random.shuffle(player_pool)
    
    pairs = []
    # Create pairs
    for i in range(0, len(player_pool) - 1, 2):
        pairs.append({
            'id': i, # Unique ID for React keys
            'player_left': player_pool[i],
            'player_right': player_pool[i+1]
        })

    print(f"Generated {len(pairs)} pairs.")
    return pairs
