import { useState, useEffect, useRef } from 'react'
import { Messages as DB, Athletes } from '../lib/db'

export default function Messages() {
  const [athletes, setAthletes] = useState([])
  const [activeChat, setActiveChat] = useState('general')
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    setAthletes(Athletes.getAll())
  }, [])

  const loadMessages = () => {
    setMessages(DB.getGroup(activeChat))
  }

  useEffect(() => {
    loadMessages()
  }, [activeChat])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = () => {
    const text = input.trim()
    if (!text) return
    DB.send(activeChat, text)
    setInput('')
    loadMessages()
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const chats = [
    { id: 'general', name: 'Grupo general', subtitle: `${athletes.length} deportistas`, icon: '👥' },
    ...athletes.map(a => ({ id: a.id, name: a.name, subtitle: a.sport || 'Deportista', icon: null, color: a.color }))
  ]

  const activeInfo = chats.find(c => c.id === activeChat)

  const formatTime = (ts) => {
    const d = new Date(ts)
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (ts) => {
    const d = new Date(ts)
    const today = new Date()
    const isToday = d.toDateString() === today.toDateString()
    const yesterday = new Date(today); yesterday.setDate(today.getDate()-1)
    const isYesterday = d.toDateString() === yesterday.toDateString()
    if (isToday) return 'Hoy'
    if (isYesterday) return 'Ayer'
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
  }

  // Group messages by date
  const grouped = messages.reduce((acc, msg) => {
    const date = new Date(msg.ts).toDateString()
    if (!acc[date]) acc[date] = []
    acc[date].push(msg)
    return acc
  }, {})

  const initials = (name) => name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={{
        width: 72, flexShrink: 0,
        background: 'var(--surface)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '12px 0', gap: 6, overflowY: 'auto'
      }}>
        {chats.map(c => (
          <button key={c.id} onClick={() => setActiveChat(c.id)}
            style={{
              width: 48, height: 48, borderRadius: '50%',
              background: activeChat === c.id
                ? (c.id === 'general' ? 'var(--accent)' : (c.color + '40'))
                : 'var(--card)',
              border: activeChat === c.id
                ? `2px solid ${c.id === 'general' ? 'var(--accent)' : c.color}`
                : '2px solid transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: c.icon ? 22 : 14, fontWeight: 700,
              color: c.id === 'general' && activeChat === c.id ? '#000' : (c.color || 'var(--text)'),
              cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0
            }}>
            {c.icon ? c.icon : initials(c.name)}
          </button>
        ))}
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Chat header */}
        <div style={{
          padding: '10px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: activeInfo?.id === 'general' ? 'var(--accent)' : (activeInfo?.color + '30'),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: activeInfo?.icon ? 18 : 13, fontWeight: 700,
            color: activeInfo?.id === 'general' ? '#000' : activeInfo?.color
          }}>
            {activeInfo?.icon || (activeInfo ? initials(activeInfo.name) : '?')}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{activeInfo?.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{activeInfo?.subtitle}</div>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {messages.length === 0 && (
            <div className="empty-state">
              <div className="icon">💬</div>
              <p>Empieza la conversación</p>
            </div>
          )}

          {Object.entries(grouped).map(([date, msgs]) => (
            <div key={date}>
              <div style={{ textAlign: 'center', margin: '16px 0 12px' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--surface)', padding: '3px 10px', borderRadius: 10 }}>
                  {formatDate(msgs[0].ts)}
                </span>
              </div>
              {msgs.map(msg => {
                const isMe = msg.sender === 'me'
                const sender = !isMe ? athletes.find(a => a.id === msg.sender) : null

                return (
                  <div key={msg.id} style={{
                    display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row',
                    gap: 8, marginBottom: 10, alignItems: 'flex-end'
                  }}>
                    {!isMe && (
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                        background: sender?.color + '30' || 'var(--card)',
                        color: sender?.color || 'var(--text)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 700
                      }}>
                        {sender ? initials(sender.name) : '?'}
                      </div>
                    )}
                    <div style={{ maxWidth: '75%' }}>
                      {!isMe && msg.senderName && (
                        <div style={{ fontSize: 11, color: sender?.color || 'var(--text-muted)', marginBottom: 3, marginLeft: 4, fontWeight: 600 }}>
                          {msg.senderName}
                        </div>
                      )}
                      <div style={{
                        background: isMe ? 'var(--accent)' : 'var(--card)',
                        color: isMe ? '#000' : 'var(--text)',
                        borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        padding: '10px 14px',
                        fontSize: 14, lineHeight: 1.5,
                        border: isMe ? 'none' : '1px solid var(--border)',
                        wordBreak: 'break-word'
                      }}>
                        {msg.text}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3, textAlign: isMe ? 'right' : 'left', padding: '0 4px' }}>
                        {formatTime(msg.ts)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{
          padding: '10px 12px', background: 'var(--surface)', borderTop: '1px solid var(--border)',
          display: 'flex', gap: 8, alignItems: 'flex-end', flexShrink: 0
        }}>
          <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
            placeholder="Escribe un mensaje..."
            style={{
              flex: 1, resize: 'none', minHeight: 40, maxHeight: 120,
              padding: '10px 14px', borderRadius: 20, fontSize: 15,
              background: 'var(--card)', border: '1px solid var(--border)',
              color: 'var(--text)', outline: 'none', lineHeight: 1.4,
              fontFamily: 'inherit'
            }}
            rows={1}
          />
          <button onClick={send}
            style={{
              width: 42, height: 42, borderRadius: '50%',
              background: input.trim() ? 'var(--accent)' : 'var(--border)',
              color: input.trim() ? '#000' : 'var(--text-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, cursor: 'pointer', border: 'none',
              transition: 'all 0.15s', flexShrink: 0
            }}>
            ↑
          </button>
        </div>
      </div>
    </div>
  )
}
