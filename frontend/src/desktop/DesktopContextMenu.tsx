import { useEffect } from 'react'
import { LogicalPosition } from '@tauri-apps/api/dpi'
import type { Menu } from '@tauri-apps/api/menu'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { isTauriRuntime } from './tauri'

type ContextMenus = {
  editor: Menu
  selection: Menu
}

const textInputTypes = new Set([
  'email',
  'number',
  'password',
  'search',
  'tel',
  'text',
  'url',
])

function findEditableElement(element: Element): HTMLElement | null {
  const control = element.closest('input, textarea, [contenteditable="true"]')
  if (!control) return null

  if (control instanceof HTMLInputElement) {
    return !control.disabled && !control.readOnly && textInputTypes.has(control.type)
      ? control
      : null
  }

  if (control instanceof HTMLTextAreaElement) {
    return !control.disabled && !control.readOnly ? control : null
  }

  return control instanceof HTMLElement && control.isContentEditable ? control : null
}

function hasTextSelection() {
  return Boolean(window.getSelection()?.toString().trim())
}

async function createContextMenus(): Promise<ContextMenus> {
  const { Menu } = await import('@tauri-apps/api/menu')

  const [editor, selection] = await Promise.all([
    Menu.new({
      items: [
        { item: 'Undo', text: '撤销' },
        { item: 'Redo', text: '重做' },
        { item: 'Separator' },
        { item: 'Cut', text: '剪切' },
        { item: 'Copy', text: '复制' },
        { item: 'Paste', text: '粘贴' },
        { item: 'Separator' },
        { item: 'SelectAll', text: '全选' },
      ],
    }),
    Menu.new({
      items: [{ item: 'Copy', text: '复制' }],
    }),
  ])

  return { editor, selection }
}

export function DesktopContextMenu() {
  useEffect(() => {
    if (!isTauriRuntime()) return

    let disposed = false
    let menusPromise: Promise<ContextMenus> | null = null
    const getMenus = () => {
      menusPromise ??= createContextMenus()
      return menusPromise
    }

    const handleContextMenu = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest('[data-context-menu="passthrough"]')) return

      event.preventDefault()

      const editableElement = findEditableElement(target)
      editableElement?.focus({ preventScroll: true })
      const menuKind = editableElement
        ? 'editor'
        : target.closest('[data-selectable]') && hasTextSelection()
          ? 'selection'
          : null
      if (!menuKind) return

      const position = new LogicalPosition(event.clientX, event.clientY)
      void getMenus()
        .then((menus) => {
          if (disposed) return
          return menus[menuKind].popup(position, getCurrentWindow())
        })
        .catch((error: unknown) => {
          console.error('Unable to open native context menu', error)
        })
    }

    document.addEventListener('contextmenu', handleContextMenu, true)
    return () => {
      disposed = true
      document.removeEventListener('contextmenu', handleContextMenu, true)
      if (menusPromise) {
        void menusPromise.then(({ editor, selection }) =>
          Promise.allSettled([editor.close(), selection.close()]),
        ).catch((error: unknown) => {
          console.error('Unable to release native context menus', error)
        })
      }
    }
  }, [])

  return null
}
