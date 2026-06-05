import { Routes, Route, NavLink } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Athletes from './pages/Athletes'
import Training from './pages/Training'
import Health from './pages/Health'
import Payments from './pages/Payments'
import Messages from './pages/Messages'
import AthleteView from './pages/AthleteView'
import Documents from './pages/Documents'

const NAV = [
  { to: '/',          icon: '⊞',  label: 'Inicio' },
  { to: '/athletes',  icon: '👥', label: 'Equipo' },
  { to: '/training',  icon: '📅', label: 'Entrenos' },
  { to: '/health',    icon: '🩺', label: 'Salud' },
  { to: '/payments',  icon: '💳', label: 'Pagos' },
  { to: '/documents', icon: '📂', label: 'Docs' },
  { to: '/messages',  icon: '💬', label: 'Chat' },
]

function CoachApp() {
  const { signOut } = useAuth()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', height: '100vh', overflow: 'hidden' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', height: 'var(--header-height)', background: 'var(--bg)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <span style={{ fontWeight: 800, fontSize: 20, letterSpacing: '-0.5px' }}>
          <span style={{ color: 'var(--accent)' }}>N</span>ORTHSTONE
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>C</div>
          <button className="btn btn-ghost btn-sm" onClick={signOut} style={{ fontSize: 12 }}>Salir</button>
        </div>
      </header>

      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Routes>
          <Route path="/"          element={<Dashboard />} />
          <Route path="/athletes"  element={<Athletes />} />
          <Route path="/training"  element={<Training />} />
          <Route path="/health"    element={<Health />} />
          <Route path="/payments"  element={<Payments />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/messages"  element={<Messages />} />
          <Route path="*"          element={<Dashboard />} />
        </Routes>
      </main>

      <nav style={{ display: 'flex', alignItems: 'stretch', height: 'var(--nav-height)', background: 'var(--surface)', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        {NAV.map(({ to, icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'}
            style={({ isActive }) => ({ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, textDecoration: 'none', color: isActive ? 'var(--accent)' : 'var(--text-muted)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px', transition: 'color 0.15s', borderTop: isActive ? '2px solid var(--accent)' : '2px solid transparent' })}>
            <span style={{ fontSize: 20, lineHeight: 1 }}>{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

function AppContent() {
  const { user, profile, loading, isCoach } = useAuth()

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
  return <AthleteView />
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
