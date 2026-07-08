from core.domain.music import MusicPiece, MusicPieceId
from .port import MusicPieceRepositoryPort


class MusicQueryHandler:
    def __init__(self, pieces: MusicPieceRepositoryPort) -> None:
        self._pieces = pieces

    def get_piece(self, piece_id: MusicPieceId) -> MusicPiece | None:
        return self._pieces.find_piece(piece_id)

    def list_pieces(self) -> list[MusicPiece]:
        return self._pieces.list_pieces()
