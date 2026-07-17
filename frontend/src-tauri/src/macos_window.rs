use objc2_app_kit::{NSWindow, NSWindowButton};
use tauri::WebviewWindow;

const TRAFFIC_LIGHT_BUTTONS: [NSWindowButton; 3] = [
    NSWindowButton::CloseButton,
    NSWindowButton::MiniaturizeButton,
    NSWindowButton::ZoomButton,
];

pub fn configure_traffic_lights(
    window: &WebviewWindow,
    visible: bool,
) -> tauri::Result<()> {
    let ns_window = window.ns_window()?;
    // Tauri guarantees that ns_window points to the NSWindow owned by this WebviewWindow.
    let ns_window = unsafe { &*ns_window.cast::<NSWindow>() };

    for button_kind in TRAFFIC_LIGHT_BUTTONS {
        if let Some(button) = ns_window.standardWindowButton(button_kind) {
            button.setHidden(!visible);
        }
    }

    Ok(())
}

pub fn schedule_traffic_lights_visibility(
    window: WebviewWindow,
    visible: bool,
) -> tauri::Result<()> {
    let task_window = window.clone();
    window.run_on_main_thread(move || {
        if let Err(error) = configure_traffic_lights(&task_window, visible) {
            log::error!("unable to update macOS traffic lights: {error}");
        }
    })
}
