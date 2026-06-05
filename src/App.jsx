import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Athletes from './pages/Athletes'
import Training from './pages/Training'
import Health from './pages/Health'
import Payments from './pages/Payments'
import Messages from './pages/Messages'

const NAV = [
  { to: '/',         icon: '⊞',  label: 'Inicio' },
  { to: '/athletes', icon: '👥', label: 'Equipo' },
  { to: '/training', icon: '📅', label: 'Entrenos' },
  { to: '/health',   icon: '🩺', label: 'Salud' },
  { to: '/payments', icon: '💳', label: 'Pagos' },
  { to: '/messages', icon: '💬', label: 'Chat' },
]

export default function App() {
  const location = useLocation()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', height: '100vh', overflow: 'hidden' }}>
      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', height: 'var(--header-height)',
        background: 'var(--bg)', borderBottom: '1px solid var(--border)',
        flexShrink: 0
      }}>
        <span style={{ fontWeight: 800, fontSize: 20, letterSpacing: '-0.5px' }}>
          <span style={{ color: 'var(--accent)' }}>N</span>ORTHSTONE
        </span>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'var(--accent)', color: '#000',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 15
        }}>C</div>
      </header>

      {/* Main content */}
      <main style={{ flex: 1, overflow: 'hidden' }}>
        <Routes>
          <Route path="/"          element={<Dashboard />} />
          <Route path="/athletes"  element={<Athletes />} />
          <Route path="/training"  element={<Training />} />
          <Route path="/health"    element={<Health />} />
          <Route path="/payments"  element={<Payments />} />
          <Route path="/messages"  element={<Messages />} />
        </Routes>
      </main>

      {/* Bottom nav */}
      <nav style={{
        display: 'flex', alignItems: 'stretch',
        height: 'var(--nav-height)',
        background: 'var(--surface)', borderTop: '1px solid var(--border)',
        flexShrink: 0
      }}>
        {NAV.map(({ to, icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'}
            style={({ isActive }) => ({
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 2,
              textDecoration: 'none',
              color: isActive ? 'var(--accent)' : 'var(--text-muted)',
              fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: '0.3px',
              transition: 'color 0.15s',
              borderTop: isActive ? '2px solid var(--accent)' : '2px solid transparent',
            })}>
            <span style={{ fontSize: 20, lineHeight: 1 }}>{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
