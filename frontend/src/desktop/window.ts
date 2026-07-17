import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow, type Window } from '@tauri-apps/api/window'
import { isMacOS, isTauriRuntime } from './tauri'

type WindowAction = (window: Window) => Promise<void>

async function runWindowAction(action: WindowAction) {
  if (!isTauriRuntime()) return

  await action(getCurrentWindow())
}

export function minimizeWindow() {
  return runWindowAction((window) => window.minimize())
}

export function toggleMaximizeWindow() {
  return runWindowAction((window) => window.toggleMaximize())
}

export function closeWindow() {
  return runWindowAction((window) => window.close())
}

export function startDraggingWindow() {
  return runWindowAction((window) => window.startDragging())
}

export async function setTrafficLightsVisible(visible: boolean) {
  if (!isTauriRuntime() || !isMacOS()) return

  await invoke('set_traffic_lights_visible', { visible })
}
