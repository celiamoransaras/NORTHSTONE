import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

const COACH_EMAIL = import.meta.env.VITE_COACH_EMAIL || 'celia.moransaras@gmail.com'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = async (userId, email) => {
    const { data } = await supabase
      .from('profiles')
      .select('*, athletes(*)')
      .eq('id', userId)
      .single()

    if (data) {
      setProfile(data)
    } else {
      // Crear perfil automáticamente si no existe
      const isCoach = email === COACH_EMAIL
      let athleteId = null

      if (!isCoach) {
        // Buscar si el email corresponde a un atleta
        const { data: athlete } = await supabase
          .from('athletes')
          .select('id')
          .eq('email', email)
          .single()
        athleteId = athlete?.id || null
      }

      const newProfile = {
        id: userId,
        role: isCoach ? 'coach' : 'athlete',
        athlete_id: athleteId
      }

      await supabase.from('profiles').insert(newProfile)
      const { data: created } = await supabase
        .from('profiles')
        .select('*, athletes(*)')
        .eq('id', userId)
        .single()
      setProfile(created)
    }
  }

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 5000)

    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(timeout)
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfile(session.user.id, session.user.email).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    }).catch(() => {
      clearTimeout(timeout)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfile(session.user.id, session.user.email)
      } else {
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = (email, password) => supabase.auth.signInWithPassword({ email, password })
  const signOut = () => supabase.auth.signOut()
  const isCoach = profile?.role === 'coach'

  const updateAvatar = async (file) => {
    if (!user) return
    const ext = file.name.split('.').pop()
    const path = `coach_${user.id}.${ext}`
    await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    const url = data.publicUrl
    await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id)
    setProfile(p => ({ ...p, avatar_url: url }))
    return url
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, isCoach, signIn, signOut, updateAvatar }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
