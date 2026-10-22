import { Routes, Route, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ToastProvider, useToast } from './contexts/ToastContext'
import { useState, useEffect, lazy, Suspense, Component } from 'react'
import { supabase } from './lib/supabase'
import { usePushNotifications } from './hooks/usePushNotifications'
import Login from './pages/Login'
import Icon from './components/Icon'
import ThemeToggle from './components/ThemeToggle'
import { InstallGuide } from './components/InstallGuide'
import { isStandalone } from './lib/install'
import { isDemoMode, enableDemoMode, disableDemoMode } from './lib/demoMode'

const Dashboard  = lazy(() => import('./pages/Dashboard'))
const Athletes   = lazy(() => import('./pages/Athletes'))
const Training   = lazy(() => import('./pages/Training'))
const Health     = lazy(() => import('./pages/Health'))
const Payments   = lazy(() => import('./pages/Payments'))
const Messages   = lazy(() => import('./pages/Messages'))
const AthleteView = lazy(() => import('./pages/AthleteView'))
const Documents  = lazy(() => import('./pages/Documents'))
const Library    = lazy(() => import('./components/Exercises'))
const NutritionistView = lazy(() => import('./pages/NutritionistView'))

class ErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (this.state.error) return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 32, textAlign: 'center', gap: 16 }}>
        <div style={{ fontSize: 48 }}>⚠️</div>
        <h3 style={{ marginBottom: 0 }}>Algo ha fallado</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Recarga la página para continuar</p>
        <button className="btn btn-primary btn-sm" onClick={() => window.location.reload()}>Recargar</button>
      </div>
    )
    return this.props.children
  }
}

function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 13 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'spin 0.7s linear infinite' }} />
      </div>
    </div>
  )
}

// Menú inferior: 5 botones como máximo; lo demás va en "Más"
const NAV = [
  { to: '/',          icon: 'home',     label: 'Inicio' },
  { to: '/athletes',  icon: 'users',    label: 'Equipo' },
  { to: '/training',  icon: 'calendar', label: 'Entrenos' },
  { to: '/messages',  icon: 'chat',     label: 'Chat' },
]
const MORE = [
  { to: '/health',    icon: 'health', label: 'Salud',      desc: 'Lesiones y ciclo del equipo' },
  { to: '/payments',  icon: 'card',   label: 'Pagos',      desc: 'Cuotas del mes' },
  { to: '/documents', icon: 'folder', label: 'Documentos', desc: 'Archivos y documentos' },
  { to: '/library',   icon: 'target', label: 'Biblioteca', desc: 'Ejercicios, técnica y tus vídeos' },
]

function useUnreadMessages() {
  const [unread, setUnread] = useState(0)
  const location = useLocation()

  const checkUnread = async () => {
    let lastRead = localStorage.getItem('chat_last_read')
    if (!lastRead) {
      lastRead = new Date().toISOString()
      localStorage.setItem('chat_last_read', lastRead)
    }
    const { count } = await supabase.from('messages')
      .select('*', { count: 'exact', head: true })
      .neq('sender', 'coach')
      .gt('created_at', lastRead)
    setUnread(count || 0)
  }

  useEffect(() => {
    checkUnread()
    const channel = supabase.channel('unread_check')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, checkUnread)
      .subscribe()
    return () => channel.unsubscribe()
  }, [])

  useEffect(() => {
    if (location.pathname === '/messages') {
      localStorage.setItem('chat_last_read', new Date().toISOString())
      setUnread(0)
    }
  }, [location.pathname])

  return unread
}

