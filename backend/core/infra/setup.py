from dataclasses import dataclass
from pathlib import Path

from core.adapters.local_midi import LocalMidiFileAdapter
from core.adapters.persistence.sqlite_music_repository import SqliteMusicPieceRepository
from core.app.music import LocalMidiLibraryHandler, MusicCommandHandler, MusicQueryHandler


@dataclass(frozen=True)
class MusicState:
    command: MusicCommandHandler
    query: MusicQueryHandler
    local_library: LocalMidiLibraryHandler


@dataclass(frozen=True)
class AppContainer:
    music: MusicState


def init_app_container(state_path: str | None = None) -> AppContainer:
    path = Path(state_path) if state_path else default_state_path()
    pieces = SqliteMusicPieceRepository(path)
    music_command = MusicCommandHandler(pieces)
    local_midi = LocalMidiFileAdapter(pieces)
    return AppContainer(
        music=MusicState(
            command=music_command,
            query=MusicQueryHandler(pieces),
            local_library=LocalMidiLibraryHandler(
                scanner=local_midi,
                watcher=local_midi,
                parser=local_midi,
                pieces=pieces,
                music_command=music_command,
            ),
        )
    )


def default_state_path() -> Path:
    return Path(__file__).resolve().parents[2] / ".local" / "app.db"
