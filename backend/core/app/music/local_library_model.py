from dataclasses import dataclass


@dataclass(frozen=True)
class DiscoveredMidiFile:
    path: str
    title: str
    fingerprint: str
    size_bytes: int
    modified_at: str


@dataclass(frozen=True)
class MidiScanReport:
    watched_paths: list[str]
    discovered_files: int
    registered_files: int
    updated_files: int = 0
