import { createContext, useContext, useState, useCallback } from 'react'
import client from '../api/client.js'

const AuthContext = createContext(null)

const TOKEN_KEY = 'meridian_token'
const USER_KEY = 'meridian_user'

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem(USER_KEY)
    try { return stored ? JSON.parse(stored) : null } catch { return null }
  })

  const login = useCallback(async (username, password) => {
    const response = await client.post('/api/v1/auth/login', { username, password })
    const { token: newToken, user: newUser } = response.data
    localStorage.setItem(TOKEN_KEY, newToken)
    localStorage.setItem(USER_KEY, JSON.stringify(newUser))
    setToken(newToken)
    setUser(newUser)
    return newUser
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setUser(null)
  }, [])

  const value = {
    token,
    user,
    login,
    logout,
    isAuthenticated: !!token,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
