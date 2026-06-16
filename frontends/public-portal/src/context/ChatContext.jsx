import { createContext, useContext, useState, useCallback } from 'react'

// Holds the open/closed state of the persistent "Ask Meri" chat widget so any
// page (e.g. a home quick-action) can open it while the widget itself lives in
// the layout.
const ChatContext = createContext(null)

export function ChatProvider({ children }) {
  const [open, setOpen] = useState(false)
  const openChat = useCallback(() => setOpen(true), [])
  const closeChat = useCallback(() => setOpen(false), [])
  const toggleChat = useCallback(() => setOpen((p) => !p), [])
  return (
    <ChatContext.Provider value={{ open, openChat, closeChat, toggleChat }}>
      {children}
    </ChatContext.Provider>
  )
}

export function useChat() {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChat must be used within ChatProvider')
  return ctx
}
