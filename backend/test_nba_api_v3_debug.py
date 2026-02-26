import main


def test_get_target_date_prefers_today_when_scoreboard_has_final(monkeypatch):
    monkeypatch.setattr(main, "_get_today_scoreboard_game_ids", lambda: (["001"], "2025-11-18"))
    monkeypatch.setattr(main, "datetime", _FixedDateTime)

    target = main.get_target_date()

    assert target == "11/18/2025"


class _FixedDateTime:
    @classmethod
    def now(cls):
        from datetime import datetime

        return datetime(2025, 11, 18)
