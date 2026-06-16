import { useState, useRef, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { sendMessage } from '../api/chat.js'
import { useChat } from '../context/ChatContext.jsx'

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  )
}

function DotsLoader() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:0ms]" />
      <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:150ms]" />
      <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:300ms]" />
    </div>
  )
}

export default function ChatWidget() {
  const { open, toggleChat, closeChat } = useChat()
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hi, I'm Meri — Meridian City's assistant. How can I help you today?" },
  ])
  const [input, setInput] = useState('')
  const [sessionId] = useState(() => uuidv4())
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, loading, open])

  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return

    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setLoading(true)

    try {
      const data = await sendMessage({ message: text, session_id: sessionId })
      setMessages((prev) => [...prev, { role: 'assistant', content: data.response ?? data.reply }])
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I am unable to respond right now. Please try again later.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div
          className="bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{ width: '384px', height: '480px' }}
        >
          <div className="bg-meridian-blue px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <span className="w-6 h-6 rounded-full bg-noon-sun text-noon-ink flex items-center justify-center text-xs font-semibold">M</span>
              <span className="font-semibold text-sm">Ask Meri</span>
            </div>
            <button
              onClick={closeChat}
              className="text-white/70 hover:text-white transition-colors text-xl leading-none"
              aria-label="Close chat"
            >
              ×
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-slate-50">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] px-3 py-2 rounded-xl text-sm ${
                    msg.role === 'user'
                      ? 'bg-meridian-blue text-white rounded-br-none'
                      : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-xl rounded-bl-none">
                  <DotsLoader />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-slate-200 p-3 flex gap-2 bg-white">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              disabled={loading}
              className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-meridian-blue disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="bg-meridian-blue hover:bg-meridian-blue-deep disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      )}

      <button
        onClick={toggleChat}
        className="bg-meridian-blue hover:bg-meridian-blue-deep text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-colors"
        aria-label="Ask Meri"
      >
        {open ? <span className="text-2xl leading-none">×</span> : <ChatIcon />}
      </button>
    </div>
  )
}
