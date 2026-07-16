from dataclasses import dataclass, replace
from datetime import datetime, timezone
from math import ceil
from typing import Protocol
from uuid import uuid4

from core.app.app_error import AppError
from core.app.music.port import MusicPieceRepositoryPort
from core.domain.llm_settings import LlmSettings
from core.domain.music import MusicPieceId, PianoScore
from core.domain.piece_stages import PieceStage, PieceStagePlan, validate_stage_coverage


class PieceStageRepositoryPort(Protocol):
    def list(
        self,
        arrangement_id: str,
        score_fingerprint: str,
    ) -> list[PieceStagePlan]: ...

    def get_active(
        self,
        arrangement_id: str,
        score_fingerprint: str,
    ) -> PieceStagePlan | None: ...

    def get_by_id(
        self,
        plan_id: str,
        arrangement_id: str,
        score_fingerprint: str,
    ) -> PieceStagePlan | None: ...

    def save_new(self, plan: PieceStagePlan) -> None: ...

    def replace(self, plan: PieceStagePlan) -> None: ...

    def delete(self, plan_id: str, arrangement_id: str) -> bool: ...

    def activate(self, plan_id: str, arrangement_id: str) -> None: ...


class PieceStageAnalyzerPort(Protocol):
    def analyze(
        self,
        title: str,
        score: PianoScore,
        settings: LlmSettings,
        api_key: str,
        instruction: str,
    ) -> tuple[PieceStage, ...]: ...


class LlmSettingsQueryPort(Protocol):
    def get(self) -> LlmSettings: ...

    def get_api_key(self) -> str | None: ...


@dataclass(frozen=True)
class AnalyzePieceStagesCommand:
    piece_id: MusicPieceId
    plan_id: str | None = None
    name: str | None = None
    prompt: str | None = None
    activate: bool = True


@dataclass(frozen=True)
class DeletePieceStagePlanCommand:
    piece_id: MusicPieceId
    plan_id: str


@dataclass(frozen=True)
class ActivatePieceStagePlanCommand:
    piece_id: MusicPieceId
    plan_id: str


class PieceStageHandler:
    def __init__(
        self,
        pieces: MusicPieceRepositoryPort,
        stages: PieceStageRepositoryPort,
        analyzer: PieceStageAnalyzerPort,
        llm_settings: LlmSettingsQueryPort,
    ) -> None:
        self._pieces = pieces
        self._stages = stages
        self._analyzer = analyzer
        self._llm_settings = llm_settings

    def list(self, piece_id: MusicPieceId) -> list[PieceStagePlan]:
        arrangement = self._arrangement(piece_id)
        return self._stages.list(arrangement.id.value, arrangement.fingerprint)

    def get(self, piece_id: MusicPieceId) -> PieceStagePlan | None:
        arrangement = self._arrangement(piece_id)
        return self._stages.get_active(arrangement.id.value, arrangement.fingerprint)

    def get_by_id(
        self,
        piece_id: MusicPieceId,
        plan_id: str,
    ) -> PieceStagePlan | None:
        arrangement = self._arrangement(piece_id)
        return self._stages.get_by_id(
            plan_id,
            arrangement.id.value,
            arrangement.fingerprint,
        )

    def analyze(self, command: AnalyzePieceStagesCommand) -> PieceStagePlan:
        piece = self._pieces.find_piece(command.piece_id)
        if piece is None or not piece.arrangements:
            raise AppError.not_found("piece score not found")
        api_key = self._llm_settings.get_api_key()
        if not api_key:
            raise AppError.validation("请先配置 API Key")

        arrangement = piece.arrangements[0]
        existing = None
        if command.plan_id:
            existing = self._stages.get_by_id(
                command.plan_id,
                arrangement.id.value,
                arrangement.fingerprint,
            )
            if existing is None:
                raise AppError.not_found("piece stage plan not found")

        name = (command.name if command.name is not None else existing.name if existing else "默认方案").strip()
        if not name:
            raise AppError.validation("分段方案名称不能为空")
        prompt = command.prompt if command.prompt is not None else existing.segmentation_prompt if existing else ""
        settings = self._llm_settings.get()
        try:
            stages = self._analyzer.analyze(
                title=piece.title,
                score=arrangement.score,
                settings=settings,
                api_key=api_key,
                instruction=prompt,
            )
            stages = tuple(replace(stage, id=uuid4().hex) for stage in stages)
            validate_stage_coverage(stages, _measure_count(arrangement.score))
        except ValueError as error:
            raise AppError.validation(str(error)) from error
        except Exception as error:
            raise AppError.upstream(f"分段 Agent 调用失败：{str(error)[:300]}") from error

        now = datetime.now(timezone.utc).isoformat()
        plan = PieceStagePlan(
            id=existing.id if existing else uuid4().hex,
            arrangement_id=arrangement.id.value,
            score_fingerprint=arrangement.fingerprint,
            name=name,
            segmentation_prompt=prompt,
            model=settings.model,
            generation=existing.generation + 1 if existing else 1,
            stages=stages,
            created_at=existing.created_at if existing else now,
            analyzed_at=now,
            is_active=command.activate or (existing.is_active if existing else False),
        )
        if existing:
            self._stages.replace(plan)
        else:
            self._stages.save_new(plan)
        return plan

    def delete(self, command: DeletePieceStagePlanCommand) -> bool:
        arrangement = self._arrangement(command.piece_id)
        return self._stages.delete(command.plan_id, arrangement.id.value)

    def activate(self, command: ActivatePieceStagePlanCommand) -> PieceStagePlan:
        arrangement = self._arrangement(command.piece_id)
        plan = self._stages.get_by_id(
            command.plan_id,
            arrangement.id.value,
            arrangement.fingerprint,
        )
        if plan is None:
            raise AppError.not_found("piece stage plan not found")
        self._stages.activate(plan.id, arrangement.id.value)
        return replace(plan, is_active=True)

    def _arrangement(self, piece_id: MusicPieceId):
        piece = self._pieces.find_piece(piece_id)
        if piece is None or not piece.arrangements:
            raise AppError.not_found("piece score not found")
        return piece.arrangements[0]


def _measure_count(score: PianoScore) -> int:
    total_beats = max(
        (note.start_beats + note.duration_beats for note in score.notes),
        default=0.0,
    )
    beats_per_measure = _beats_per_measure(score.meters[0] if score.meters else "4/4")
    return max(1, ceil(total_beats / beats_per_measure))


def _beats_per_measure(time_signature: str) -> float:
    try:
        numerator_text, denominator_text = time_signature.split("/", maxsplit=1)
        numerator = int(numerator_text)
        denominator = int(denominator_text)
    except (TypeError, ValueError):
        return 4.0
    if numerator <= 0 or denominator <= 0:
        return 4.0
    return numerator * (4.0 / denominator)
