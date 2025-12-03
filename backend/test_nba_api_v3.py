from nba_api.stats.endpoints import scoreboardv2, boxscoretraditionalv3
import pandas as pd

# 1. Get Games for a specific date
date_str = '11/18/2025'
print(f"Checking games for {date_str}...")
board = scoreboardv2.ScoreboardV2(game_date=date_str)
games_df = board.game_header.get_data_frame()

if not games_df.empty:
    game_id = games_df.iloc[0]['GAME_ID']
    print(f"Fetching box score for Game ID: {game_id} using V3")
    
    try:
        box = boxscoretraditionalv3.BoxScoreTraditionalV3(game_id=game_id)
        # V3 might have different data sets. Let's list them.
        print("Available datasets:", box.get_available_data())
        
        # Try to get player stats
        if 'PlayerStats' in box.get_available_data():
            stats_df = box.player_stats.get_data_frame()
            print("Stats DataFrame:")
            print(stats_df.head())
            print("Columns:", stats_df.columns.tolist())
        else:
            print("PlayerStats not found in available data.")
            
    except Exception as e:
        print(f"Error: {e}")
else:
    print("No games found.")
