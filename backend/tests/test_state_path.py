from pathlib import Path

from core.infra.setup import default_state_path


def test_default_state_path_uses_host_configured_path(
    monkeypatch,
    tmp_path: Path,
) -> None:
    configured_path = tmp_path / "warming" / "app.db"
    monkeypatch.setenv("WARMING_STATE_PATH", str(configured_path))

    assert default_state_path() == configured_path
