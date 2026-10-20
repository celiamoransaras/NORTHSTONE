import { useEffect, useState } from 'react'
import { getPlatform, isStandalone, canPromptInstall, promptInstall, onInstallChange, INSTALL_URL } from '../lib/install'

const ShareIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-3px' }} aria-label="Compartir">
    <path d="M12 3v12" /><path d="M8 7l4-4 4 4" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
  </svg>
)
const DotsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ verticalAlign: '-3px' }} aria-label="Menú">
    <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
  </svg>
)

const Step = ({ n, children }) => (
  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 0' }}>
    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>{n}</div>
    <div style={{ fontSize: 14, lineHeight: 1.5, paddingTop: 3 }}>{children}</div>
  </div>
)

const STEPS = {
  ios: [
    <>Abre <strong>northstone-nine.vercel.app</strong> en <strong>Safari</strong> (la brújula azul).</>,
    <>Toca el botón <strong>Compartir</strong> <ShareIcon />. Si no lo ves abajo, toca los tres puntos <strong>···</strong> (abajo a la derecha) y luego «Compartir».</>,
    <>Baja y toca <strong>«Añadir a pantalla de inicio»</strong>. Si no aparece, toca «Ver más» o «Editar acciones».</>,
    <>Toca <strong>«Añadir»</strong>. Ya tienes el icono de Northstone en tu móvil: ábrela siempre desde ahí.</>,
    <>Al entrar, acepta las <strong>notificaciones</strong> para recibir tus entrenos y los mensajes de Celia.</>,
  ],
  android: [
    <>Abre <strong>northstone-nine.vercel.app</strong> en <strong>Chrome</strong>.</>,
    <>Toca el menú <DotsIcon /> (arriba a la derecha).</>,
    <>Toca <strong>«Instalar aplicación»</strong> o <strong>«Añadir a pantalla de inicio»</strong> y confirma.</>,
    <>Ya tienes el icono de Northstone: ábrela siempre desde ahí.</>,
    <>Al entrar, acepta las <strong>notificaciones</strong> para recibir tus entrenos y los mensajes de Celia.</>,
  ],
}

export function InstallGuide({ onClose, isCoach = false }) {
  const p = getPlatform()
  const [os, setOs] = useState(p.android ? 'android' : 'ios')
  const [canPrompt, setCanPrompt] = useState(canPromptInstall())
  const [copied, setCopied] = useState(false)
  useEffect(() => onInstallChange(() => setCanPrompt(canPromptInstall())), [])
  const installed = isStandalone()

  const copyMessage = async () => {
    const msg = `¡Hola! Para tener Northstone como app en tu móvil abre este enlace y sigue los pasos: ${INSTALL_URL}`
    try { await navigator.clipboard.writeText(msg); setCopied(true); setTimeout(() => setCopied(false), 2500) }
    catch { window.prompt('Copia este mensaje:', msg) }
  }

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="sheet">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h3>📲 Instalar Northstone</h3>
          <button className="btn-close" aria-label="Cerrar" onClick={onClose}>✕</button>
        </div>
        <div className="sheet-body">
          {installed ? (
            <div style={{ padding: 14, borderRadius: 12, background: 'var(--success-dim)', color: 'var(--success)', fontWeight: 700, fontSize: 14, marginBottom: 14 }}>
              ✓ Ya estás usando Northstone como app en este dispositivo.
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
              No hace falta ninguna tienda de apps: en 30 segundos la tienes en tu pantalla de inicio, a pantalla completa y con notificaciones.
            </div>
          )}

          {p.inApp && !installed && (
            <div style={{ padding: 12, borderRadius: 12, background: 'var(--warning-dim, #FEF3C7)', color: '#92400E', fontSize: 13, marginBottom: 14, lineHeight: 1.5 }}>
              ⚠️ Has abierto el enlace desde otra app (WhatsApp, Instagram…). Toca los tres puntos o «Abrir en el navegador» y elige <strong>{p.iOS ? 'Safari' : 'Chrome'}</strong>.
            </div>
          )}

          {canPrompt && !installed && (
            <button className="btn btn-primary btn-full" style={{ marginBottom: 14 }} onClick={() => promptInstall()}>
              Instalar ahora
            </button>
          )}

          <div style={{ display: 'flex', background: 'var(--bg)', borderRadius: 12, padding: 4, gap: 4, marginBottom: 6 }}>
            {[{ id: 'ios', label: '📱 iPhone / iPad' }, { id: 'android', label: '🤖 Android' }].map(t => (
              <button key={t.id} onClick={() => setOs(t.id)}
                style={{ flex: 1, padding: '9px 0', borderRadius: 9, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 13, background: os === t.id ? 'var(--accent)' : 'transparent', color: os === t.id ? '#fff' : 'var(--text-muted)' }}>
                {t.label}
              </button>
            ))}
          </div>

          {STEPS[os].map((s, i) => <Step key={i} n={i + 1}>{s}</Step>)}

          {os === 'ios' && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>
              Las notificaciones en iPhone solo funcionan si abres Northstone desde el icono de la pantalla de inicio (iOS 16.4 o posterior).
            </div>
          )}

          {isCoach && (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Para tus deportistas</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.5 }}>
                Mándales este enlace: al abrirlo verán estos mismos pasos, adaptados a su móvil.
              </div>
              <button className="btn btn-full" onClick={copyMessage}
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', fontWeight: 700 }}>
                {copied ? '✓ Mensaje copiado' : '📋 Copiar mensaje con el enlace'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// Aviso discreto cuando se usa desde el navegador del móvil (no instalada)
export function InstallBanner({ onOpen }) {
  const [hidden, setHidden] = useState(() => {
    try { return (localStorage.getItem('ns_install_snooze') || '') > new Date().toISOString().slice(0, 10) } catch { return false }
  })
  const p = getPlatform()
  if (hidden || isStandalone() || !p.mobile) return null
  const snooze = (e) => {
    e.stopPropagation()
    const d = new Date(); d.setDate(d.getDate() + 7)
    try { localStorage.setItem('ns_install_snooze', d.toISOString().slice(0, 10)) } catch { /* sin almacenamiento */ }
    setHidden(true)
  }
  return (
    <div className="card" onClick={onOpen} role="button"
      style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', border: '1.5px solid var(--accent)', background: 'var(--accent-dim)' }}>
      <span style={{ fontSize: 26 }}>📲</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 14 }}>Instala Northstone en tu móvil</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Pantalla completa y notificaciones · 30 segundos</div>
      </div>
      <button onClick={snooze} aria-label="Ahora no" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', padding: 4 }}>Ahora no</button>
    </div>
  )
}
