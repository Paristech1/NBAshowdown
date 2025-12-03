import requests
import json

try:
    res = requests.get('http://localhost:8000/api/daily-deck')
    data = res.json()
    if len(data) > 0:
        print("First pair:")
        print(json.dumps(data[0], indent=2))
    else:
        print("No pairs returned.")
except Exception as e:
    print(f"Error: {e}")
