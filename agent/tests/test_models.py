from coach.models import PREFERENCES, choose


def test_prefers_newest_available():
    available = {"gpt-realtime", "gpt-realtime-2"}
    assert choose("realtime", available) == "gpt-realtime-2"


def test_falls_back_to_first_preference_when_list_unavailable():
    assert choose("realtime", None) == PREFERENCES["realtime"][0]


def test_env_override_wins_even_if_unlisted():
    assert choose("report", {"gpt-4o-mini"}, override="my-private-model") == "my-private-model"


def test_last_resort_when_nothing_matches():
    assert choose("tts", {"something-else"}) == PREFERENCES["tts"][-1]


def test_every_role_has_preferences():
    for role, prefs in PREFERENCES.items():
        assert prefs, role
        assert len(prefs) == len(set(prefs)), role
