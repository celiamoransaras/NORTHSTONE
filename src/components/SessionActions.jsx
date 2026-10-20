import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { ymd } from '../lib/dates'
import { downloadICS } from '../lib/ics'
import { sendPushToCoach } from '../lib/pushNotifications'
import { useToast } from '../contexts/ToastContext'
import SessionTimer from './SessionTimer'

const fmtDay = (d) => new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
const REASONS = ['Trabajo', 'Viaje', 'Molestia o lesión', 'Cansancio', 'Otro']

// Botones de la deportista dentro de una sesión: temporizador, calendario y pedir cambio de día
export default function SessionActions({ session, athleteId, athleteName, attended }) {
  const toast = useToast()
  const [timer, setTimer] = useState(false)
  const [changeOpen, setChangeOpen] = useState(false)
  const [pending, setPending] = useState(undefined) // undefined = cargando, null = sin petición, false = no disponible
  const today = ymd(new Date())
  const canMove = session?.date >= today && !attended

  const loadPending = () => {
    if (!session?.id || !athleteId) return
    supabase.from('session_change_requests').select('*').eq('session_id', session.id).eq('athlete_id', athleteId)
      .eq('status', 'pending').order('created_at', { ascending: false }).limit(1)
      .then(({ data, error }) => setPending(error ? false : (data?.[0] || null)))
  }
  useEffect(loadPending, [session?.id, athleteId]) // eslint-disable-line

  const cancel = async () => {
    const { error } = await supabase.from('session_change_requests').update({ status: 'cancelled', resolved_at: new Date().toISOString() }).eq('id', pending.id)
    if (error) { toast('No se pudo cancelar', 'error'); return }
    setPending(null); toast('Petición cancelada')
  }

  const Btn = ({ icon, label, onClick, disabled }) => (
    <button type="button" onClick={onClick} disabled={disabled}
      style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '10px 4px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg)', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.45 : 1, color: 'var(--text)' }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span style={{ fontSize: 12, fontWeight: 700 }}>{label}</span>
    </button>
  )

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <Btn icon="⏱" label="Temporizador" onClick={() => setTimer(true)} />
        <Btn icon="📅" label="A mi calendario" onClick={() => { downloadICS([session], `northstone-${session.date}.ics`); toast('Abre el archivo descargado para añadirlo a tu calendario', 'info') }} />
        {pending !== false && (
          <Btn icon="🔄" label="Cambiar día" disabled={!canMove || !!pending} onClick={() => setChangeOpen(true)} />
        )}
      </div>

      {pending && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: 'var(--warning-dim, #FEF3C7)', border: '1px solid #FDE68A', marginBottom: 14 }}>
          <span style={{ fontSize: 18 }}>🔄</span>
          <div style={{ flex: 1, fontSize: 13, lineHeight: 1.4 }}>
            Has pedido moverla al <strong>{fmtDay(pending.to_date)}</strong>. Celia te avisará cuando la confirme.
          </div>
          <button className="btn btn-ghost btn-sm" onClick={cancel}>Cancelar</button>
        </div>
      )}

      {timer && <SessionTimer title={session.title} onClose={() => setTimer(false)} />}
      {changeOpen && (
        <ChangeDaySheet session={session} athleteId={athleteId} athleteName={athleteName} toast={toast}
          onClose={() => setChangeOpen(false)} onDone={() => { setChangeOpen(false); loadPending() }} />
      )}
    </>
  )
}

function ChangeDaySheet({ session, athleteId, athleteName, toast, onClose, onDone }) {
  const today = ymd(new Date())
  const [toDate, setToDate] = useState('')
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  // Atajos: los próximos 7 días
  const quick = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return ymd(d) }).filter(d => d !== session.date)

  const send = async () => {
    if (!toDate || toDate === session.date) { toast('Elige el nuevo día', 'error'); return }
    setSaving(true)
    const text = [reason, note.trim()].filter(Boolean).join(' · ') || null
    const { error } = await supabase.from('session_change_requests').insert({ session_id: session.id, athlete_id: athleteId, from_date: session.date, to_date: toDate, reason: text })
    setSaving(false)
    if (error) { toast('No se pudo enviar: ' + error.message, 'error'); return }
    sendPushToCoach({ title: `🔄 ${athleteName || 'Una deportista'} pide cambiar un entreno`, body: `${session.title}: ${fmtDay(session.date)} → ${fmtDay(toDate)}${text ? ` (${text})` : ''}`, url: '/' })
    toast('Petición enviada a Celia')
    onDone()
  }

  return createPortal(
    <>
      <div className="overlay" onClick={onClose} style={{ zIndex: 2000 }} />
      <div className="sheet" style={{ zIndex: 2001 }}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{session.title} · {fmtDay(session.date)}</div>
            <h3>Pedir cambio de día</h3>
          </div>
          <button className="btn-close" aria-label="Cerrar" onClick={onClose}>✕</button>
        </div>
        <div className="sheet-body">
          <div className="input-label" style={{ marginBottom: 8 }}>¿Qué día te viene mejor?</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {quick.map(d => (
              <button key={d} type="button" onClick={() => setToDate(d)}
                style={{ padding: '8px 10px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${toDate === d ? 'var(--accent)' : 'var(--border)'}`, background: toDate === d ? 'var(--accent-dim)' : 'var(--card)', color: toDate === d ? 'var(--accent)' : 'var(--text)' }}>
                {fmtDay(d)}
              </button>
            ))}
          </div>
          <div className="input-group">
            <label className="input-label">U otra fecha</label>
            <input className="input" type="date" min={today} value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
          <div className="input-label" style={{ marginBottom: 8 }}>Motivo (opcional)</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {REASONS.map(r => (
              <button key={r} type="button" onClick={() => setReason(reason === r ? '' : r)}
                style={{ padding: '7px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: `1px solid ${reason === r ? 'var(--accent)' : 'var(--border)'}`, background: reason === r ? 'var(--accent-dim)' : 'var(--card)', color: reason === r ? 'var(--accent)' : 'var(--text-muted)' }}>
                {r}
              </button>
            ))}
          </div>
          <div className="input-group">
            <textarea className="input" rows={2} placeholder="Algo que quieras contarle a Celia..." value={note} onChange={e => setNote(e.target.value)} />
          </div>
          <button className="btn btn-primary btn-full" onClick={send} disabled={saving || !toDate}>{saving ? 'Enviando...' : toDate ? `Pedir moverla al ${fmtDay(toDate)}` : 'Elige un día'}</button>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 8 }}>La sesión no cambia hasta que Celia lo confirme.</div>
        </div>
      </div>
    </>,
    document.body
  )
}
