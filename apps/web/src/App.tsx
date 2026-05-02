import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { Dashboard } from '@web/features/dashboard'
import { Admin, Family, Tasks, System } from '@web/features/admin'
import useSseEvents from '@web/hooks/useSseEvents'
import useQuietHours from '@web/hooks/useQuietHours'
import { useKioskKeyboard } from '@web/hooks/useKioskKeyboard'
import { VirtualKeyboard } from '@web/ui/VirtualKeyboard'

const router = createBrowserRouter([
  {
    path: '/',
    element: <Dashboard />,
  },
  {
    path: '/admin',
    element: <Admin />,
    children: [
      { index: true, element: <Navigate to="/admin/family" replace /> },
      { path: 'family', element: <Family /> },
      { path: 'tasks', element: <Tasks /> },
      { path: 'system', element: <System /> },
    ],
  },
])

const AppShell = () => {
  useSseEvents()
  useQuietHours()
  const { visible, isNumeric, onChange, dismiss, keyboardRef } = useKioskKeyboard()
  return (
    <>
      <RouterProvider router={router} />
      <VirtualKeyboard
        visible={visible}
        isNumeric={isNumeric}
        onChange={onChange}
        onDismiss={dismiss}
        keyboardRef={keyboardRef}
      />
    </>
  )
}

const App = () => <AppShell />

export default App
