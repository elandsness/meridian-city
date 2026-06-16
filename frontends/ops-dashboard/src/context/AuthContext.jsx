import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import { identifyUser } from '../lib/rum.js';

const AuthContext = createContext(null);

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('ops_token'));
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('ops_user');
    try { return stored ? JSON.parse(stored) : null; } catch { return null; }
  });

  const login = useCallback(async (username, password) => {
    const res = await axios.post(`${API_BASE}/api/v1/auth/login`, { username, password });
    const { token: newToken, user: newUser } = res.data;
    localStorage.setItem('ops_token', newToken);
    localStorage.setItem('ops_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    return newUser;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('ops_token');
    localStorage.removeItem('ops_user');
    setToken(null);
    setUser(null);
  }, []);

  // Tag the RUM session with the operator identity (on login and on reload).
  useEffect(() => {
    if (user) identifyUser(user.username || user.email || user.id);
  }, [user]);

  const isAuthenticated = Boolean(token);

  return (
    <AuthContext.Provider value={{ token, user, login, logout, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
