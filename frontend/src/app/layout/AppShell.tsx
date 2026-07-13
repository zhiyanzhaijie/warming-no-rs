import type { CSSProperties } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { BookOpen, ChartNoAxesColumn, Library, Play, Settings, WandSparkles } from 'lucide-react'
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
  { to: '/practice', label: '练习', icon: Play },
  { to: '/reports', label: '报告', icon: ChartNoAxesColumn },
  { to: '/processing', label: '加工', icon: WandSparkles },
  { to: '/settings', label: '设置', icon: Settings },
]

export function AppShell() {
  const connectedDevice = usePracticeStore((state) => state.connectedDevice)
  const location = useLocation()

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
        <Sidebar collapsible="icon" className="border-r-0 bg-sidebar p-2">
          <SidebarHeader className="items-center py-2 group-data-[collapsible=icon]:px-1">
            <div className="grid size-10 place-items-center rounded-full bg-spotify-green text-primary-foreground shadow-heavy">
              <BookOpen className="size-5" />
            </div>
            <div className="min-w-0 px-2 group-data-[collapsible=icon]:hidden">
              <p className="text-[10px] font-bold uppercase tracking-[1.8px] text-muted-foreground">
                Agent Piano
              </p>
              <h1 className="truncate font-title text-lg font-bold leading-none">练习台</h1>
            </div>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu className="gap-2">
                  {navItems.map((item) => {
                    const Icon = item.icon
                    const isActive = location.pathname.startsWith(item.to)
                    return (
                      <SidebarMenuItem key={item.to}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          tooltip={item.label}
                          className="h-10 rounded-full px-3 font-bold text-muted-foreground data-[active=true]:bg-secondary data-[active=true]:text-foreground data-[active=true]:shadow-medium hover:bg-secondary hover:text-foreground group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-10"
                        >
                          <NavLink to={item.to}>
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

          <SidebarFooter className="group-data-[collapsible=icon]:items-center">
            <div className="rounded-lg bg-card p-3 shadow-medium group-data-[collapsible=icon]:grid group-data-[collapsible=icon]:size-10 group-data-[collapsible=icon]:place-items-center group-data-[collapsible=icon]:rounded-full group-data-[collapsible=icon]:p-0">
              <p className="text-[10px] font-bold uppercase tracking-[1.6px] text-muted-foreground group-data-[collapsible=icon]:hidden">
                MIDI 输入
              </p>
              <p className="mt-1 truncate text-sm font-bold text-foreground group-data-[collapsible=icon]:sr-only">
                {connectedDevice}
              </p>
              <div className="mt-3 h-1 rounded-full bg-muted group-data-[collapsible=icon]:mt-0 group-data-[collapsible=icon]:size-2 group-data-[collapsible=icon]:bg-spotify-green">
                <div className="h-full w-3/5 rounded-full bg-spotify-green group-data-[collapsible=icon]:hidden" />
              </div>
            </div>
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>

        <SidebarInset className="min-w-0 overflow-hidden bg-background p-2">
          <main className="h-full min-h-0 min-w-0 overflow-hidden rounded-lg bg-background">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
