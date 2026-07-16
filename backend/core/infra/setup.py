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
from core.app.llm_settings import LlmSettingsHandler
from core.app.music import LocalMidiLibraryHandler, MusicCommandHandler, MusicQueryHandler
from core.app.piece_stages import PieceStageHandler


@dataclass(frozen=True)
class MusicState:
    command: MusicCommandHandler
    query: MusicQueryHandler
    local_library: LocalMidiLibraryHandler


@dataclass(frozen=True)
class FingeringState:
    command: FingeringCommandHandler
    query: FingeringQueryHandler


@dataclass(frozen=True)
class AgentState:
    llm_settings: LlmSettingsHandler
    piece_stages: PieceStageHandler


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
    music_command = MusicCommandHandler(pieces)
    local_midi = LocalMidiFileAdapter(pieces)
    llm_settings_handler = LlmSettingsHandler(
        settings_repository=llm_settings,
        secret_repository=llm_secrets,
        client=OpenAiCompatibleLlmClient(),
    )
    return AppContainer(
        music=MusicState(
            command=music_command,
            query=MusicQueryHandler(pieces),
            local_library=LocalMidiLibraryHandler(
                scanner=local_midi,
                watcher=local_midi,
                parser=local_midi,
                pieces=pieces,
                music_command=music_command,
            ),
        ),
        fingering=FingeringState(
            command=FingeringCommandHandler(
                pieces=pieces,
                fingerings=fingerings,
                stage_plans=piece_stages,
                agent=LangGraphFingeringAgent(),
            ),
            query=FingeringQueryHandler(fingerings),
        ),
        agent=AgentState(
            llm_settings=llm_settings_handler,
            piece_stages=PieceStageHandler(
                pieces=pieces,
                stages=piece_stages,
                analyzer=OpenAiCompatibleStageAnalyzer(),
                llm_settings=llm_settings_handler,
            ),
        ),
    )


def default_state_path() -> Path:
    return Path(__file__).resolve().parents[2] / ".local" / "app.db"
