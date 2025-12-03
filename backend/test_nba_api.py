from nba_api.stats.endpoints import scoreboardv2, boxscoretraditionalv2
import pandas as pd

# 1. Get Games for a specific date
date_str = '11/18/2025'
print(f"Checking games for {date_str}...")
board = scoreboardv2.ScoreboardV2(game_date=date_str)
games_df = board.game_header.get_data_frame()
print(games_df)

if not games_df.empty:
    game_id = games_df.iloc[0]['GAME_ID']
    print(f"Fetching box score for Game ID: {game_id}")
    
    try:
        box = boxscoretraditionalv2.BoxScoreTraditionalV2(game_id=game_id)
        stats_df = box.player_stats.get_data_frame()
        print("Stats DataFrame:")
        print(stats_df)
        
        if stats_df.empty:
            print("Stats DataFrame is empty!")
            # Try to print the raw response if possible, or check other data sets
            print("Available datasets:", box.get_available_data())
    except Exception as e:
        print(f"Error: {e}")
else:
    print("No games found.")
