import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
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

function useUnreadMessages() {
  const [unread, setUnread] = useState(0)
  const location = useLocation()

  const checkUnread = async () => {
    const lastRead = localStorage.getItem('chat_last_read') || new Date(0).toISOString()
    const { count } = await supabase.from('messages')
      .select('*', { count: 'exact', head: true })
      .not('sender', 'in', '(coach,me)')
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
  const { signOut, profile, updateAvatar } = useAuth()
  const unreadMessages = useUnreadMessages()

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
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', height: 'var(--header-height)', background: 'var(--bg)', flexShrink: 0 }}>
        <div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 20, letterSpacing: '1px', textTransform: 'uppercase', lineHeight: 1.1 }}>
            <span style={{ color: 'var(--accent)' }}>N</span>ORTHSTONE
          </div>
          <div style={{ fontFamily: "'Barlow', sans-serif", fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.3px', marginTop: 1 }}>
            by Celia Morán Saras
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div onClick={handleAvatarClick} className="avatar-ring" style={{ width: 38, height: 38, borderRadius: '50%', background: profile?.avatar_url ? 'transparent' : 'var(--accent-gradient)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 15, cursor: 'pointer', overflow: 'hidden', flexShrink: 0 }}>
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt="foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : 'C'}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={signOut}>Salir</button>
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

      <nav className="glass-nav" style={{ display: 'flex', alignItems: 'stretch', height: 'var(--nav-height)', flexShrink: 0, paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {NAV.map(({ to, icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'}
            style={({ isActive }) => ({ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, textDecoration: 'none', color: isActive ? 'var(--accent)' : 'var(--text-muted)', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', transition: 'color 0.15s' })}>
            <span style={{ fontSize: 22, lineHeight: 1, position: 'relative', display: 'inline-block' }}>
              {icon}
              {to === '/messages' && unreadMessages > 0 && (
                <span style={{ position: 'absolute', top: -4, right: -8, background: 'var(--error)', color: '#fff', borderRadius: '50%', fontSize: 10, fontWeight: 800, minWidth: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', fontFamily: "'Barlow Condensed', sans-serif" }}>
                  {unreadMessages > 99 ? '99+' : unreadMessages}
                </span>
              )}
            </span>
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
