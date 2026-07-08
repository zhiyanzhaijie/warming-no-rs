import hashlib
import time
from dataclasses import dataclass

from core.app.app_error import AppError
from core.domain.music import ArrangementId, MusicPiece, MusicPieceId
from .command import (
    CreateMusicPieceCommand,
    ImportPianoArrangementCommand,
    MusicCommandHandler,
)
from .local_library_model import DiscoveredMidiFile, MidiScanReport
from .port import (
    LocalMidiScannerPort,
    LocalMidiScoreParserPort,
    LocalMidiWatcherPort,
    MusicPieceRepositoryPort,
)


@dataclass(frozen=True)
class RegisterLocalMidiFileCommand:
    file: DiscoveredMidiFile
    discovered_at: str


@dataclass(frozen=True)
class RegisterLocalMidiFileResult:
    piece: MusicPiece
    created: bool


class LocalMidiLibraryHandler:
    def __init__(
        self,
        scanner: LocalMidiScannerPort,
        watcher: LocalMidiWatcherPort,
        parser: LocalMidiScoreParserPort,
        pieces: MusicPieceRepositoryPort,
        music_command: MusicCommandHandler,
    ) -> None:
        self._scanner = scanner
        self._watcher = watcher
        self._parser = parser
        self._pieces = pieces
        self._music_command = music_command

    def add_watch_path(self, path: str) -> MidiScanReport:
        return self.add_watch_paths([path])

    def add_watch_paths(self, paths: list[str]) -> MidiScanReport:
        if not paths:
            return self.refresh_watched_paths()
        for path in paths:
            self._watcher.watch_path(path)
        return self.refresh_watched_paths()

    def list_watch_paths(self) -> list[str]:
        return self._watcher.watched_paths()

    def refresh_if_dirty(self) -> MidiScanReport | None:
        if not self._watcher.is_dirty():
            return None
        return self.refresh_watched_paths()

    def refresh_watched_paths(self) -> MidiScanReport:
        paths = self._watcher.watched_paths()
        discovered_files = 0
        registered_files = 0

        for path in paths:
            files = self._scanner.scan_path(path)
            discovered_files += len(files)
            for file in files:
                result = self.register_local_midi_file(
                    RegisterLocalMidiFileCommand(
                        file=file,
                        discovered_at=unix_timestamp_seconds(),
                    )
                )
                if result.created:
                    registered_files += 1

        self._watcher.clear_dirty()
        return MidiScanReport(
            watched_paths=paths,
            discovered_files=discovered_files,
            registered_files=registered_files,
        )

    def register_local_midi_file(
        self, command: RegisterLocalMidiFileCommand
    ) -> RegisterLocalMidiFileResult:
        piece_id = local_midi_piece_id(command.file.fingerprint)
        arrangement_id = local_midi_arrangement_id(command.file.fingerprint)
        existing = self._pieces.find_piece(piece_id)

        if existing and any(item.id == arrangement_id for item in existing.arrangements):
            return RegisterLocalMidiFileResult(piece=existing, created=False)

        try:
            score = self._parser.parse_score(command.file.path)
        except Exception as error:
            raise AppError.upstream(str(error)) from error

        if existing is None:
            piece = self._music_command.create_piece(
                CreateMusicPieceCommand(
                    piece_id=piece_id,
                    title=command.file.title,
                    creator=command.file.path,
                    now=command.discovered_at,
                )
            )
            created = True
        else:
            piece = existing
            created = False

        self._music_command.import_arrangement(
            ImportPianoArrangementCommand(
                piece_id=piece.id,
                arrangement_id=arrangement_id,
                title="MIDI import",
                source_path=command.file.path,
                fingerprint=command.file.fingerprint,
                score=score,
                now=command.discovered_at,
            )
        )
        updated = self._pieces.find_piece(piece.id) or piece
        return RegisterLocalMidiFileResult(piece=updated, created=created)


def local_midi_piece_id(fingerprint: str) -> MusicPieceId:
    digest = hashlib.sha256(fingerprint.encode("utf-8")).hexdigest()[:16]
    return MusicPieceId.parse(f"midi-{digest}")


def local_midi_arrangement_id(fingerprint: str) -> ArrangementId:
    digest = hashlib.sha256(fingerprint.encode("utf-8")).hexdigest()[:16]
    return ArrangementId.parse(f"midi-arrangement-{digest}")


def unix_timestamp_seconds() -> str:
    return str(int(time.time()))
