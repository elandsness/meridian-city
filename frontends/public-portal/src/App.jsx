import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { NotificationProvider } from './context/NotificationContext.jsx'
import { ChatProvider } from './context/ChatContext.jsx'
import { useConfig } from './config/ConfigContext'
import { getActiveScreens } from './config/screens.jsx'
import Layout from './components/Layout.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  return children
}

// Build the <Route> list for the active screens (+ their sub-routes) from the
// registry. Protected screens are wrapped; Home ("/") is public.
function screenRoutes(screens) {
  const routes = []
  for (const s of screens) {
    const Comp = s.component
    const wrap = (el) => (s.protected ? <ProtectedRoute>{el}</ProtectedRoute> : el)
    routes.push(<Route key={s.id} path={s.path} element={wrap(<Comp />)} />)
    for (const sub of s.subRoutes) {
      const SubComp = sub.component
      const subPath = `${s.path.replace(/\/$/, '')}/${sub.path}`
      routes.push(<Route key={`${s.id}:${sub.path}`} path={subPath} element={wrap(<SubComp />)} />)
    }
  }
  return routes
}

function AppRoutes() {
  const config = useConfig()
  const screens = getActiveScreens(config)
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<Layout />}>{screenRoutes(screens)}</Route>
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <ChatProvider>
          <AppRoutes />
        </ChatProvider>
      </NotificationProvider>
    </AuthProvider>
  )
}
