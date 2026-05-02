import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { Dashboard } from '@web/features/dashboard'
import { Admin, Family, Tasks, System } from '@web/features/admin'
import useSseEvents from '@web/hooks/useSseEvents'
import useQuietHours from '@web/hooks/useQuietHours'

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
  return <RouterProvider router={router} />
}

const App = () => <AppShell />

export default App
