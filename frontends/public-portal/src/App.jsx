import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { NotificationProvider } from './context/NotificationContext.jsx'
import { ChatProvider } from './context/ChatContext.jsx'
import Layout from './components/Layout.jsx'
import Home from './pages/Home.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import ServiceRequests from './pages/ServiceRequests.jsx'
import NewRequest from './pages/NewRequest.jsx'
import RequestDetail from './pages/RequestDetail.jsx'
import Store from './pages/Store.jsx'
import Orders from './pages/Orders.jsx'
import Billing from './pages/Billing.jsx'

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route
          path="/service-requests"
          element={
            <ProtectedRoute>
              <ServiceRequests />
            </ProtectedRoute>
          }
        />
        <Route
          path="/service-requests/new"
          element={
            <ProtectedRoute>
              <NewRequest />
            </ProtectedRoute>
          }
        />
        <Route
          path="/service-requests/:id"
          element={
            <ProtectedRoute>
              <RequestDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/store"
          element={
            <ProtectedRoute>
              <Store />
            </ProtectedRoute>
          }
        />
        <Route
          path="/store/orders"
          element={
            <ProtectedRoute>
              <Orders />
            </ProtectedRoute>
          }
        />
        <Route
          path="/billing"
          element={
            <ProtectedRoute>
              <Billing />
            </ProtectedRoute>
          }
        />
      </Route>
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
