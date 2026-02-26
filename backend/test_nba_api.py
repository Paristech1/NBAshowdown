import main


def test_get_games_for_date_returns_only_finished_games(monkeypatch):
    sample_dates = [
        {
            "gameDate": "11/18/2025 00:00:00",
            "games": [
                {"gameId": "001", "gameStatus": 1},
                {"gameId": "002", "gameStatus": 3},
                {"gameId": "003", "gameStatus": 3},
            ],
        }
    ]
    monkeypatch.setattr(main, "_get_schedule", lambda: sample_dates)

    game_ids = main._get_games_for_date("11/18/2025")

    assert game_ids == ["002", "003"]


def test_daily_deck_invalid_date_returns_message():
    result = main.daily_deck("2025-99-99")

    assert result == {"message": "Invalid date format. Use YYYY-MM-DD.", "pairs": []}


def test_daily_deck_uses_cache_for_same_date(monkeypatch):
    main._cache.clear()
    calls = {"count": 0}

    monkeypatch.setattr(main, "_get_games_for_date", lambda _: ["g1"])
    monkeypatch.setattr(main.random, "shuffle", lambda items: None)

    def _fake_fetch(_gid):
        calls["count"] += 1
        return [
            {"PLAYER_ID": 1, "PLAYER_NAME": "A"},
            {"PLAYER_ID": 2, "PLAYER_NAME": "B"},
        ]

    monkeypatch.setattr(main, "_fetch_box_score", _fake_fetch)

    first = main.daily_deck("2025-11-18")
    second = main.daily_deck("2025-11-18")

    assert calls["count"] == 1
    assert first == second
