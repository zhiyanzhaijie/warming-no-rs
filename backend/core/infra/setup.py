import os
from dataclasses import dataclass
from pathlib import Path

from core.adapters.local_midi import LocalMidiFileAdapter
from core.adapters.langgraph_fingering_agent import LangGraphFingeringAgent
from core.adapters.openai_compatible_llm import OpenAiCompatibleLlmClient
from core.adapters.openai_stage_analyzer import OpenAiCompatibleStageAnalyzer
from core.adapters.persistence.sqlite_fingering_repository import SqliteFingeringRepository
from core.adapters.persistence.sqlite_encrypted_llm_secret_repository import SqliteEncryptedLlmSecretRepository
from core.adapters.persistence.sqlite_llm_settings_repository import SqliteLlmSettingsRepository
from core.adapters.persistence.sqlite_music_repository import SqliteMusicPieceRepository
from core.adapters.persistence.sqlite_piece_stage_repository import SqlitePieceStageRepository
from core.app.fingering import FingeringCommandHandler, FingeringQueryHandler
from core.app.llm_settings import LlmSettingsCommandHandler, LlmSettingsQueryHandler
from core.app.music import (
    DynamicProgrammingHandAssignment,
    HandAssignmentMigration,
    LocalMidiLibraryCommandHandler,
    LocalMidiLibraryQueryHandler,
    MusicCommandHandler,
    MusicQueryHandler,
    MusicScoreQueryHandler,
)
from core.app.piece_stages import PieceStageCommandHandler, PieceStageQueryHandler


@dataclass(frozen=True)
class MusicState:
    command: MusicCommandHandler
    query: MusicQueryHandler
    score_query: MusicScoreQueryHandler
    local_library: LocalMidiLibraryCommandHandler
    local_library_query: LocalMidiLibraryQueryHandler


@dataclass(frozen=True)
class FingeringState:
    command: FingeringCommandHandler
    query: FingeringQueryHandler


@dataclass(frozen=True)
class LlmSettingsState:
    command: LlmSettingsCommandHandler
    query: LlmSettingsQueryHandler


@dataclass(frozen=True)
class PieceStageState:
    command: PieceStageCommandHandler
    query: PieceStageQueryHandler


@dataclass(frozen=True)
class AgentState:
    llm_settings: LlmSettingsState
    piece_stages: PieceStageState


@dataclass(frozen=True)
class AppContainer:
    music: MusicState
    fingering: FingeringState
    agent: AgentState


def init_app_container(state_path: str | None = None) -> AppContainer:
    path = Path(state_path) if state_path else default_state_path()
    pieces = SqliteMusicPieceRepository(path)
    piece_stages = SqlitePieceStageRepository(path)
    fingerings = SqliteFingeringRepository(path)
    llm_settings = SqliteLlmSettingsRepository(path)
    llm_secrets = SqliteEncryptedLlmSecretRepository(
        database_path=path,
        master_key_path=path.parent / "llm-master.key",
    )
    hand_assignment = DynamicProgrammingHandAssignment()
    HandAssignmentMigration(pieces, hand_assignment).migrate()
    music_command = MusicCommandHandler(pieces)
    local_midi = LocalMidiFileAdapter(pieces)
    llm_settings_command = LlmSettingsCommandHandler(
        settings_repository=llm_settings,
        secret_repository=llm_secrets,
        client=OpenAiCompatibleLlmClient(),
    )
    llm_settings_query = LlmSettingsQueryHandler(
        settings_repository=llm_settings,
        secret_repository=llm_secrets,
    )
    fingering_query = FingeringQueryHandler(fingerings)
    piece_stage_query = PieceStageQueryHandler(
        pieces=pieces,
        stages=piece_stages,
    )
    return AppContainer(
        music=MusicState(
            command=music_command,
            query=MusicQueryHandler(pieces),
            score_query=MusicScoreQueryHandler(
                pieces=pieces,
                stage_plans=piece_stage_query,
                fingerings=fingering_query,
            ),
            local_library=LocalMidiLibraryCommandHandler(
                scanner=local_midi,
                watcher=local_midi,
                parser=local_midi,
                hand_assignment=hand_assignment,
                pieces=pieces,
                music_command=music_command,
            ),
            local_library_query=LocalMidiLibraryQueryHandler(local_midi),
        ),
        fingering=FingeringState(
            command=FingeringCommandHandler(
                pieces=pieces,
                fingerings=fingerings,
                stage_plans=piece_stages,
                agent=LangGraphFingeringAgent(),
            ),
            query=fingering_query,
        ),
        agent=AgentState(
            llm_settings=LlmSettingsState(
                command=llm_settings_command,
                query=llm_settings_query,
            ),
            piece_stages=PieceStageState(
                command=PieceStageCommandHandler(
                    pieces=pieces,
                    stages=piece_stages,
                    analyzer=OpenAiCompatibleStageAnalyzer(),
                    llm_settings=llm_settings_query,
                ),
                query=piece_stage_query,
            ),
        ),
    )


def default_state_path() -> Path:
    configured_path = os.environ.get("WARMING_STATE_PATH")
    if configured_path:
        return Path(configured_path).expanduser()
    return Path(__file__).resolve().parents[2] / ".local" / "app.db"
