from nba_api.stats.endpoints import scoreboardv2, boxscoretraditionalv3
import json

# Try a different date just in case
date_str = '11/17/2025'
print(f"Checking games for {date_str}...")
board = scoreboardv2.ScoreboardV2(game_date=date_str)
games_df = board.game_header.get_data_frame()

if not games_df.empty:
    game_id = games_df.iloc[0]['GAME_ID']
    print(f"Fetching box score for Game ID: {game_id} using V3")
    
    try:
        box = boxscoretraditionalv3.BoxScoreTraditionalV3(game_id=game_id)
        # Print raw dictionary keys to see what's inside
        data = box.get_dict()
        print("Response keys:", data.keys())
        
        if 'boxScoreTraditional' in data:
            print("Found 'boxScoreTraditional' key.")
            print("Keys inside 'boxScoreTraditional':", data['boxScoreTraditional'].keys())
        else:
            print("Full response:", json.dumps(data, indent=2))
            
    except Exception as e:
        print(f"Error: {e}")
else:
    print("No games found.")
