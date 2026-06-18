import { createContext, useContext, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from './AuthContext.jsx'
import { getMessages, markAllRead as apiMarkAllRead } from '../api/messages.js'

const NotificationContext = createContext(null)

/**
 * Notifications are the logged-in citizen's per-citizen inbox (messages.messages),
 * scoped by citizen_id — NOT the global notification firehose. The demo operator has
 * no citizen id, so the bell is simply empty for them.
 */
export function NotificationProvider({ children }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const citizenId = user?.id

  const { data } = useQuery({
    queryKey: ['messages', citizenId],
    queryFn: () => getMessages(citizenId),
    enabled: !!citizenId,
    refetchInterval: 30_000,
  })

  const notifications = Array.isArray(data?.messages) ? data.messages : []
  const unreadCount = data?.unread ?? 0

  const markAllRead = useCallback(async () => {
    if (!citizenId) return
    try {
      await apiMarkAllRead(citizenId)
    } finally {
      qc.invalidateQueries({ queryKey: ['messages', citizenId] })
    }
  }, [citizenId, qc])

  const value = {
    notifications,
    unreadCount,
    markAllRead,
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider')
  return ctx
}
