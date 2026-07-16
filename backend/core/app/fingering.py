from dataclasses import dataclass, replace
from datetime import datetime, timezone
from math import ceil
from typing import Protocol
from uuid import uuid4

from core.app.app_error import AppError
from core.app.music.port import MusicPieceRepositoryPort
from core.domain.fingering import (
    FingeringAnnotation,
    FingeringGenerationRequest,
    FingeringPatch,
)
from core.domain.music import MusicPieceId
from core.domain.piece_stages import PieceStagePlan


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


@dataclass(frozen=True)
class GenerateFingeringCommand:
    piece_id: MusicPieceId
    plan_id: str
    stage_id: str


class FingeringCommandHandler:
    def __init__(
        self,
        pieces: MusicPieceRepositoryPort,
        fingerings: FingeringRepositoryPort,
        stage_plans: PieceStagePlanQueryPort,
        agent: FingeringAgentPort,
    ) -> None:
        self._pieces = pieces
        self._fingerings = fingerings
        self._stage_plans = stage_plans
        self._agent = agent

    def generate(self, command: GenerateFingeringCommand) -> FingeringPatch:
        piece = self._pieces.find_piece(command.piece_id)
        if piece is None or not piece.arrangements:
            raise AppError.not_found("piece score not found")
        arrangement = piece.arrangements[0]
        score = arrangement.score
        plan = self._stage_plans.get_by_id(
            command.plan_id,
            arrangement.id.value,
            arrangement.fingerprint,
        )
        if plan is None:
            raise AppError.not_found("piece stage plan not found")
        stage = plan.stage(command.stage_id)
        if stage is None:
            raise AppError.not_found("piece stage not found")

        beats_per_measure = _beats_per_measure(score.meters[0] if score.meters else "4/4")
        total_beats = max(
            (note.start_beats + note.duration_beats for note in score.notes),
            default=0.0,
        )
        measure_count = max(1, ceil(total_beats / beats_per_measure))
        if stage.start_measure > measure_count or stage.end_measure > measure_count:
            raise AppError.validation("fingering measure range exceeds score")

        start_beat = (stage.start_measure - 1) * beats_per_measure
        end_beat = min(total_beats, stage.end_measure * beats_per_measure)
        context_start = max(0.0, start_beat - beats_per_measure)
        context_end = min(total_beats, end_beat + beats_per_measure)
        existing = self._fingerings.list_for_plan(
            plan.id,
            arrangement.fingerprint,
        )
        request = FingeringGenerationRequest(
            plan_id=plan.id,
            stage_id=stage.id,
            arrangement_id=arrangement.id.value,
            score_fingerprint=arrangement.fingerprint,
            score=score,
            start_measure=stage.start_measure,
            end_measure=stage.end_measure,
            start_beat=start_beat,
            end_beat=end_beat,
            context_start_beat=context_start,
            context_end_beat=context_end,
            existing=tuple(existing),
        )
        try:
            patch = self._agent.generate(request)
        except ValueError as error:
            raise AppError.validation(str(error)) from error

        revision_id = uuid4().hex
        updated_at = datetime.now(timezone.utc).isoformat()
        annotations = [
            replace(annotation, revision_id=revision_id, updated_at=updated_at)
            for annotation in patch.annotations
        ]
        selected_note_ids = {
            note.id
            for note in score.notes
            if start_beat <= note.start_beats < end_beat
        }
        self._fingerings.replace_for_notes(
            plan.id,
            selected_note_ids,
            annotations,
        )
        return replace(patch, annotations=tuple(annotations))


class FingeringQueryHandler:
    def __init__(self, fingerings: FingeringRepositoryPort) -> None:
        self._fingerings = fingerings

    def list_for_plan(
        self,
        plan_id: str,
        score_fingerprint: str,
    ) -> list[FingeringAnnotation]:
        return self._fingerings.list_for_plan(
            plan_id,
            score_fingerprint,
        )


def _beats_per_measure(time_signature: str) -> float:
    try:
        numerator_text, denominator_text = time_signature.split("/", maxsplit=1)
        numerator = int(numerator_text)
        denominator = int(denominator_text)
    except (ValueError, TypeError):
        return 4.0
    if numerator <= 0 or denominator <= 0:
        return 4.0
    return numerator * (4.0 / denominator)
