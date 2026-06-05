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
      background: 'var(--bg)', padding: 24
    }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{
          width: 72, height: 72, borderRadius: 20,
          background: 'var(--accent)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontSize: 36, fontWeight: 900, color: '#000',
          margin: '0 auto 16px'
        }}>N</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px' }}>NORTHSTONE</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>Tu plataforma deportiva</p>
      </div>

      <form onSubmit={handle} style={{
        width: '100%', maxWidth: 360,
        background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: 24,
        display: 'flex', flexDirection: 'column', gap: 16
      }}>
        <h2 style={{ fontSize: 18, marginBottom: 4 }}>
          {mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
        </h2>

        <div className="input-group" style={{ marginBottom: 0 }}>
          <label className="input-label">Email</label>
          <input className="input" type="email" placeholder="tu@email.com"
            value={email} onChange={e => setEmail(e.target.value)} required />
        </div>

        <div className="input-group" style={{ marginBottom: 0 }}>
          <label className="input-label">Contraseña</label>
          <input className="input" type="password" placeholder="••••••••"
            value={password} onChange={e => setPassword(e.target.value)}
            required minLength={6} />
        </div>

        {error && (
          <div style={{ background: 'var(--error-dim)', color: 'var(--error)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: 14 }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ background: 'var(--success-dim)', color: 'var(--success)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: 14 }}>
            {success}
          </div>
        )}

        <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
          {loading ? 'Cargando...' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
        </button>

        <button type="button" className="btn btn-ghost btn-full"
          style={{ fontSize: 13, color: 'var(--text-muted)' }}
          onClick={() => { setMode(m => m === 'login' ? 'signup' : 'login'); setError(''); setSuccess('') }}>
          {mode === 'login' ? '¿Primera vez? Crear cuenta' : '¿Ya tienes cuenta? Entrar'}
        </button>
      </form>
    </div>
  )
}
