import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const navItems = [
  { to: '/overview', label: 'Overview', icon: '📊' },
  { to: '/iot', label: 'IoT Fleet', icon: '🌐' },
  { to: '/incidents', label: 'Incidents', icon: '🚨' },
  { to: '/analytics', label: 'Business Analytics', icon: '📈' },
  { to: '/demo-control', label: 'Demo Control', icon: '🎛' },
];

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="flex h-full min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 flex flex-col flex-shrink-0 fixed top-0 left-0 h-full z-10">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-gray-800">
          <span className="text-xl font-bold text-white tracking-tight">
            🏙 Meridian Ops
          </span>
          <p className="text-xs text-gray-500 mt-1">Operations Dashboard</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {navItems.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-6 py-3 text-sm font-medium transition-colors border-l-2 ${
                  isActive
                    ? 'border-cyan-400 text-cyan-400 bg-cyan-400/5'
                    : 'border-transparent text-gray-400 hover:text-white hover:bg-gray-800'
                }`
              }
            >
              <span>{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User / Logout */}
        <div className="px-6 py-4 border-t border-gray-800">
          <p className="text-xs text-gray-500 mb-2">Signed in as</p>
          <p className="text-sm text-white font-medium truncate">{user?.username ?? 'unknown'}</p>
          <button
            onClick={logout}
            className="mt-3 text-xs text-gray-500 hover:text-rose-400 transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-64 overflow-auto p-6 min-h-screen bg-gray-950">
        <Outlet />
      </main>
    </div>
  );
}
