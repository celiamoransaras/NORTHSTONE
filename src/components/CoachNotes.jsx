import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../contexts/ToastContext'

// Notas privadas de la entrenadora sobre una deportista (ella no las ve nunca)
export default function CoachNotes({ athleteId }) {
  const toast = useToast()
  const [notes, setNotes] = useState(null)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [showAll, setShowAll] = useState(false)

  const load = async () => {
    const { data, error } = await supabase.from('coach_notes').select('*').eq('athlete_id', athleteId)
      .order('pinned', { ascending: false }).order('created_at', { ascending: false })
    setNotes(error ? false : (data || []))
  }
  useEffect(() => { load() }, [athleteId]) // eslint-disable-line

  if (notes === null || notes === false) return null

  const add = async () => {
    if (!text.trim()) return
    setSaving(true)
    const { error } = await supabase.from('coach_notes').insert({ athlete_id: athleteId, text: text.trim() })
    setSaving(false)
    if (error) { toast('No se pudo guardar', 'error'); return }
    setText(''); load()
  }
  const togglePin = async (n) => { await supabase.from('coach_notes').update({ pinned: !n.pinned }).eq('id', n.id); load() }
  const remove = async (n) => {
    if (!window.confirm('¿Borrar esta nota?')) return
    await supabase.from('coach_notes').delete().eq('id', n.id); load()
  }
  const visible = showAll ? notes : notes.slice(0, 4)

  return (
    <div className="card" style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div style={{ fontWeight: 800, fontSize: 14 }}>🔒 Notas privadas</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Solo las ves tú</div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <textarea className="input" rows={2} value={text} onChange={e => setText(e.target.value)} placeholder="Ej.: le molesta la rodilla en zancadas, prefiere entrenar por la mañana..." style={{ flex: 1 }} />
        <button className="btn btn-primary btn-sm" onClick={add} disabled={saving || !text.trim()} style={{ alignSelf: 'stretch' }}>{saving ? '...' : 'Añadir'}</button>
      </div>
      {notes.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>Aún no has apuntado nada.</div>}
      <div style={{ marginTop: 6 }}>
        {visible.map(n => (
          <div key={n.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, whiteSpace: 'pre-line', lineHeight: 1.45 }}>{n.pinned && '📌 '}{n.text}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{new Date(n.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => togglePin(n)} aria-label={n.pinned ? 'Desfijar' : 'Fijar arriba'} title={n.pinned ? 'Desfijar' : 'Fijar arriba'}>{n.pinned ? '📍' : '📌'}</button>
            <button className="btn btn-ghost btn-sm" onClick={() => remove(n)} aria-label="Borrar nota">🗑</button>
          </div>
        ))}
      </div>
      {notes.length > 4 && (
        <button className="btn btn-ghost btn-sm btn-full" style={{ marginTop: 6 }} onClick={() => setShowAll(s => !s)}>
          {showAll ? 'Ver menos' : `Ver las ${notes.length} notas`}
        </button>
      )}
    </div>
  )
}
