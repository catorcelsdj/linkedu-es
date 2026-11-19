import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../services/supabaseClient'
import { people } from '../services/api'
import { msgError } from '../lib/format'

const Ctx = createContext(null)
export const useAuth = () => useContext(Ctx)
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(!!supabase)
  const [error, setError] = useState('')
  const [recovery, setRecovery] = useState(false)
  const [ready, setReady] = useState(false)
  const request = useRef(0)
  const invalidate = useCallback(() => { request.current++ }, [])
  const uid = session?.user.id

  useEffect(() => {
    if (!supabase) return
    let active = true, eventSeen = false
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, next) => {
      if (!active) return
      eventSeen = true
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      if (!next) { setRecovery(false); setProfile(null) }
      setSession(next); setReady(true)
      if (!next) setError('')
    })
    supabase.auth.getSession().then(({ data, error: err }) => {
      if (!active || eventSeen) return
      if (err) setError(msgError(err))
      setSession(data?.session || null); setReady(true)
    }).catch(err => { if (active) { setError(msgError(err)); setReady(true) } })
    return () => { active = false; subscription.unsubscribe() }
  }, [])

  const refreshProfile = useCallback(async () => {
    const version = ++request.current
    if (!uid) { setProfile(null); if (ready) setLoading(false); return }
    setLoading(true); setError('')
    try {
      const data = await people.get(uid)
      if (version !== request.current) return
      if (!data) throw new Error('No se ha encontrado tu perfil. Vuelve a intentarlo o contacta con la persona que administra Linkedu.')
      setProfile(data)
    } catch (err) { if (version === request.current) { setProfile(null); setError(msgError(err)) } }
    finally { if (version === request.current) setLoading(false) }
  }, [uid, ready])
  useEffect(() => { refreshProfile(); return invalidate }, [refreshProfile, invalidate])

  const signOut = async () => {
    const result = await supabase.auth.signOut()
    if (result.error) throw result.error
    request.current++; setSession(null); setProfile(null); setRecovery(false)
  }
  const value = {
    session, profile, loading: loading || (!!uid && profile?.id !== uid && !error), error, recovery, refreshProfile, setProfile,
    signUp: (email, password, full_name, role, subject_area) => supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name, role, subject_area }, emailRedirectTo: window.location.origin } }),
    signIn: (email, password) => supabase.auth.signInWithPassword({ email: email.trim(), password }),
    signOut,
    resetPassword: email => supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin }),
    updatePassword: async password => { const result = await supabase.auth.updateUser({ password }); if (!result.error) setRecovery(false); return result },
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
