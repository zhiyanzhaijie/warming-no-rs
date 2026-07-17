import { AppProviders } from './app/providers'
import { AppRouter } from './app/router'
import { DesktopContextMenu } from './desktop/DesktopContextMenu'

export default function App() {
  return (
    <AppProviders>
      <DesktopContextMenu />
      <AppRouter />
    </AppProviders>
  )
}
