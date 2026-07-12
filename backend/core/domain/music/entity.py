from dataclasses import dataclass, field

from .value_object import ArrangementId, MusicPieceId


@dataclass(frozen=True)
class NoteEvent:
    id: str
    pitch: int
    start_beats: float
    duration_beats: float
    velocity: int | None = None
    track: int = 0
    channel: int = 0
    hand: str = "unknown"
    hand_confidence: float = 0.0


@dataclass(frozen=True)
class ScorePart:
    track: int
    name: str
    note_count: int = 0
    instrument_name: str | None = None
    channels: tuple[int, ...] = ()
    hand: str = "unknown"
    hand_confidence: float = 0.0


@dataclass(frozen=True)
class PianoScore:
    parts: list[ScorePart] = field(default_factory=list)
    notes: list[NoteEvent] = field(default_factory=list)
    tempos: list[float] = field(default_factory=list)
    meters: list[str] = field(default_factory=list)
    hand_analysis_version: str | None = None

    @property
    def note_count(self) -> int:
        if self.notes:
            return len(self.notes)
        return sum(part.note_count for part in self.parts)


@dataclass(frozen=True)
class PianoArrangement:
    id: ArrangementId
    piece_id: MusicPieceId
    title: str
    source_path: str
    fingerprint: str
    score: PianoScore


@dataclass
class MusicPiece:
    id: MusicPieceId
    title: str
    creator: str | None = None
    arrangements: list[PianoArrangement] = field(default_factory=list)
    created_at: str = ""
    updated_at: str = ""
