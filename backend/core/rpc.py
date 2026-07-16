import json
import sys
from typing import Any

from core.app.app_error import AppError
from core.app.fingering import GenerateFingeringCommand
from core.app.piece_stages import (
    ActivatePieceStagePlanCommand,
    AnalyzePieceStagesCommand,
    DeletePieceStagePlanCommand,
)
from core.domain.music import MusicPiece, MusicPieceId
from core.infra.setup import init_app_container


container = init_app_container()


def main() -> None:
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        response = handle_line(line)
        sys.stdout.write(json.dumps(response, ensure_ascii=False) + "\n")
        sys.stdout.flush()


def handle_line(line: str) -> dict[str, Any]:
    request_id = None
    try:
        request = json.loads(line)
        request_id = request.get("id")
        result = dispatch(request.get("method"), request.get("params") or {})
        return {"id": request_id, "ok": True, "result": result}
    except AppError as error:
        return {"id": request_id, "ok": False, "error": error.message}
    except Exception as error:
        return {"id": request_id, "ok": False, "error": str(error)}


def dispatch(method: str, params: dict[str, Any]) -> Any:
    if method == "music_list_pieces":
        return [piece_response(piece) for piece in container.music.query.list_pieces()]
    if method == "music_get_piece":
        piece = container.music.query.get_piece(MusicPieceId.parse(params["piece_id"]))
        if piece is None:
            raise AppError.not_found("piece not found")
        return piece_response(piece)
    if method == "music_get_piece_score":
        piece = container.music.query.get_piece(MusicPieceId.parse(params["piece_id"]))
        if piece is None:
            raise AppError.not_found("piece not found")
        return piece_score_response(piece)
    if method == "music_generate_fingering":
        patch = container.fingering.command.generate(GenerateFingeringCommand(
            piece_id=MusicPieceId.parse(params["piece_id"]),
            plan_id=str(params["plan_id"]),
            stage_id=str(params["stage_id"]),
        ))
        return fingering_patch_response(patch)
    if method == "llm_get_settings":
        return llm_settings_response(
            container.agent.llm_settings.get(),
            container.agent.llm_settings.has_api_key(),
        )
    if method == "llm_save_settings":
        settings = container.agent.llm_settings.save(
            base_url=str(params["base_url"]),
            model=str(params["model"]),
            api_key=str(params.get("api_key", "")),
        )
        return llm_settings_response(
            settings,
            container.agent.llm_settings.has_api_key(),
        )
    if method == "llm_clear_api_key":
        container.agent.llm_settings.clear_api_key()
        return {"apiKeyConfigured": False}
    if method == "llm_test_connection":
        result = container.agent.llm_settings.test_connection(
            base_url=str(params["base_url"]),
            model=str(params["model"]),
            api_key=str(params["api_key"]),
        )
        return {
            "connected": True,
            "model": result.model,
            "latencyMs": result.latency_ms,
        }
    if method == "music_get_stage_plan":
        plan = container.agent.piece_stages.get(
            MusicPieceId.parse(params["piece_id"])
        )
        return piece_stage_plan_response(plan)
    if method == "music_list_stage_plans":
        plans = container.agent.piece_stages.list(
            MusicPieceId.parse(params["piece_id"])
        )
        return [piece_stage_plan_response(plan) for plan in plans]
    if method == "music_analyze_stages":
        plan = container.agent.piece_stages.analyze(AnalyzePieceStagesCommand(
            piece_id=MusicPieceId.parse(params["piece_id"]),
            plan_id=str(params["plan_id"]) if params.get("plan_id") else None,
            name=str(params["name"]) if params.get("name") is not None else None,
            prompt=str(params["prompt"]) if params.get("prompt") is not None else None,
        ))
        return piece_stage_plan_response(plan)
    if method == "music_activate_stage_plan":
        plan = container.agent.piece_stages.activate(ActivatePieceStagePlanCommand(
            piece_id=MusicPieceId.parse(params["piece_id"]),
            plan_id=str(params["plan_id"]),
        ))
        return piece_stage_plan_response(plan)
    if method == "music_delete_stage_plan":
        deleted = container.agent.piece_stages.delete(DeletePieceStagePlanCommand(
            piece_id=MusicPieceId.parse(params["piece_id"]),
            plan_id=str(params["plan_id"]),
        ))
        return {"deleted": deleted}
    if method == "music_delete_piece":
        container.music.command.delete_piece(MusicPieceId.parse(params["piece_id"]))
        return {"deleted": True}
    if method == "music_list_watch_paths":
        return {"paths": container.music.local_library.list_watch_paths()}
    if method == "music_add_watch_path":
        report = container.music.local_library.add_watch_path(params["path"])
        return scan_report_response(report)
    if method == "music_add_watch_paths":
        report = container.music.local_library.add_watch_paths(params["paths"])
        return scan_report_response(report)
    if method == "music_refresh_library":
        report = container.music.local_library.refresh_watched_paths()
        return scan_report_response(report)
    raise AppError.not_found(f"unknown rpc method: {method}")


