from typing import Protocol

from core.app.music.port import MusicPieceRepositoryPort
from core.domain.fingering import FingeringAnnotation
from core.domain.piece_stages import PieceStagePlan

from .policy import FingeringGenerationRequest, FingeringPatch


class FingeringRepositoryPort(Protocol):
    def list_for_plan(
        self,
        plan_id: str,
        score_fingerprint: str,
    ) -> list[FingeringAnnotation]: ...

    def replace_for_notes(
        self,
        plan_id: str,
        note_ids: set[str],
        annotations: list[FingeringAnnotation],
    ) -> None: ...


class FingeringAgentPort(Protocol):
    def generate(self, request: FingeringGenerationRequest) -> FingeringPatch: ...


class PieceStagePlanQueryPort(Protocol):
    def get_by_id(
        self,
        plan_id: str,
        arrangement_id: str,
        score_fingerprint: str,
    ) -> PieceStagePlan | None: ...


__all__ = [
    "FingeringAgentPort",
    "FingeringRepositoryPort",
    "MusicPieceRepositoryPort",
    "PieceStagePlanQueryPort",
]
