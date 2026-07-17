import { useEffect } from 'react'
import { useSidebar } from '@/components/ui/sidebar'
import { setTrafficLightsVisible } from '@/desktop/window'

export function WindowChromeSync() {
  const { mode } = useSidebar()

  useEffect(() => {
    void setTrafficLightsVisible(mode !== 'fullscreen').catch((error: unknown) => {
      console.error('Unable to synchronize window controls', error)
    })
  }, [mode])

  return null
}
