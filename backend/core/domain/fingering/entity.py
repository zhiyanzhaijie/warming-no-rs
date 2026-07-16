from dataclasses import dataclass

from .value_object import FingeringSource, FingeringStatus, Hand


@dataclass(frozen=True)
class FingeringAnnotation:
    plan_id: str
    stage_id: str
    arrangement_id: str
    score_fingerprint: str
    note_id: str
    hand: Hand
    finger: int
    source: FingeringSource = "agent"
    status: FingeringStatus = "suggested"
    confidence: float = 0.0
    revision_id: str = ""
    updated_at: str = ""

    def __post_init__(self) -> None:
        if self.finger < 1 or self.finger > 5:
            raise ValueError("finger must be between 1 and 5")

    @property
    def label(self) -> str:
        prefix = "L" if self.hand == "left" else "R"
        return f"{prefix}{self.finger}"
