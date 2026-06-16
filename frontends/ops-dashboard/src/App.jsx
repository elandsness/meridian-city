import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Overview from './pages/Overview.jsx';
import IoTPage from './pages/IoTPage.jsx';
import IncidentsPage from './pages/IncidentsPage.jsx';
import IncidentDetail from './pages/IncidentDetail.jsx';
import RequestQueue from './pages/RequestQueue.jsx';
import BusinessAnalytics from './pages/BusinessAnalytics.jsx';
import DemoControl from './pages/DemoControl.jsx';

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function AppRoutes() {
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
        <Route index element={<Navigate to="/overview" replace />} />
        <Route path="/overview" element={<Overview />} />
        <Route path="/iot" element={<IoTPage />} />
        <Route path="/incidents" element={<IncidentsPage />} />
        <Route path="/incidents/:id" element={<IncidentDetail />} />
        <Route path="/requests" element={<RequestQueue />} />
        <Route path="/analytics" element={<BusinessAnalytics />} />
        <Route path="/demo-control" element={<DemoControl />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/overview" replace />} />
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
