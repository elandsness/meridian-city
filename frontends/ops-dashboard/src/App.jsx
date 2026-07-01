import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { useConfig } from './config/ConfigContext';
import { getActiveScreens } from './config/screens.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

// Build the <Route> list for the active ops screens (+ sub-routes) from the
// registry. Auth is enforced by the wrapping Layout route, not per-screen.
function screenRoutes(screens) {
  const routes = [];
  for (const s of screens) {
    const Comp = s.component;
    routes.push(<Route key={s.id} path={s.path} element={<Comp />} />);
    for (const sub of s.subRoutes) {
      const SubComp = sub.component;
      const subPath = `${s.path.replace(/\/$/, '')}/${sub.path}`;
      routes.push(<Route key={`${s.id}:${sub.path}`} path={subPath} element={<SubComp />} />);
    }
  }
  return routes;
}

function AppRoutes() {
  const config = useConfig();
  const screens = getActiveScreens(config);
  const firstPath = screens[0]?.path ?? '/overview';
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Protected layout routes */}
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to={firstPath} replace />} />
        {screenRoutes(screens)}
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to={firstPath} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