def piece_response(piece: MusicPiece) -> dict[str, Any]:
    arrangement = piece.arrangements[0] if piece.arrangements else None
    score = arrangement.score if arrangement else None
    note_count = score.note_count if score else 0
    return {
        "id": piece.id.value,
        "title": piece.title,
        "composer": piece.creator or "Local MIDI",
        "level": "本地 MIDI",
        "durationSeconds": max(30, min(600, note_count // 4 if note_count else 30)),
        "keySignature": score.meters[0] if score and score.meters else "4/4",
        "bpm": int(score.tempos[0]) if score and score.tempos else 120,
        "progress": 0,
        "lastPracticedAt": piece.updated_at,
        "mistakeHotspots": [],
        "sourcePath": arrangement.source_path if arrangement else None,
        "arrangementCount": len(piece.arrangements),
        "noteCount": note_count,
    }


def scan_report_response(report: Any) -> dict[str, Any]:
    return {
        "watchedPaths": report.watched_paths,
        "discoveredFiles": report.discovered_files,
        "registeredFiles": report.registered_files,
        "updatedFiles": report.updated_files,
    }


def piece_score_response(piece: MusicPiece) -> dict[str, Any]:
    arrangement = piece.arrangements[0] if piece.arrangements else None
    score = arrangement.score if arrangement else None
    notes = score.notes if score else []
    tempo = int(score.tempos[0]) if score and score.tempos else 120
    time_signature = score.meters[0] if score and score.meters else "4/4"
    total_beats = max(
        (note.start_beats + note.duration_beats for note in notes),
        default=0,
    )
    active_plan = (
        container.agent.piece_stages.get(piece.id)
        if arrangement else None
    )
    annotations = {
        annotation.note_id: annotation
        for annotation in (
            container.fingering.query.list_for_plan(
                active_plan.id,
                arrangement.fingerprint,
            )
            if arrangement and active_plan else []
        )
    }
    return {
        "pieceId": piece.id.value,
        "title": piece.title,
        "tempoBpm": tempo,
        "timeSignature": time_signature,
        "totalBeats": total_beats,
        "handAnalysisVersion": score.hand_analysis_version if score else None,
        "handConfidence": (
            sum(note.hand_confidence for note in notes) / len(notes) if notes else 0
        ),
        "notes": [
            {
                "id": note.id or f"{index}-{note.pitch}-{note.start_beats:.4f}",
                "pitch": note.pitch,
                "startBeat": note.start_beats,
                "durationBeats": note.duration_beats,
                "velocity": note.velocity or 64,
                "track": note.track,
                "channel": note.channel,
                "hand": note.hand,
                "handConfidence": note.hand_confidence,
                "fingering": (
                    annotations[note.id].label if note.id in annotations else None
                ),
                "fingeringSource": (
                    annotations[note.id].source if note.id in annotations else None
                ),
                "fingeringConfidence": (
                    annotations[note.id].confidence if note.id in annotations else None
                ),
            }
            for index, note in enumerate(notes)
        ],
    }


def fingering_patch_response(patch: Any) -> dict[str, Any]:
    return {
        "planId": patch.plan_id,
        "stageId": patch.stage_id,
        "arrangementId": patch.arrangement_id,
        "startMeasure": patch.start_measure,
        "endMeasure": patch.end_measure,
        "updatedCount": len(patch.annotations),
        "warnings": list(patch.warnings),
        "annotations": [
            {
                "noteId": annotation.note_id,
                "hand": annotation.hand,
                "finger": annotation.finger,
                "label": annotation.label,
                "confidence": annotation.confidence,
            }
            for annotation in patch.annotations
        ],
    }


def llm_settings_response(
    settings: Any,
    api_key_configured: bool,
) -> dict[str, Any]:
    return {
        "baseUrl": settings.base_url,
        "model": settings.model,
        "updatedAt": settings.updated_at,
        "apiKeyConfigured": api_key_configured,
    }


def piece_stage_plan_response(plan: Any) -> dict[str, Any] | None:
    if plan is None:
        return None
    return {
        "id": plan.id,
        "arrangementId": plan.arrangement_id,
        "name": plan.name,
        "segmentationPrompt": plan.segmentation_prompt,
        "model": plan.model,
        "generation": plan.generation,
        "isActive": plan.is_active,
        "analyzedAt": plan.analyzed_at,
        "stages": [
            {
                "id": stage.id,
                "startMeasure": stage.start_measure,
                "endMeasure": stage.end_measure,
                "label": stage.label,
                "reason": stage.reason,
            }
            for stage in plan.stages
        ],
    }


if __name__ == "__main__":
    main()
