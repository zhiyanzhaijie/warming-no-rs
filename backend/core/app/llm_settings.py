from dataclasses import dataclass, replace
from datetime import datetime, timezone
from typing import Protocol

from core.app.app_error import AppError
from core.domain.llm_settings import LlmSettings


@dataclass(frozen=True)
class LlmConnectionResult:
    model: str
    latency_ms: int


class LlmSettingsRepositoryPort(Protocol):
    def get(self) -> LlmSettings | None: ...

    def save(self, settings: LlmSettings) -> None: ...


class LlmClientPort(Protocol):
    def test_connection(
        self,
        settings: LlmSettings,
        api_key: str,
    ) -> LlmConnectionResult: ...


class LlmSecretRepositoryPort(Protocol):
    def has_api_key(self) -> bool: ...

    def save_api_key(self, api_key: str) -> None: ...

    def get_api_key(self) -> str | None: ...

    def delete_api_key(self) -> None: ...


class LlmSettingsHandler:
    def __init__(
        self,
        settings_repository: LlmSettingsRepositoryPort,
        secret_repository: LlmSecretRepositoryPort,
        client: LlmClientPort,
    ) -> None:
        self._settings_repository = settings_repository
        self._secret_repository = secret_repository
        self._client = client

    def get(self) -> LlmSettings:
        return self._settings_repository.get() or LlmSettings.deepseek_default()

    def has_api_key(self) -> bool:
        return self._secret_repository.has_api_key()

    def get_api_key(self) -> str | None:
        return self._secret_repository.get_api_key()

    def save(self, base_url: str, model: str, api_key: str = "") -> LlmSettings:
        try:
            settings = LlmSettings.create(base_url, model)
        except ValueError as error:
            raise AppError.validation(str(error)) from error
        saved = replace(
            settings,
            updated_at=datetime.now(timezone.utc).isoformat(),
        )
        self._settings_repository.save(saved)
        if api_key.strip():
            self._secret_repository.save_api_key(api_key)
        return saved

    def clear_api_key(self) -> None:
        self._secret_repository.delete_api_key()

    def test_connection(
        self,
        base_url: str,
        model: str,
        api_key: str,
    ) -> LlmConnectionResult:
        resolved_api_key = api_key.strip() or self._secret_repository.get_api_key()
        if not resolved_api_key:
            raise AppError.validation("请先配置 API Key")
        try:
            settings = LlmSettings.create(base_url, model)
            return self._client.test_connection(settings, resolved_api_key)
        except ValueError as error:
            raise AppError.validation(str(error)) from error
        except Exception as error:
            raise AppError.upstream(_safe_connection_error(error)) from error


def _safe_connection_error(error: Exception) -> str:
    message = str(error).strip()
    if not message:
        return "模型服务连接失败"
    return f"模型服务连接失败：{message[:300]}"