function CoachApp() {
  const { signOut, profile, updateAvatar, user } = useAuth()
  const unreadMessages = useUnreadMessages()
  const toast = useToast()
  const { subscribed: pushSubscribed, loading: pushLoading, supported: pushSupported, enable: enablePush, disable: disablePush } = usePushNotifications({ userId: user?.id, isCoach: true })
  const navigate = useNavigate()
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  const [fabOpen, setFabOpen] = useState(false)
  const [installOpen, setInstallOpen] = useState(false)
  useEffect(() => { setMoreOpen(false); setFabOpen(false) }, [location.pathname])
  const inMore = MORE.some(m => location.pathname.startsWith(m.to))
  const go = (to, state) => { setMoreOpen(false); setFabOpen(false); navigate(to, state ? { state } : undefined) }

  const handleAvatarClick = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async (e) => {
      const file = e.target.files[0]
      if (file) await updateAvatar(file)
    }
    input.click()
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
      <header className="app-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', height: 'var(--header-height)', background: 'var(--bg)', flexShrink: 0 }}>
        <div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 20, letterSpacing: '1px', textTransform: 'uppercase', lineHeight: 1.1 }}>
            <span style={{ color: 'var(--accent)' }}>N</span>ORTHSTONE
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => {
              if (!pushSupported) {
                toast('Para activar notificaciones, añade la app a tu pantalla de inicio: Safari → compartir → "Añadir a pantalla de inicio"', 'info')
                return
              }
              pushSubscribed ? disablePush() : enablePush()
            }}
            disabled={pushLoading}
            title={pushSubscribed ? 'Desactivar notificaciones' : 'Activar notificaciones'}
            style={{ background: pushSubscribed ? 'var(--accent-dim)' : 'var(--card)', border: `1px solid ${pushSubscribed ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 10, padding: '6px 10px', cursor: 'pointer', fontSize: 16, lineHeight: 1, color: pushSubscribed ? 'var(--accent)' : 'var(--text-muted)', transition: 'all 0.15s' }}>
            {pushLoading ? '⏳' : pushSubscribed ? '🔔' : '🔕'}
          </button>
          <div onClick={handleAvatarClick} title="Cambiar tu foto" role="button" aria-label="Cambiar tu foto" className="avatar-ring" style={{ width: 38, height: 38, borderRadius: '50%', background: profile?.avatar_url ? 'transparent' : 'var(--accent-gradient)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 15, cursor: 'pointer', overflow: 'hidden', flexShrink: 0 }}>
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt="foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : 'C'}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={signOut}>Salir</button>
        </div>
      </header>

      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/"          element={<Dashboard />} />
              <Route path="/athletes"  element={<Athletes />} />
              <Route path="/training"  element={<Training />} />
              <Route path="/health"    element={<Health />} />
              <Route path="/payments"  element={<Payments />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/messages"  element={<Messages />} />
              <Route path="/library"   element={<Library />} />
              <Route path="*"          element={<Dashboard />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>

      {/* Botón flotante: acciones rápidas */}
      <ScrollTopButton />
      <DemoBanner />

      {location.pathname !== '/messages' && !location.pathname.startsWith('/training') && (
        <>
          {fabOpen && (
            <>
              <div onClick={() => setFabOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 89, background: 'rgba(0,0,0,0.25)' }} />
              <div style={{ position: 'fixed', right: 18, bottom: 'calc(var(--nav-height) + env(safe-area-inset-bottom) + 84px)', zIndex: 91, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                {[
                  { icon: 'calendar', label: 'Nueva sesión', to: '/training', state: { openNew: Date.now() } },
                  { icon: 'chat', label: 'Escribir un mensaje', to: '/messages' },
                  { icon: 'pencil', label: 'Ficha / nota de una deportista', to: '/athletes' },
                ].map(a => (
                  <button key={a.label} onClick={() => go(a.to, a.state)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px 10px 12px', minHeight: 44, borderRadius: 24, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', boxShadow: 'var(--shadow-md)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                    <span style={{ color: 'var(--accent)' }}><Icon name={a.icon} size={20} /></span>{a.label}
                  </button>
                ))}
              </div>
            </>
          )}
          <button className="fab" aria-label={fabOpen ? 'Cerrar acciones rápidas' : 'Acciones rápidas'} onClick={() => setFabOpen(o => !o)}>
            <span style={{ transform: fabOpen ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s' }}><Icon name="plus" size={26} strokeWidth={2.4} /></span>
          </button>
        </>
      )}

      {/* Más: Salud, Pagos, Documentos, apariencia e instalación */}
      {moreOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200 }} onClick={() => setMoreOpen(false)}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.25)' }} />
          <div className="sheet" style={{ bottom: 'calc(var(--nav-height) + env(safe-area-inset-bottom))', borderRadius: 20, padding: '16px 16px 12px', animation: 'none' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 15, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Más</span>
              <button className="btn-close" aria-label="Cerrar" onClick={() => setMoreOpen(false)}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 14 }}>
              {MORE.map(m => {
                const active = location.pathname.startsWith(m.to)
                return (
                  <button key={m.to} onClick={() => go(m.to)}
                    style={{ background: active ? 'var(--accent-dim)' : 'var(--bg)', border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 14, padding: '14px 10px', cursor: 'pointer', textAlign: 'left', color: 'var(--text)' }}>
                    <span style={{ color: 'var(--accent)' }}><Icon name={m.icon} size={24} /></span>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 15, color: active ? 'var(--accent)' : 'var(--text)', textTransform: 'uppercase', marginTop: 6 }}>{m.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{m.desc}</div>
                  </button>
                )
              })}
            </div>
            <ThemeToggle />
            <DemoToggle />
            {!isStandalone() && (
              <button className="btn btn-secondary btn-full" style={{ marginTop: 12 }} onClick={() => { setMoreOpen(false); setInstallOpen(true) }}>
                <Icon name="phone" size={18} /> Instalar la app
              </button>
            )}
          </div>
        </div>
      )}
      {installOpen && <InstallGuide isCoach onClose={() => setInstallOpen(false)} />}

      <nav className="glass-nav" style={{ display: 'flex', alignItems: 'stretch', height: 'var(--nav-height)', flexShrink: 0, paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {NAV.map(({ to, icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'}
            style={({ isActive }) => ({ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, textDecoration: 'none', color: isActive && !moreOpen ? 'var(--accent)' : 'var(--text-muted)', fontSize: 11, fontWeight: 700, transition: 'color 0.15s' })}>
            <span style={{ lineHeight: 1, position: 'relative', display: 'inline-block' }}>
              <Icon name={icon} size={24} />
              {to === '/messages' && unreadMessages > 0 && (
                <span style={{ position: 'absolute', top: -4, right: -8, background: 'var(--error)', color: '#fff', borderRadius: '50%', fontSize: 11, fontWeight: 800, minWidth: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', fontFamily: "'Barlow Condensed', sans-serif" }}>
                  {unreadMessages > 99 ? '99+' : unreadMessages}
                </span>
              )}
            </span>
            {label}
          </NavLink>
        ))}
        <button onClick={() => setMoreOpen(o => !o)} aria-expanded={moreOpen}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: moreOpen || inMore ? 'var(--accent)' : 'var(--text-muted)', fontSize: 11, fontWeight: 700 }}>
          <Icon name="more" size={24} />
          Más
        </button>
      </nav>
    </div>
  )
}

function AppContent() {
  const { user, profile, loading, isCoach, isNutritionist } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: 'var(--bg)', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 48 }}>
          <span style={{ color: 'var(--accent)', fontWeight: 900 }}>N</span>
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Cargando...</div>
      </div>
    )
  }

  if (!user) return <Login />
  if (isCoach) return <CoachApp />
  if (isNutritionist) return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <NutritionistView />
      </Suspense>
    </ErrorBoundary>
  )
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <AthleteView />
      </Suspense>
      <ScrollTopButton />
      <DemoBanner />
    </ErrorBoundary>
  )
}

// Botón «Arriba»: aparece al bajar mucho en una página o en una hoja larga
function ScrollTopButton() {
  const [target, setTarget] = useState(null)
  const location = useLocation()
  useEffect(() => { setTarget(null) }, [location.pathname])
  useEffect(() => {
    const onScroll = (e) => {
      const t = e.target
      if (!(t instanceof Element) || !t.matches('.page, .sheet, .sheet-body')) return
      setTarget(prev => (t.scrollTop > 900 ? t : (prev === t ? null : prev)))
    }
    document.addEventListener('scroll', onScroll, true)
    return () => document.removeEventListener('scroll', onScroll, true)
  }, [])
  // Al cambiar de pestaña dentro de la misma pantalla no hay evento de scroll: lo comprobamos cada poco
  useEffect(() => {
    if (!target) return
    const t = setInterval(() => { if (!target.isConnected || target.scrollTop < 600 || target.offsetParent === null) setTarget(null) }, 700)
    return () => clearInterval(t)
  }, [target])
  if (!target || !target.isConnected) return null
  return (
    <button type="button" aria-label="Volver arriba" onClick={() => { target.scrollTo({ top: 0, behavior: 'smooth' }); setTarget(null) }}
      style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 'calc(var(--nav-height) + env(safe-area-inset-bottom) + 14px)', zIndex: 2500, padding: '8px 16px', minHeight: 40, borderRadius: 20, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', boxShadow: 'var(--shadow-md)', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
      ↑ Arriba
    </button>
  )
}

// Modo demo: enseñar la app solo con deportistas de ejemplo (en este dispositivo)
function DemoToggle() {
  const toast = useToast()
  const on = isDemoMode()
  const [busy, setBusy] = useState(false)
  const toggle = async () => {
    setBusy(true)
    try {
      if (on) disableDemoMode()
      else await enableDemoMode(supabase)
      window.location.reload()
    } catch (e) { toast('No se pudo activar: ' + (e.message || e), 'error'); setBusy(false) }
  }
  return (
    <button type="button" onClick={toggle} disabled={busy} className="btn btn-secondary btn-full" style={{ marginTop: 12, justifyContent: 'space-between' }}>
      <span style={{ textAlign: 'left' }}>
        <span style={{ display: 'block' }}>Modo demo</span>
        <span style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>{on ? 'Activo: solo se ven las deportistas de ejemplo' : 'Para enseñar la app sin mostrar a tus clientas'}</span>
      </span>
      <span style={{ width: 44, height: 26, borderRadius: 13, background: on ? 'var(--accent)' : 'var(--border)', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
        <span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
      </span>
    </button>
  )
}

// Aviso visible mientras el modo demo está activo
export function DemoBanner() {
  if (!isDemoMode()) return null
  return (
    <button type="button" onClick={() => { disableDemoMode(); window.location.reload() }}
      style={{ position: 'fixed', top: 'calc(env(safe-area-inset-top, 0px) + 6px)', left: '50%', transform: 'translateX(-50%)', zIndex: 3000, padding: '4px 12px', borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 800, cursor: 'pointer', boxShadow: 'var(--shadow-md)' }}>
      Modo demo · salir
    </button>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  )
}
