from nba_api.stats.endpoints import boxscoretraditionalv3
import pandas as pd

game_id = '0022500241' # From previous run
print(f"Fetching box score for Game ID: {game_id} using V3")

try:
    box = boxscoretraditionalv3.BoxScoreTraditionalV3(game_id=game_id)
    data = box.get_dict()
    
    home_team = data['boxScoreTraditional']['homeTeam']
    print("Home Team keys:", home_team.keys())
    
    if 'players' in home_team:
        players = home_team['players']
        print(f"Found {len(players)} players in home team.")
        if len(players) > 0:
            print("First player keys:", players[0].keys())
            print("First player sample:", players[0])
            
            # Check statistics structure
            if 'statistics' in players[0]:
                print("Statistics keys:", players[0]['statistics'].keys())
                print("Statistics sample:", players[0]['statistics'])
            
except Exception as e:
    print(f"Error: {e}")
