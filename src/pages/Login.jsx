import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState('login')
  const [success, setSuccess] = useState('')
  const [showPass, setShowPass] = useState(false)

  const handle = async (e) => {
    e.preventDefault()
    setError(''); setSuccess('')
    setLoading(true)
    if (mode === 'login') {
      const { error: err } = await signIn(email, password)
      if (err) setError('Email o contraseña incorrectos')
    } else {
      const { error: err } = await supabase.auth.signUp({ email, password })
      if (err) setError(err.message)
      else setSuccess('¡Cuenta creada! Ya puedes iniciar sesión.')
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(160deg, #EEF2FF 0%, #F0EFED 50%, #E8F5F0 100%)',
      padding: 24, position: 'relative', overflow: 'hidden'
    }}>
      {/* Decorative blobs */}
      <div style={{ position: 'absolute', top: -80, right: -80, width: 280, height: 280, borderRadius: '50%', background: 'rgba(37,99,235,0.06)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -60, left: -60, width: 220, height: 220, borderRadius: '50%', background: 'rgba(79,70,229,0.05)', pointerEvents: 'none' }} />

      {/* Logo */}
      <div className="fade-in" style={{ textAlign: 'center', marginBottom: 36 }}>
        <div style={{
          width: 80, height: 80, borderRadius: 24,
          background: 'linear-gradient(135deg, #2563EB, #4F46E5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px', boxShadow: '0 12px 40px rgba(37,99,235,0.3)',
          fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 42, color: '#fff',
        }}>N</div>
        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 30, fontWeight: 900, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--text)' }}>
          NORTHSTONE
        </h1>
        <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 12, color: 'var(--text-muted)', marginTop: 4, fontWeight: 500 }}>
          by Celia Morán Saras
        </p>
      </div>

      {/* Card */}
      <div className="fade-in-1" style={{
        width: '100%', maxWidth: 380,
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRadius: 24, padding: '28px 24px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.08), 0 0 0 1px rgba(255,255,255,0.8)',
        display: 'flex', flexDirection: 'column', gap: 0
      }}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 800, textTransform: 'uppercase' }}>
            {mode === 'login' ? 'Bienvenida' : 'Crear cuenta'}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            {mode === 'login' ? 'Accede a tu plataforma deportiva' : 'Únete a Northstone'}
          </p>
        </div>

        <form onSubmit={handle} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Email</label>
            <input className="input" type="email" placeholder="tu@email.com"
              value={email} onChange={e => setEmail(e.target.value)} required
              style={{ background: 'var(--bg)' }} />
          </div>

          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Contraseña</label>
            <div style={{ position: 'relative' }}>
              <input className="input" type={showPass ? 'text' : 'password'} placeholder="••••••••"
                value={password} onChange={e => setPassword(e.target.value)}
                required minLength={6} style={{ background: 'var(--bg)', paddingRight: 48 }} />
              <button type="button" onClick={() => setShowPass(s => !s)}
                style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, padding: 4 }}>
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ background: 'var(--error-dim)', color: 'var(--error)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>⚠️</span>{error}
            </div>
          )}
          {success && (
            <div style={{ background: 'var(--success-dim)', color: 'var(--success)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>✅</span>{success}
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-full" disabled={loading}
            style={{ marginTop: 4, height: 50, fontSize: 17 }}>
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                Cargando...
              </span>
            ) : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>

          <button type="button" onClick={() => { setMode(m => m === 'login' ? 'signup' : 'login'); setError(''); setSuccess('') }}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', padding: '8px 0', textDecoration: 'underline', textDecorationColor: 'transparent', transition: 'color 0.15s' }}>
            {mode === 'login' ? '¿Primera vez? Crear cuenta' : '¿Ya tienes cuenta? Iniciar sesión'}
          </button>
        </form>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
