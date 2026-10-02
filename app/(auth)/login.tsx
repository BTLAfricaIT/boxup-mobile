import { useEffect, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

const typeLabels: Record<string, string> = { sales: 'Sales Activation', visit: 'Outlet Visit', event: 'Event' }

export default function LoginScreen() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [projects, setProjects] = useState<any[]>([])
  const [projectId, setProjectId] = useState('')
  const [loading, setLoading] = useState(false)
  const [info, setInfo] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('btl_projects').select('id, name, type').eq('is_active', true).order('name')
      .then(({ data }) => { if (data) setProjects(data) })
  }, [])

  async function handleSubmit() {
    setInfo(null)
    if (mode === 'signin') {
      if (!email.trim() || !password) { Alert.alert('Error', 'Enter your email and password'); return }
      setLoading(true)
      const err = await signIn(email.trim(), password)
      setLoading(false)
      if (err) Alert.alert('Sign-in failed', err)
    } else {
      if (!fullName.trim() || !phone.trim() || !email.trim() || !password) { Alert.alert('Error', 'Fill in your name, mobile number, email and password'); return }
      if (password.length < 6) { Alert.alert('Error', 'Password must be at least 6 characters'); return }
      if (!projectId) { Alert.alert('Error', 'Select the project you\'ll be working on'); return }
      setLoading(true)
      const err = await signUp(email.trim(), password, fullName.trim(), phone.trim(), projectId)
      setLoading(false)
      if (err) Alert.alert('Sign-up failed', err)
      else setInfo('Account created! Check your email to confirm, then sign in.')
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
        <View style={styles.card}>
          <Text style={styles.title}>BoxUp Sales</Text>
          <Text style={styles.subtitle}>
            {mode === 'signin' ? 'Sign in to log your sales' : 'Create your agent account'}
          </Text>

          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, mode === 'signin' && styles.tabActive]}
              onPress={() => { setMode('signin'); setInfo(null) }}
            >
              <Text style={[styles.tabText, mode === 'signin' && styles.tabTextActive]}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, mode === 'signup' && styles.tabActive]}
              onPress={() => { setMode('signup'); setInfo(null) }}
            >
              <Text style={[styles.tabText, mode === 'signup' && styles.tabTextActive]}>Create Account</Text>
            </TouchableOpacity>
          </View>

          {mode === 'signup' && (
            <>
              <TextInput
                style={styles.input}
                placeholder="Full name"
                placeholderTextColor="#94a3b8"
                value={fullName}
                onChangeText={setFullName}
              />
              <TextInput
                style={styles.input}
                placeholder="Mobile number"
                placeholderTextColor="#94a3b8"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
              <Text style={styles.pickerLabel}>Which project are you working on?</Text>
              <View style={styles.picker}>
                {projects.map(p => (
                  <TouchableOpacity key={p.id} onPress={() => setProjectId(p.id)}
                    style={[styles.option, projectId === p.id && styles.optionActive]}>
                    <Text style={[styles.optionText, projectId === p.id && styles.optionTextActive]}>{p.name}{p.type ? ` (${typeLabels[p.type] || p.type})` : ''}</Text>
                  </TouchableOpacity>
                ))}
                {!projects.length && <Text style={{ fontSize: 12, color: '#94a3b8' }}>No active projects yet — ask your manager.</Text>}
              </View>
            </>
          )}
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#94a3b8"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#94a3b8"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {info && <Text style={styles.info}>{info}</Text>}

          <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : (
              <Text style={styles.buttonText}>{mode === 'signin' ? 'Sign In' : 'Create Account'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#4d7c0f', padding: 24 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 28 },
  title: { fontSize: 26, fontWeight: '800', color: '#3f6212', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 20 },
  tabs: {
    flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 12,
    padding: 4, marginBottom: 18,
  },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center' },
  tabActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 1 },
  tabText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  tabTextActive: { color: '#0f172a' },
  input: {
    borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 12, fontSize: 15,
    color: '#0f172a', marginBottom: 14,
  },
  info: { color: '#16a34a', fontSize: 13, marginBottom: 12, textAlign: 'center' },
  pickerLabel: { fontSize: 12, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  picker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  option: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff' },
  optionActive: { backgroundColor: '#4d7c0f', borderColor: '#4d7c0f' },
  optionText: { fontSize: 13, color: '#475569' },
  optionTextActive: { color: '#fff', fontWeight: '600' },
  button: {
    backgroundColor: '#4d7c0f', borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', marginTop: 4,
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
})
