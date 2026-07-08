from pathlib import Path

from core.infra.setup import init_app_container


def minimal_midi() -> bytes:
    return (
        b"MThd"
        + (6).to_bytes(4, "big")
        + (0).to_bytes(2, "big")
        + (1).to_bytes(2, "big")
        + (96).to_bytes(2, "big")
        + b"MTrk"
        + (12).to_bytes(4, "big")
        + bytes([0x00, 0x90, 60, 64, 0x60, 0x80, 60, 0, 0x00, 0xFF, 0x2F, 0x00])
    )


def test_registers_midi_files_from_watch_path(tmp_path: Path) -> None:
    midi_dir = tmp_path / "midi"
    midi_dir.mkdir()
    (midi_dir / "piece.mid").write_bytes(minimal_midi())
    state_path = tmp_path / "state.json"

    container = init_app_container(str(state_path))
    report = container.music.local_library.add_watch_path(str(midi_dir))
    pieces = container.music.query.list_pieces()

    assert report.discovered_files == 1
    assert report.registered_files == 1
    assert len(pieces) == 1
    assert pieces[0].title == "piece"
