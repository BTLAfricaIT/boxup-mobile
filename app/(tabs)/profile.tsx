import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, Alert } from 'react-native'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

const typeLabels: Record<string, string> = { sales: 'Sales Activation', visit: 'Outlet Visit', event: 'Event' }

export default function ProfileScreen() {
  const { profile, signOut, refreshProfile } = useAuth()
  const [projects, setProjects] = useState<any[]>([])
  const [showPicker, setShowPicker] = useState(false)
  const [saving, setSaving] = useState(false)
  const currentProject = profile?.project

  useEffect(() => {
    supabase.from('btl_projects').select('id, name, type').eq('is_active', true).order('name')
      .then(({ data }) => { if (data) setProjects(data) })
  }, [])

  async function changeProject(id: string) {
    setSaving(true)
    const { error } = await supabase.from('profiles').update({ project_id: id }).eq('id', profile!.id)
    setSaving(false)
    if (error) { Alert.alert('Error', error.message); return }
    setShowPicker(false)
    await refreshProfile()
  }

  return (
    <View style={styles.container}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{(profile?.full_name || profile?.email || '?').charAt(0).toUpperCase()}</Text>
      </View>
      <Text style={styles.name}>{profile?.full_name || 'Agent'}</Text>
      <Text style={styles.email}>{profile?.email}</Text>
      {profile?.phone && <Text style={styles.email}>{profile.phone}</Text>}
      <View style={styles.roleBadge}>
        <Text style={styles.roleText}>{(profile?.role || 'staff').replace(/_/g, ' ').toUpperCase()}</Text>
      </View>

      {profile?.role === 'agent' && (
        <TouchableOpacity style={styles.projectCard} onPress={() => setShowPicker(true)}>
          <Text style={styles.projectLabel}>PROJECT</Text>
          <Text style={styles.projectName}>{currentProject?.name || 'Not assigned — tap to choose'}</Text>
          {currentProject?.type && <Text style={styles.projectType}>{typeLabels[currentProject.type] || currentProject.type}</Text>}
          <Text style={styles.projectChange}>Change project</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.signOut} onPress={signOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      <Modal visible={showPicker} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Choose Your Project</Text>
            <TouchableOpacity onPress={() => setShowPicker(false)}><Text style={{ color: '#64748b', fontSize: 15 }}>Cancel</Text></TouchableOpacity>
          </View>
          <ScrollView>
            {projects.map(p => (
              <TouchableOpacity key={p.id} disabled={saving} onPress={() => changeProject(p.id)}
                style={[styles.projectOption, profile?.project_id === p.id && styles.projectOptionActive]}>
                <Text style={[styles.projectOptionText, profile?.project_id === p.id && styles.projectOptionTextActive]}>{p.name}</Text>
                {p.type && <Text style={[styles.projectOptionSub, profile?.project_id === p.id && styles.projectOptionTextActive]}>{typeLabels[p.type] || p.type}</Text>}
              </TouchableOpacity>
            ))}
            {!projects.length && <Text style={{ textAlign: 'center', color: '#94a3b8', marginTop: 40 }}>No active projects available.</Text>}
          </ScrollView>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', alignItems: 'center', paddingTop: 60 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#4d7c0f', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  avatarText: { fontSize: 32, fontWeight: '800', color: '#fff' },
  name: { fontSize: 22, fontWeight: '800', color: '#1e293b' },
  email: { fontSize: 14, color: '#64748b', marginTop: 4 },
  roleBadge: { marginTop: 12, backgroundColor: '#dbeafe', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  roleText: { fontSize: 12, fontWeight: '700', color: '#4d7c0f', letterSpacing: 0.5 },
  signOut: { marginTop: 32, backgroundColor: '#fff', borderWidth: 1, borderColor: '#fecaca', borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14 },
  signOutText: { color: '#ef4444', fontWeight: '700', fontSize: 15 },
  projectCard: { marginTop: 24, backgroundColor: '#fff', borderRadius: 14, padding: 16, width: '80%', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  projectLabel: { fontSize: 11, fontWeight: '700', color: '#94a3b8', letterSpacing: 0.5 },
  projectName: { fontSize: 15, fontWeight: '700', color: '#1e293b', marginTop: 4 },
  projectType: { fontSize: 12, color: '#64748b', marginTop: 2 },
  projectChange: { fontSize: 12, color: '#4d7c0f', marginTop: 8, fontWeight: '600' },
  modal: { flex: 1, backgroundColor: '#f8fafc', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
  projectOption: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 16, marginBottom: 10, backgroundColor: '#fff' },
  projectOptionActive: { backgroundColor: '#4d7c0f', borderColor: '#4d7c0f' },
  projectOptionText: { fontSize: 15, color: '#475569', fontWeight: '600' },
  projectOptionSub: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  projectOptionTextActive: { color: '#fff' },
})
