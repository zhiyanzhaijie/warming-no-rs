from core.domain.fingering import FingeringAnnotation

from .port import FingeringRepositoryPort


class FingeringQueryHandler:
    def __init__(self, fingerings: FingeringRepositoryPort) -> None:
        self._fingerings = fingerings

    def list_for_plan(
        self,
        plan_id: str,
        score_fingerprint: str,
    ) -> list[FingeringAnnotation]:
        return self._fingerings.list_for_plan(plan_id, score_fingerprint)
