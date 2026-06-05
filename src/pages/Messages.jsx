import { useState, useEffect, useRef } from 'react'
import { Messages as DB, Athletes } from '../lib/db'
import { useAuth } from '../contexts/AuthContext'

export default function Messages() {
  const { profile, isCoach } = useAuth()
  const [athletes, setAthletes] = useState([])
  const [activeChat, setActiveChat] = useState('general')
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    Athletes.getAll().then(setAthletes)
  }, [])

  const loadMessages = async () => {
    const msgs = await DB.getGroup(activeChat)
    setMessages(msgs)
  }

  useEffect(() => {
    loadMessages()
    // Suscripción en tiempo real
    const channel = DB.subscribe(activeChat, () => loadMessages())
    return () => channel?.unsubscribe()
  }, [activeChat])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    const text = input.trim()
    if (!text) return
    setInput('')
    const senderName = isCoach ? 'Celia (Entrenadora)' : profile?.athletes?.name || 'Deportista'
    const senderId = isCoach ? 'me' : (profile?.athlete_id || 'athlete')
    await DB.send(activeChat, text, senderId, senderName)
    await loadMessages()
  }

  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }

  // Coach ve todos los chats, deportista solo el general y el suyo con la entrenadora
  const chats = isCoach
    ? [
        { id: 'general', name: 'Grupo general', subtitle: `${athletes.length} deportistas`, icon: '👥' },
        ...athletes.map(a => ({ id: a.id, name: a.name, subtitle: a.sport || 'Deportista', color: a.color }))
      ]
    : [
        { id: 'general', name: 'Grupo general', subtitle: 'Todo el equipo', icon: '👥' },
        { id: 'me', name: 'Celia (Entrenadora)', subtitle: 'Chat privado', icon: '👩‍💼' }
      ]

  const activeInfo = chats.find(c => c.id === activeChat)
  const formatTime = (ts) => new Date(ts).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  const initials = (name) => name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()

  const grouped = messages.reduce((acc, msg) => {
    const date = new Date(msg.ts).toDateString()
    if (!acc[date]) acc[date] = []
    acc[date].push(msg)
    return acc
  }, {})

  const formatDate = (ts) => {
    const d = new Date(ts)
    const today = new Date()
    if (d.toDateString() === today.toDateString()) return 'Hoy'
    const yesterday = new Date(today); yesterday.setDate(today.getDate()-1)
    if (d.toDateString() === yesterday.toDateString()) return 'Ayer'
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
  }

  const myId = isCoach ? 'me' : (profile?.athlete_id || 'athlete')

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={{ width: 72, flexShrink: 0, background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0', gap: 6, overflowY: 'auto' }}>
        {chats.map(c => (
          <button key={c.id} onClick={() => setActiveChat(c.id)}
            style={{
              width: 48, height: 48, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
              background: activeChat === c.id ? (c.id === 'general' ? 'var(--accent)' : c.color+'40') : 'var(--card)',
              border: activeChat === c.id ? `2px solid ${c.id === 'general' ? 'var(--accent)' : c.color}` : '2px solid transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: c.icon ? 22 : 14, fontWeight: 700,
              color: c.id === 'general' && activeChat === c.id ? '#000' : (c.color || 'var(--text)'),
            }}>
            {c.icon ? c.icon : initials(c.name)}
          </button>
        ))}
      </div>

      {/* Chat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '10px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: activeInfo?.id === 'general' ? 'var(--accent)' : (activeInfo?.color+'30' || 'var(--card)'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: activeInfo?.icon ? 18 : 13, fontWeight: 700, color: activeInfo?.id === 'general' ? '#000' : activeInfo?.color }}>
            {activeInfo?.icon || (activeInfo ? initials(activeInfo.name) : '?')}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{activeInfo?.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{activeInfo?.subtitle}</div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {messages.length === 0 && (
            <div className="empty-state"><div className="icon">💬</div><p>Empieza la conversación</p></div>
          )}
          {Object.entries(grouped).map(([date, msgs]) => (
            <div key={date}>
              <div style={{ textAlign: 'center', margin: '16px 0 12px' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--surface)', padding: '3px 10px', borderRadius: 10 }}>{formatDate(msgs[0].ts)}</span>
              </div>
              {msgs.map(msg => {
                const isMe = msg.sender === myId || msg.sender === 'me'
                const sender = !isMe ? athletes.find(a => a.id === msg.sender) : null
                return (
                  <div key={msg.id} style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', gap: 8, marginBottom: 10, alignItems: 'flex-end' }}>
                    {!isMe && (
                      <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: sender?.color+'30' || 'var(--card)', color: sender?.color || 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>
                        {msg.senderName ? initials(msg.senderName) : '?'}
                      </div>
                    )}
                    <div style={{ maxWidth: '75%' }}>
                      {!isMe && msg.senderName && (
                        <div style={{ fontSize: 11, color: sender?.color || 'var(--text-muted)', marginBottom: 3, marginLeft: 4, fontWeight: 600 }}>{msg.senderName}</div>
                      )}
                      <div style={{ background: isMe ? 'var(--accent)' : 'var(--card)', color: isMe ? '#000' : 'var(--text)', borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px', padding: '10px 14px', fontSize: 14, border: isMe ? 'none' : '1px solid var(--border)', wordBreak: 'break-word' }}>
                        {msg.text}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3, textAlign: isMe ? 'right' : 'left', padding: '0 4px' }}>{formatTime(msg.ts)}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div style={{ padding: '10px 12px', background: 'var(--surface)', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'flex-end', flexShrink: 0 }}>
          <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
            placeholder="Escribe un mensaje..." rows={1}
            style={{ flex: 1, resize: 'none', minHeight: 40, maxHeight: 120, padding: '10px 14px', borderRadius: 20, fontSize: 15, background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none', lineHeight: 1.4, fontFamily: 'inherit' }} />
          <button onClick={send} style={{ width: 42, height: 42, borderRadius: '50%', background: input.trim() ? 'var(--accent)' : 'var(--border)', color: input.trim() ? '#000' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, cursor: 'pointer', border: 'none', transition: 'all 0.15s', flexShrink: 0 }}>↑</button>
        </div>
      </div>
    </div>
  )
}
