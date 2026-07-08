from typing import Protocol

from core.domain.music import MusicPiece, MusicPieceId, PianoScore
from .local_library_model import DiscoveredMidiFile


class MusicPieceRepositoryPort(Protocol):
    def save_piece(self, piece: MusicPiece) -> None: ...

    def find_piece(self, piece_id: MusicPieceId) -> MusicPiece | None: ...

    def list_pieces(self) -> list[MusicPiece]: ...


class LocalMidiScannerPort(Protocol):
    def scan_path(self, path: str) -> list[DiscoveredMidiFile]: ...


class LocalMidiWatcherPort(Protocol):
    def watch_path(self, path: str) -> None: ...

    def watched_paths(self) -> list[str]: ...

    def is_dirty(self) -> bool: ...

    def clear_dirty(self) -> None: ...


class LocalMidiScoreParserPort(Protocol):
    def parse_score(self, path: str) -> PianoScore: ...
