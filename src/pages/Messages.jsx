import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { Messages as DB, Athletes, Reactions } from '../lib/db'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const REACTION_EMOJIS = ['👍','❤️','🔥','💪','😂','👏']

export default function Messages() {
  const { profile, isCoach } = useAuth()
  const location = useLocation()
  const myAthleteId = profile?.athlete_id
  const [athletes, setAthletes] = useState([])
  const [coachAvatar, setCoachAvatar] = useState(null)
  const [activeChat, setActiveChat] = useState(location.state?.chatId || 'general')
  const [messages, setMessages] = useState([])
  const [reactions, setReactions] = useState({})
  const [reactionTarget, setReactionTarget] = useState(null)
  const [input, setInput] = useState('')
  const [uploading, setUploading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const recordingTimerRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const bottomRef = useRef(null)
  const fileRef = useRef(null)

  useEffect(() => {
    Athletes.getAll().then(setAthletes)
    // Cargar foto del coach
    supabase.from('profiles').select('avatar_url').eq('role', 'coach').single()
      .then(({ data }) => { if (data?.avatar_url) setCoachAvatar(data.avatar_url) })
  }, [])

  const loadMessages = async () => {
    const msgs = await DB.getGroup(activeChat)
    setMessages(msgs)
    const { data: reactionData } = await supabase.from('message_reactions').select('*').in('message_id', msgs.map(m => m.id))
    const grouped = {}
    ;(reactionData || []).forEach(r => {
      if (!grouped[r.message_id]) grouped[r.message_id] = {}
      if (!grouped[r.message_id][r.emoji]) grouped[r.message_id][r.emoji] = []
      grouped[r.message_id][r.emoji].push(r.sender_id)
    })
    setReactions(grouped)
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

  const send = async (text = input.trim(), fileUrl = null, fileType = null) => {
    if (!text && !fileUrl) return
    setInput('')
    const senderName = isCoach ? 'Celia (Entrenadora)' : profile?.athletes?.name || 'Deportista'
    const senderId = isCoach ? 'coach' : (profile?.athlete_id || 'athlete')
    await DB.send(activeChat, text || (fileType?.startsWith('image/') ? '📷 Imagen' : '📎 Archivo'), senderId, senderName, fileUrl, fileType)
    await loadMessages()
  }

  const handleFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    try {
      const { url, type } = await DB.uploadFile(file)
      await send('', url, type)
    } catch (err) { alert('Error al subir: ' + (err.message || err)) }
    setUploading(false)
    e.target.value = ''
  }

  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = ['audio/webm', 'audio/mp4', 'audio/ogg', ''].find(t => !t || MediaRecorder.isTypeSupported(t)) || ''
      const ext = mimeType ? mimeType.split('/')[1].split(';')[0] : 'mp4'
      const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      audioChunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/mp4' })
        const file = new File([blob], `audio_${Date.now()}.${ext}`, { type: mimeType || 'audio/mp4' })
        setUploading(true)
        try {
          const { url, type } = await DB.uploadFile(file)
          await send('🎤 Audio', url, type)
        } catch (err) { alert('Error al enviar audio: ' + err.message) }
        setUploading(false)
      }
      mr.start(100)
      mediaRecorderRef.current = mr
      setRecording(true)
      setRecordingSeconds(0)
      recordingTimerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000)
    } catch (err) { alert('No se pudo acceder al micrófono: ' + err.message) }
  }

  const stopRecording = () => {
    clearInterval(recordingTimerRef.current)
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    setRecording(false)
    setRecordingSeconds(0)
  }

  const toggleRecording = () => {
    if (recording) stopRecording()
    else startRecording()
  }

  const toggleReaction = async (messageId, emoji) => {
    const senderId = myId
    await Reactions.toggle(messageId, senderId, emoji, activeChat)
    setReactionTarget(null)
    await loadMessages()
  }

  // Coach ve todos los chats, deportista solo el general y el suyo con la entrenadora
  const chats = isCoach
    ? [
        { id: 'general', name: 'Grupo general', subtitle: `${athletes.length} deportistas`, icon: '👥' },
        ...athletes.map(a => ({ id: a.id, name: a.name, subtitle: a.sport || 'Deportista', color: a.color }))
      ]
    : [
        { id: 'general', name: 'Grupo general', subtitle: 'Todo el equipo', icon: '👥' },
        { id: myAthleteId, name: 'Celia (Entrenadora)', subtitle: 'Chat privado', icon: '👩‍💼' }
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

  const myId = isCoach ? 'coach' : (profile?.athlete_id || 'athlete')

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={{ width: 76, flexShrink: 0, background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 4px', gap: 4, overflowY: 'auto' }}>
        {chats.map(c => {
          const isActive = activeChat === c.id
          const shortName = c.name.split(' ')[0]
          return (
            <button key={c.id} onClick={() => setActiveChat(c.id)}
              style={{ width: '100%', padding: '8px 4px', borderRadius: 12, cursor: 'pointer', background: isActive ? (c.id === 'general' ? 'var(--accent-dim)' : c.color+'15') : 'transparent', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                background: isActive ? (c.id === 'general' ? 'var(--accent)' : c.color) : 'var(--card)',
                border: isActive ? 'none' : `2px solid ${c.color || 'var(--border)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: c.icon ? 20 : 13, fontWeight: 800,
                color: isActive ? '#fff' : (c.color || 'var(--text-muted)'),
                boxShadow: isActive ? `0 4px 12px ${c.color || 'var(--accent)'}40` : 'none',
                transition: 'all 0.15s'
              }}>
                {c.icon ? c.icon : initials(c.name)}
              </div>
              <span style={{ fontSize: 9, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px', color: isActive ? 'var(--accent)' : 'var(--text-muted)', maxWidth: 68, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {shortName}
              </span>
            </button>
          )
        })}
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

        {reactionTarget && (
          <div onClick={() => setReactionTarget(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 5 }} />
        )}
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
                const isMe = msg.sender === myId
                const sender = !isMe ? athletes.find(a => a.id === msg.sender) : null
                const isCoachMsg = msg.sender === 'coach' || msg.sender === 'me'
                const avatarUrl = isCoachMsg ? coachAvatar : sender?.avatar_url
                return (
                  <div key={msg.id} style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', gap: 8, marginBottom: 10, alignItems: 'flex-end' }}>
                    {!isMe && (
                      <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, overflow: 'hidden', background: sender?.color+'30' || 'var(--accent-dim)', color: sender?.color || 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>
                        {avatarUrl
                          ? <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : (msg.senderName ? initials(msg.senderName) : '?')}
                      </div>
                    )}
                    <div style={{ maxWidth: '75%', position: 'relative' }}>
                      {!isMe && msg.senderName && (
                        <div style={{ fontSize: 11, color: sender?.color || 'var(--text-muted)', marginBottom: 3, marginLeft: 4, fontWeight: 600 }}>{msg.senderName}</div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, flexDirection: isMe ? 'row-reverse' : 'row' }}>
                      <div style={{ background: isMe ? 'var(--accent-gradient)' : 'var(--card)', color: isMe ? '#fff' : 'var(--text)', borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px', padding: msg.file_url && msg.file_type?.startsWith('image/') ? 4 : '10px 14px', fontSize: 14, border: isMe ? 'none' : '1px solid var(--border-light)', wordBreak: 'break-word', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                        {msg.file_url && msg.file_type?.startsWith('image/') ? (
                          <img src={msg.file_url} alt="imagen" style={{ maxWidth: 220, maxHeight: 220, borderRadius: 14, display: 'block' }} />
                        ) : msg.file_url && msg.file_type?.startsWith('audio/') ? (
                          <audio controls src={msg.file_url} style={{ maxWidth: 200, height: 36 }} />
                        ) : msg.file_url ? (
                          <a href={msg.file_url} target="_blank" rel="noopener noreferrer" style={{ color: isMe ? '#fff' : 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', fontWeight: 600 }}>
                            <span style={{ fontSize: 20 }}>📎</span>{msg.text}
                          </a>
                        ) : msg.text}
                      </div>
                      <button onClick={() => setReactionTarget(reactionTarget === msg.id ? null : msg.id)}
                        style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', opacity: 0.5, padding: '2px 4px', borderRadius: 8, flexShrink: 0, marginBottom: 4 }}>
                        😊
                      </button>
                      </div>
                      {/* Reacciones */}
                      {reactionTarget === msg.id && (
                        <div style={{ display: 'flex', gap: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 24, padding: '6px 10px', boxShadow: 'var(--shadow-md)', position: 'absolute', zIndex: 20, [isMe ? 'right' : 'left']: 0, bottom: 40 }}>
                          {REACTION_EMOJIS.map(emoji => (
                            <button key={emoji} onClick={() => toggleReaction(msg.id, emoji)}
                              style={{ fontSize: 22, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: 8, transition: 'transform 0.1s' }}>
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                      {/* Mostrar reacciones */}
                      {reactions[msg.id] && Object.keys(reactions[msg.id]).length > 0 && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4, justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                          {Object.entries(reactions[msg.id]).map(([emoji, senders]) => (
                            <button key={emoji} onClick={() => toggleReaction(msg.id, emoji)}
                              style={{ display: 'flex', alignItems: 'center', gap: 3, background: senders.includes(myId) ? 'var(--accent-dim)' : 'var(--card)', border: `1px solid ${senders.includes(myId) ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 12, padding: '2px 8px', fontSize: 13, cursor: 'pointer' }}>
                              {emoji} <span style={{ fontSize: 11, fontWeight: 600 }}>{senders.length}</span>
                            </button>
                          ))}
                        </div>
                      )}
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
          <input ref={fileRef} type="file" accept="image/*,.pdf,.doc,.docx" style={{ display: 'none' }} onChange={handleFile} />

          {recording ? (
            /* Barra de grabación */
            <>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'var(--error-dim)', borderRadius: 20, border: '1px solid var(--error)', minHeight: 42 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--error)', animation: 'pulse 1s infinite', flexShrink: 0 }} />
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--error)', fontFamily: "'Barlow Condensed', sans-serif" }}>
                  🎤 {String(Math.floor(recordingSeconds/60)).padStart(2,'0')}:{String(recordingSeconds%60).padStart(2,'0')}
                </span>
                <span style={{ fontSize: 12, color: 'var(--error)', opacity: 0.7 }}>Toca ⏹ para enviar</span>
              </div>
              <button onClick={toggleRecording}
                style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--error)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, cursor: 'pointer', flexShrink: 0 }}>
                ⏹
              </button>
            </>
          ) : (
            /* Barra normal */
            <>
              <button onClick={() => fileRef.current.click()} disabled={uploading}
                style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--card)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, cursor: 'pointer', flexShrink: 0 }}>
                {uploading ? '⏳' : '📎'}
              </button>
              <button onClick={toggleRecording} disabled={uploading}
                style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--card)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, cursor: 'pointer', flexShrink: 0 }}>
                🎤
              </button>
              <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
                placeholder="Escribe un mensaje..." rows={1}
                style={{ flex: 1, resize: 'none', minHeight: 40, maxHeight: 120, padding: '10px 14px', borderRadius: 20, fontSize: 15, background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none', lineHeight: 1.4, fontFamily: 'inherit' }} />
              <button onClick={() => send()} style={{ width: 42, height: 42, borderRadius: '50%', background: input.trim() ? 'var(--accent-gradient)' : 'var(--border)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, cursor: 'pointer', border: 'none', transition: 'all 0.15s', flexShrink: 0 }}>↑</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
