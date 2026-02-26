import main


def test_daily_deck_falls_back_to_scoreboard_ids_and_builds_pairs(monkeypatch):
    main._cache.clear()

    monkeypatch.setattr(main, "_get_games_for_date", lambda _: [])
    monkeypatch.setattr(main, "_get_today_scoreboard_game_ids", lambda: (["g1", "g2"], ""))
    monkeypatch.setattr(main.random, "shuffle", lambda items: None)

    players_by_game = {
        "g1": [
            {"PLAYER_ID": 1, "PLAYER_NAME": "A"},
            {"PLAYER_ID": 2, "PLAYER_NAME": "B"},
        ],
        "g2": [
            {"PLAYER_ID": 3, "PLAYER_NAME": "C"},
            {"PLAYER_ID": 4, "PLAYER_NAME": "D"},
        ],
    }
    monkeypatch.setattr(main, "_fetch_box_score", lambda gid: players_by_game[gid])

    result = main.daily_deck("2025-11-18")

    assert len(result) == 2
    assert result[0]["player_left"]["PLAYER_ID"] == 1
    assert result[0]["player_right"]["PLAYER_ID"] == 2
    assert result[1]["player_left"]["PLAYER_ID"] == 3
    assert result[1]["player_right"]["PLAYER_ID"] == 4
