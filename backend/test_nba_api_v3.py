import main


class _FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self._payload


def test_fetch_box_score_builds_expected_player_shape(monkeypatch):
    payload = {
        "game": {
            "homeTeam": {
                "teamId": 1,
                "teamTricode": "HOM",
                "players": [
                    {
                        "personId": 11,
                        "firstName": "Home",
                        "familyName": "Star",
                        "statistics": {
                            "minutes": "PT33M07S",
                            "points": 30,
                            "reboundsTotal": 10,
                            "assists": 5,
                            "steals": 2,
                            "blocks": 1,
                            "turnovers": 3,
                            "plusMinusPoints": 7,
                            "fieldGoalsAttempted": 20,
                            "fieldGoalsMade": 10,
                            "threePointersAttempted": 8,
                            "threePointersMade": 4,
                            "freeThrowsAttempted": 5,
                            "freeThrowsMade": 4,
                        },
                    },
                    {
                        "personId": 12,
                        "firstName": "Bench",
                        "familyName": "Guy",
                        "statistics": {"minutes": "PT00M00.00S"},
                    },
                ],
            },
            "awayTeam": {
                "teamId": 2,
                "teamTricode": "AWY",
                "players": [
                    {
                        "personId": 21,
                        "firstName": "Away",
                        "familyName": "Star",
                        "statistics": {
                            "minutes": "35:00",
                            "points": 20,
                            "reboundsTotal": 5,
                            "assists": 6,
                            "steals": 1,
                            "blocks": 0,
                            "turnovers": 1,
                            "plusMinusPoints": -2,
                            "fieldGoalsAttempted": 10,
                            "fieldGoalsMade": 5,
                            "threePointersAttempted": 4,
                            "threePointersMade": 2,
                            "freeThrowsAttempted": 2,
                            "freeThrowsMade": 1,
                        },
                    }
                ],
            },
        }
    }

    monkeypatch.setattr(main.requests, "get", lambda *args, **kwargs: _FakeResponse(payload))

    players = main._fetch_box_score("game-id")

    assert len(players) == 2
    home_player = next(p for p in players if p["TEAM_ABBREVIATION"] == "HOM")
    assert home_player["PLAYER_NAME"] == "Home Star"
    assert home_player["MIN"] == "33:07"
    assert home_player["FG_PCT"] == 50.0
    assert home_player["TP_PCT"] == 50.0
    assert home_player["FT_PCT"] == 80.0
