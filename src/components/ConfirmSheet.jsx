import { useEffect } from 'react'

export default function ConfirmSheet({ title, message, onConfirm, onCancel, confirmLabel, icon, danger = true }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onCancel])

  return (
    <>
      <div className="overlay" onClick={onCancel} />
      <div className="sheet" style={{ maxHeight: 'auto' }}>
        <div className="sheet-handle" />
        <div className="sheet-body" style={{ paddingTop: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 14 }}>{icon || '🗑️'}</div>
          <h3 style={{ marginBottom: 8, fontSize: 18 }}>{title}</h3>
          {message && (
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>{message}</p>
          )}
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'} btn-full`} onClick={onConfirm}>
            {confirmLabel || 'Sí, eliminar'}
          </button>
          <button className="btn btn-ghost btn-full" onClick={onCancel} style={{ marginTop: 10 }}>
            Cancelar
          </button>
        </div>
      </div>
    </>
  )
}
