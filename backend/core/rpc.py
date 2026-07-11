import json
import sys
from typing import Any

from core.app.app_error import AppError
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
        container.music.local_library.refresh_if_dirty()
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
    return {
        "pieceId": piece.id.value,
        "title": piece.title,
        "tempoBpm": tempo,
        "timeSignature": time_signature,
        "totalBeats": total_beats,
        "notes": [
            {
                "id": f"{index}-{note.pitch}-{note.start_beats:.4f}",
                "pitch": note.pitch,
                "startBeat": note.start_beats,
                "durationBeats": note.duration_beats,
                "velocity": note.velocity or 64,
                "track": note.track,
            }
            for index, note in enumerate(notes)
        ],
    }


if __name__ == "__main__":
    main()
