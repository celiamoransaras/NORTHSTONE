import { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)

const ICONS = { success: '✓', error: '⚠️', info: 'ℹ️' }
const COLORS = {
  success: { bg: '#0F172A', border: 'rgba(255,255,255,0.08)' },
  error:   { bg: '#DC2626', border: 'rgba(255,255,255,0.12)' },
  info:    { bg: '#2563EB', border: 'rgba(255,255,255,0.12)' },
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const toast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random()
    setToasts(t => [...t, { id, message, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200)
  }, [])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div style={{
        position: 'fixed',
        top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
        left: 16, right: 16,
        zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: 8,
        pointerEvents: 'none',
      }}>
        {toasts.map(t => {
          const c = COLORS[t.type] || COLORS.success
          return (
            <div key={t.id} style={{
              background: c.bg,
              border: `1px solid ${c.border}`,
              color: '#fff',
              borderRadius: 16,
              padding: '13px 18px',
              fontSize: 14,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              boxShadow: '0 8px 32px rgba(0,0,0,0.28), 0 2px 8px rgba(0,0,0,0.12)',
              animation: 'toastIn 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)',
              fontFamily: "'Barlow', sans-serif",
            }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{ICONS[t.type]}</span>
              <span style={{ flex: 1 }}>{t.message}</span>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
