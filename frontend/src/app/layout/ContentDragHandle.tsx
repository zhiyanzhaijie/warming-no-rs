import type { MouseEvent } from 'react'
import { GripHorizontal } from 'lucide-react'
import { startDraggingWindow } from '@/desktop/window'

function handleMouseDown(event: MouseEvent<HTMLButtonElement>) {
  if (event.button !== 0) return

  event.preventDefault()
  void startDraggingWindow().catch((error: unknown) => {
    console.error('Window drag failed', error)
  })
}

export function ContentDragHandle() {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label="拖动窗口"
      className="group/window-drag absolute left-1/2 top-0 z-50 flex h-4 w-20 -translate-x-1/2 cursor-grab select-none items-center justify-center bg-transparent outline-none active:cursor-grabbing"
      onMouseDown={handleMouseDown}
    >
      <GripHorizontal className="pointer-events-none size-3 text-muted-foreground opacity-0 transition-opacity duration-150 group-hover/window-drag:opacity-55 group-active/window-drag:opacity-75" />
    </button>
  )
}
