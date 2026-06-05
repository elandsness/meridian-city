import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from './AuthContext.jsx'

const NotificationContext = createContext(null)

const MAX_NOTIFICATIONS = 20

export function NotificationProvider({ children }) {
  const { token } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const eventSourceRef = useRef(null)

  useEffect(() => {
    if (!token) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      return
    }

    const base = import.meta.env.VITE_API_BASE_URL || ''
    const url = `${base}/api/v1/notifications/stream`

    const es = new EventSource(url)
    eventSourceRef.current = es

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        setNotifications((prev) => {
          const updated = [data, ...prev]
          return updated.slice(0, MAX_NOTIFICATIONS)
        })
        setUnreadCount((prev) => prev + 1)
      } catch {
        // ignore parse errors
      }
    }

    es.onerror = () => {
      es.close()
    }

    return () => {
      es.close()
      eventSourceRef.current = null
    }
  }, [token])

  const markAllRead = useCallback(() => {
    setUnreadCount(0)
  }, [])

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
