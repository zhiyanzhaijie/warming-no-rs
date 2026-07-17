import { Maximize2, Minus, X } from 'lucide-react'
import {
  closeWindow,
  minimizeWindow,
  toggleMaximizeWindow,
} from '@/desktop/window'
import { isMacOS } from '@/desktop/tauri'

type WindowCommand = () => Promise<void>

function invokeWindowCommand(command: WindowCommand) {
  void command().catch((error: unknown) => {
    console.error('Window command failed', error)
  })
}

export function WindowControls() {
  if (isMacOS()) return null

  return (
    <div
      className="group/window-controls flex shrink-0 select-none items-center gap-1 px-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
      onDoubleClick={(event) => {
        if (event.target === event.currentTarget) {
          invokeWindowCommand(toggleMaximizeWindow)
        }
      }}
    >
      <button
        type="button"
        aria-label="关闭窗口"
        title="关闭窗口"
        className="group/window-button grid size-3 shrink-0 place-items-center rounded-full bg-[#ff5f57] text-[#4d0000] outline-none ring-offset-sidebar transition-[filter,transform] hover:brightness-95 focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 active:scale-90 group-data-[collapsible=icon]:size-2.5"
        onClick={() => invokeWindowCommand(closeWindow)}
      >
        <X className="size-2 opacity-0 transition-opacity group-hover/window-controls:opacity-70 group-focus-visible/window-button:opacity-70" strokeWidth={3} />
      </button>

      <button
        type="button"
        aria-label="最小化窗口"
        title="最小化窗口"
        className="group/window-button grid size-3 shrink-0 place-items-center rounded-full bg-[#febc2e] text-[#5f3b00] outline-none ring-offset-sidebar transition-[filter,transform] hover:brightness-95 focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 active:scale-90 group-data-[collapsible=icon]:size-2.5"
        onClick={() => invokeWindowCommand(minimizeWindow)}
      >
        <Minus className="size-2 opacity-0 transition-opacity group-hover/window-controls:opacity-70 group-focus-visible/window-button:opacity-70" strokeWidth={3} />
      </button>

      <button
        type="button"
        aria-label="最大化或还原窗口"
        title="最大化或还原窗口"
        className="group/window-button grid size-3 shrink-0 place-items-center rounded-full bg-[#28c840] text-[#064d10] outline-none ring-offset-sidebar transition-[filter,transform] hover:brightness-95 focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 active:scale-90 group-data-[collapsible=icon]:size-2.5"
        onClick={() => invokeWindowCommand(toggleMaximizeWindow)}
      >
        <Maximize2 className="size-1.5 opacity-0 transition-opacity group-hover/window-controls:opacity-70 group-focus-visible/window-button:opacity-70" strokeWidth={3} />
      </button>
    </div>
  )
}
