import type { CSSProperties } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Keyboard, Library, Music2, Piano, Settings, WandSparkles } from 'lucide-react'
import { useInstrumentStore } from '../../features/instrument/input/instrumentStore'
import { usePracticeStore } from '../../features/practice/practiceStore'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
} from '@/components/ui/sidebar'

const navItems = [
  { to: '/library', label: '曲库', icon: Library },
  { to: '/processing', label: '加工', icon: WandSparkles },
  { to: '/settings', label: '设置', icon: Settings },
]

export function AppShell() {
  const inputDevices = useInstrumentStore((state) => state.devices)
  const activeDeviceId = useInstrumentStore((state) => state.activeDeviceId)
  const inputStatus = useInstrumentStore((state) => state.status)
  const sessionPieceId = usePracticeStore((state) => state.session?.pieceId)
  const sessionPieceTitle = usePracticeStore((state) => state.session?.pieceTitle)
  const isPlaying = usePracticeStore((state) => state.isPlaying)
  const location = useLocation()
  const activeInputDevice = inputDevices.find((device) => device.id === activeDeviceId) ?? inputDevices[0]
  const InputIcon = activeInputDevice.kind === 'midi-keyboard' ? Piano : Keyboard
  const inputSpecification = activeInputDevice.keyCount
    ? `${activeInputDevice.keyCount} 键`
    : '音域未校准'
  const inputRange = activeInputDevice.lowestPitch !== null && activeInputDevice.highestPitch !== null
    ? `MIDI ${activeInputDevice.lowestPitch}–${activeInputDevice.highestPitch}`
    : '等待校准'
  const inputStatusLabel = inputStatus === 'connecting'
    ? '连接中'
    : inputStatus === 'error'
      ? '连接异常'
      : activeInputDevice.kind === 'midi-keyboard'
        ? '设备在线'
        : '本地映射'

  return (
    <SidebarProvider
      defaultOpen={false}
      style={
        {
          '--sidebar-width': '13rem',
          '--sidebar-width-icon': '4rem',
        } as CSSProperties
      }
    >
      <div className="flex h-dvh w-full overflow-hidden bg-background text-foreground">
        <Sidebar
          collapsible="icon"
          className="border-r-0 bg-sidebar p-2 group-data-[side=left]:border-r-0 group-data-[side=right]:border-l-0"
        >
          <SidebarHeader className="p-2 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-1">
            <div className="flex min-w-0 items-center gap-3 border border-sidebar-border bg-transparent p-3 group-data-[collapsible=icon]:size-10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:p-0">
              <span className="relative grid size-8 shrink-0 place-items-center text-sidebar-foreground/60">
                <InputIcon className="size-4" />
                <span
                  className={`absolute bottom-0.5 right-0.5 size-1.5 ${inputStatus === 'error' ? 'bg-destructive' : inputStatus === 'connecting' ? 'animate-pulse bg-primary' : 'bg-spotify-green'}`}
                  aria-hidden="true"
                />
              </span>
              <div className="min-w-0 flex-1 group-data-[collapsible=icon]:sr-only">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[9px] font-bold tracking-[0.2em] text-muted-foreground">MIDI 输入</p>
                  <span className={`text-[8px] font-bold tracking-wider ${inputStatus === 'error' ? 'text-destructive' : 'text-primary'}`}>
                    {inputStatusLabel}
                  </span>
                </div>
                <p className="mt-2 truncate text-xs font-bold text-sidebar-foreground" title={activeInputDevice.name}>
                  {activeInputDevice.name}
                </p>
                <div className="mt-2 flex items-center gap-2 text-[9px] tracking-wide text-muted-foreground">
                  <span>{inputSpecification}</span>
                  <span className="h-2 w-px bg-sidebar-border" />
                  <span className="truncate">{inputRange}</span>
                </div>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu className="gap-1 border-t border-sidebar-border pt-3">
                  {navItems.map((item) => {
                    const Icon = item.icon
                    const isActive = location.pathname.startsWith(item.to)
                    return (
                      <SidebarMenuItem key={item.to}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          tooltip={item.label}
                          className="relative h-9 rounded-none border-0 bg-transparent px-3 text-[11px] font-bold tracking-[0.12em] text-muted-foreground shadow-none before:absolute before:inset-y-2 before:left-0 before:w-px before:bg-transparent before:transition-colors data-[active=true]:bg-transparent data-[active=true]:text-sidebar-foreground data-[active=true]:before:bg-primary hover:bg-sidebar-accent/25 hover:text-sidebar-foreground group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
                        >
                          <NavLink to={item.to} viewTransition>
                            <Icon className="size-4" />
                            <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="p-2 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-1">
            {sessionPieceId && sessionPieceTitle ? (
              <NavLink
                to="/practice"
                viewTransition
                aria-label={`返回练习：${sessionPieceTitle}`}
                className="group/session flex min-w-0 items-center gap-3 border border-sidebar-border bg-transparent p-3 transition hover:border-sidebar-foreground/30 hover:bg-sidebar-accent/40 group-data-[collapsible=icon]:size-10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:p-0"
              >
                <span className="relative grid size-9 shrink-0 place-items-center text-primary">
                  {isPlaying ? (
                    <span aria-hidden="true" className="absolute inset-0">
                      <span className="practice-wind practice-wind-one" />
                      <span className="practice-wind practice-wind-two" />
                      <span className="practice-wind practice-wind-three" />
                    </span>
                  ) : null}
                  <Music2 className="relative z-10 size-4" />
                </span>
                <span className="min-w-0 flex-1 group-data-[collapsible=icon]:sr-only">
                  <span className="block text-[9px] font-bold tracking-[0.2em] text-muted-foreground">
                    {isPlaying ? '练习中' : '练习已暂停'}
                  </span>
                  <span className="mt-1 block truncate text-xs font-bold text-foreground/85">
                    {sessionPieceTitle}
                  </span>
                </span>
              </NavLink>
            ) : null}
          </SidebarFooter>
          <SidebarRail className="after:bg-transparent hover:after:bg-sidebar-border" />
        </Sidebar>

        <SidebarInset className="min-w-0 overflow-hidden bg-background p-2 data-[sidebar-mode=fullscreen]:p-0">
          <main className="route-content h-full min-h-0 min-w-0 overflow-hidden rounded-lg bg-background in-data-[sidebar-mode=fullscreen]:rounded-none">
            <div key={location.key} className="route-fallback-enter h-full min-h-0">
              <Outlet />
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
