from dataclasses import dataclass

from core.domain.music import (
    ArrangementId,
    MusicPiece,
    MusicPieceId,
    PianoArrangement,
    PianoScore,
)
from core.app.app_error import AppError
from .port import MusicPieceRepositoryPort


@dataclass(frozen=True)
class CreateMusicPieceCommand:
    piece_id: MusicPieceId
    title: str
    creator: str | None
    now: str


@dataclass(frozen=True)
class ImportPianoArrangementCommand:
    piece_id: MusicPieceId
    arrangement_id: ArrangementId
    title: str
    source_path: str
    fingerprint: str
    score: PianoScore
    now: str


class MusicCommandHandler:
    def __init__(self, pieces: MusicPieceRepositoryPort) -> None:
        self._pieces = pieces

    def create_piece(self, command: CreateMusicPieceCommand) -> MusicPiece:
        title = command.title.strip()
        if not title:
            raise AppError.validation("music piece title is empty")
        if self._pieces.find_piece(command.piece_id):
            raise AppError.validation(f"music piece already exists: {command.piece_id.value}")

        piece = MusicPiece(
            id=command.piece_id,
            title=title,
            creator=command.creator.strip() if command.creator else None,
            created_at=command.now,
            updated_at=command.now,
        )
        self._pieces.save_piece(piece)
        return piece

    def delete_piece(self, piece_id: MusicPieceId) -> None:
        piece = self._pieces.find_piece(piece_id)
        if piece is None:
            raise AppError.not_found("music piece not found")
        source_paths = {
            arrangement.source_path for arrangement in piece.arrangements
        }
        matching_ids = [
            candidate.id
            for candidate in self._pieces.list_pieces()
            if any(
                arrangement.source_path in source_paths
                for arrangement in candidate.arrangements
            )
        ]
        for matching_id in matching_ids:
            self._pieces.delete_piece(matching_id)

    def import_arrangement(self, command: ImportPianoArrangementCommand) -> PianoArrangement:
        piece = self._pieces.find_piece(command.piece_id)
        if piece is None:
            raise AppError.not_found("music piece not found")

        title = command.title.strip()
        if not title:
            raise AppError.validation("arrangement title is empty")
        if command.score.note_count == 0:
            raise AppError.validation("arrangement score contains no notes")

        arrangement = PianoArrangement(
            id=command.arrangement_id,
            piece_id=command.piece_id,
            title=title,
            source_path=command.source_path,
            fingerprint=command.fingerprint,
            score=command.score,
        )
        piece.arrangements = [item for item in piece.arrangements if item.id != arrangement.id]
        piece.arrangements.append(arrangement)
        piece.updated_at = command.now
        self._pieces.save_piece(piece)
        return arrangement
