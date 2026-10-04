import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface Profile {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  role: string
  project_id: string | null
  project: { id: string; name: string; type: string | null } | null
}

interface AuthContextValue {
  session: Session | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (email: string, password: string, fullName: string, phone: string, projectId: string) => Promise<string | null>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(userId: string) {
    const { data } = await supabase.from('profiles').select('id, full_name, email, phone, role, project_id, project:btl_projects!profiles_project_id_fkey(id, name, type, outlet_mode, capture_orders, hidden_fields)').eq('id', userId).single()
    setProfile(data as any)
  }

  async function refreshProfile() {
    if (session?.user) await loadProfile(session.user.id)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session?.user) {
        loadProfile(data.session.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      if (newSession?.user) loadProfile(newSession.user.id)
      else { setProfile(null) }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error, data } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return error.message
    const { data: prof } = await supabase.from('profiles').select('is_active').eq('id', data.user.id).single()
    if (prof && prof.is_active === false) {
      await supabase.auth.signOut()
      return 'This account has been deactivated. Contact your administrator.'
    }
    return null
  }

  const signUp = async (email: string, password: string, fullName: string, phone: string, projectId: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, phone, app_source: 'mobile', project_id: projectId || null } },
    })
    return error?.message ?? null
  }

  const signOut = async () => { await supabase.auth.signOut() }

  return (
    <AuthContext.Provider value={{ session, profile, loading, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
