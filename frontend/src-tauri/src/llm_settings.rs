use serde_json::{json, Value};

use crate::python_sidecar;

#[tauri::command]
pub async fn llm_get_settings() -> Result<Value, String> {
    python_sidecar::call_async("llm_get_settings", json!({})).await
}

#[tauri::command]
pub async fn llm_save_settings(
    base_url: String,
    model: String,
    api_key: String,
) -> Result<Value, String> {
    python_sidecar::call_async(
        "llm_save_settings",
        json!({
            "base_url": base_url,
            "model": model,
            "api_key": api_key,
        }),
    )
    .await
}

#[tauri::command]
pub async fn llm_clear_api_key() -> Result<Value, String> {
    python_sidecar::call_async("llm_clear_api_key", json!({})).await
}

#[tauri::command]
pub async fn llm_test_connection(
    base_url: String,
    model: String,
    api_key: String,
) -> Result<Value, String> {
    python_sidecar::call_async(
        "llm_test_connection",
        json!({
            "base_url": base_url,
            "model": model,
            "api_key": api_key,
        }),
    )
    .await
}

#[tauri::command]
pub async fn music_get_stage_plan(piece_id: String) -> Result<Value, String> {
    python_sidecar::call_async("music_get_stage_plan", json!({ "piece_id": piece_id })).await
}

#[tauri::command]
pub async fn music_list_stage_plans(piece_id: String) -> Result<Value, String> {
    python_sidecar::call_async("music_list_stage_plans", json!({ "piece_id": piece_id })).await
}

#[tauri::command]
pub async fn music_analyze_stages(
    piece_id: String,
    plan_id: Option<String>,
    name: Option<String>,
    prompt: Option<String>,
) -> Result<Value, String> {
    python_sidecar::call_async(
        "music_analyze_stages",
        json!({
            "piece_id": piece_id,
            "plan_id": plan_id,
            "name": name,
            "prompt": prompt,
        }),
    )
    .await
}

#[tauri::command]
pub async fn music_rename_stage_plan(
    piece_id: String,
    plan_id: String,
    name: String,
) -> Result<Value, String> {
    python_sidecar::call_async(
        "music_rename_stage_plan",
        json!({
            "piece_id": piece_id,
            "plan_id": plan_id,
            "name": name,
        }),
    )
    .await
}

#[tauri::command]
pub async fn music_activate_stage_plan(piece_id: String, plan_id: String) -> Result<Value, String> {
    python_sidecar::call_async(
        "music_activate_stage_plan",
        json!({ "piece_id": piece_id, "plan_id": plan_id }),
    )
    .await
}

#[tauri::command]
pub async fn music_delete_stage_plan(piece_id: String, plan_id: String) -> Result<Value, String> {
    python_sidecar::call_async(
        "music_delete_stage_plan",
        json!({ "piece_id": piece_id, "plan_id": plan_id }),
    )
    .await
}
