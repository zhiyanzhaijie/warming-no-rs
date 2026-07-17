export const isTauriRuntime = () => Boolean('__TAURI_INTERNALS__' in window)

export const isMacOS = () => navigator.userAgent.includes('Macintosh')
