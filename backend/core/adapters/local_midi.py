import os
import threading
from pathlib import Path

from core.app.music.local_library_model import DiscoveredMidiFile
from core.domain.music import PianoScore, ScorePart
from core.adapters.persistence.json_music_repository import JsonMusicPieceRepository


class LocalMidiFileAdapter:
    def __init__(self, repository: JsonMusicPieceRepository) -> None:
        self._repository = repository
        self._lock = threading.RLock()
        self._known_fingerprints: dict[str, str] = {}
        self._dirty = True

    def scan_path(self, path: str) -> list[DiscoveredMidiFile]:
        root = normalize_path(path)
        files = [root] if root.is_file() else collect_midi_files(root)
        discovered = [discovered_midi_file(file) for file in files if is_valid_midi_file(file)]
        discovered.sort(key=lambda item: item.path)
        return discovered

    def watch_path(self, path: str) -> None:
        normalized = normalize_path(path)
        paths = self._repository.list_watch_paths()
        value = str(normalized)
        if value not in paths:
            paths.append(value)
            self._repository.save_watch_paths(paths)
        with self._lock:
            self._dirty = True

    def watched_paths(self) -> list[str]:
        return self._repository.list_watch_paths()

    def is_dirty(self) -> bool:
        snapshot = self._snapshot_watched_paths()
        with self._lock:
            if snapshot != self._known_fingerprints:
                self._dirty = True
                self._known_fingerprints = snapshot
            return self._dirty

    def clear_dirty(self) -> None:
        with self._lock:
            self._dirty = False

    def parse_score(self, path: str) -> PianoScore:
        file = Path(path)
        if not is_valid_midi_file(file):
            raise ValueError(f"not a valid MIDI file: {path}")
        return parse_midi_score(file.read_bytes())

    def _snapshot_watched_paths(self) -> dict[str, str]:
        snapshot: dict[str, str] = {}
        for path in self.watched_paths():
            try:
                root = normalize_path(path)
                files = [root] if root.is_file() else collect_midi_files(root)
            except ValueError:
                continue
            for file in files:
                discovered = discovered_midi_file(file)
                snapshot[discovered.path] = discovered.fingerprint
        return snapshot


def normalize_path(value: str) -> Path:
    value = value.strip()
    if not value:
        raise ValueError("path is empty")
    path = Path(value).expanduser().resolve()
    if not path.exists():
        raise ValueError(f"path does not exist: {path}")
    if not path.is_dir() and not path.is_file():
        raise ValueError(f"path is not a directory or file: {path}")
    return path


def collect_midi_files(directory: Path) -> list[Path]:
    files: list[Path] = []
    for root, _, filenames in os.walk(directory):
        for filename in filenames:
            path = Path(root) / filename
            if is_valid_midi_file(path):
                files.append(path)
    return files


def is_valid_midi_file(path: Path) -> bool:
    if path.suffix.lower() not in {".mid", ".midi"}:
        return False
    try:
        with path.open("rb") as file:
            return file.read(4) == b"MThd"
    except OSError:
        return False


def discovered_midi_file(path: Path) -> DiscoveredMidiFile:
    stat = path.stat()
    return DiscoveredMidiFile(
        path=str(path),
        title=path.stem.strip() or str(path),
        fingerprint=f"{path}:{stat.st_size}:{int(stat.st_mtime)}",
        size_bytes=stat.st_size,
        modified_at=str(int(stat.st_mtime)),
    )


def parse_midi_score(bytes_: bytes) -> PianoScore:
    if len(bytes_) < 14 or not bytes_.startswith(b"MThd"):
        raise ValueError("MIDI header is invalid")
    header_len = int.from_bytes(bytes_[4:8], "big")
    if header_len < 6:
        raise ValueError("MIDI header length is invalid")
    track_count = int.from_bytes(bytes_[10:12], "big")
    note_count = count_midi_note_on_events(bytes_)
    if note_count == 0:
        raise ValueError("MIDI contains no note events")
    parts = [
        ScorePart(name=f"Track {index + 1}", note_count=0)
        for index in range(track_count)
    ] or [ScorePart(name="Track 1", note_count=0)]
    parts[0] = ScorePart(name=parts[0].name, note_count=note_count)
    return PianoScore(
        parts=parts,
        tempos=[120.0],
        meters=["4/4"],
    )


def count_midi_note_on_events(bytes_: bytes) -> int:
    count = 0
    for index in range(len(bytes_) - 2):
        status = bytes_[index]
        if 0x90 <= status <= 0x9F and bytes_[index + 2] > 0:
            count += 1
    return count
