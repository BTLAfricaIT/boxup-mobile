import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, StyleSheet, Alert, ActivityIndicator, RefreshControl } from 'react-native'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

export default function VisitsScreen() {
  const { profile } = useAuth()
  const [visits, setVisits] = useState<any[]>([])
  const [outlets, setOutlets] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [form, setForm] = useState({ outlet_id: '', outlet_name: '', purpose: '', outcome: '', notes: '' })
  const typedOutlet = (profile as any)?.project?.outlet_mode === 'agent'

  async function load() {
    let visitsQuery = supabase.from('btl_visits').select('*, btl_outlets(name), btl_projects(name)').order('created_at', { ascending: false }).limit(50)
    if (profile?.project_id) visitsQuery = visitsQuery.eq('project_id', profile.project_id)
    let outletsQuery = supabase.from('btl_outlets').select('id, name').eq('is_active', true).order('name')
    if (profile?.project_id) outletsQuery = outletsQuery.or(`project_id.is.null,project_id.eq.${profile.project_id}`)
    const [v, o] = await Promise.all([
      visitsQuery,
      outletsQuery,
    ])
    if (v.data) setVisits(v.data)
    if (o.data) setOutlets(o.data)
  }

  useEffect(() => { load() }, [profile?.project_id])

  async function save() {
    if (!profile?.project_id) { Alert.alert('No project assigned', 'Choose a project on your Profile tab before logging a visit.'); return }
    if (typedOutlet && !form.outlet_name.trim()) { Alert.alert('Outlet required', 'Type the name of the outlet you visited.'); return }
    setSaving(true)
    const { error } = await supabase.from('btl_visits').insert({
      agent_id: profile!.id,
      outlet_id: typedOutlet ? null : (form.outlet_id || null),
      outlet_name: typedOutlet ? form.outlet_name.trim() : null,
      project_id: profile.project_id,
      purpose: form.purpose || null,
      outcome: form.outcome || null,
      notes: form.notes || null,
      visit_date: new Date().toISOString().slice(0, 10),
    })
    setSaving(false)
    if (error) { Alert.alert('Error', error.message); return }
    setShowForm(false); setForm({ outlet_id: '', outlet_name: '', purpose: '', outcome: '', notes: '' }); load()
  }

  async function onRefresh() { setRefreshing(true); await load(); setRefreshing(false) }

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Retail Visits</Text>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: '#059669' }]} onPress={() => profile?.project_id ? setShowForm(true) : Alert.alert('No project assigned', 'Choose a project on your Profile tab before logging a visit.')}>
          <Text style={styles.addBtnText}>+ Log Visit</Text>
        </TouchableOpacity>
      </View>
      {!profile?.project_id && <Text style={styles.noProjectBanner}>Choose your project on the Profile tab to start logging.</Text>}

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {visits.map((v, i) => (
          <View key={v.id} style={[styles.card, i === 0 && { marginTop: 12 }]}>
            <Text style={styles.cardTitle}>{v.btl_outlets?.name || v.outlet_name || 'Unknown outlet'}</Text>
            <Text style={styles.cardSub}>{v.visit_date}{v.btl_projects?.name ? ` · ${v.btl_projects.name}` : ''}</Text>
            {v.purpose && <Text style={styles.detail}>Purpose: {v.purpose}</Text>}
            {v.outcome && <Text style={styles.detail}>Outcome: {v.outcome}</Text>}
          </View>
        ))}
        {!visits.length && <Text style={styles.empty}>No visits yet. Tap + to log one.</Text>}
      </ScrollView>

      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Log Retail Visit</Text>
            <TouchableOpacity onPress={() => setShowForm(false)}><Text style={{ color: '#64748b', fontSize: 15 }}>Cancel</Text></TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }}>
            <Text style={styles.label}>Outlet</Text>
            {typedOutlet ? (
              <TextInput style={styles.input} value={form.outlet_name} onChangeText={v => setForm(f => ({ ...f, outlet_name: v }))} placeholder="Type the outlet you visited" />
            ) : (
              <View style={styles.picker}>
                {outlets.map(o => (
                  <TouchableOpacity key={o.id} onPress={() => setForm(f => ({ ...f, outlet_id: o.id }))}
                    style={[styles.option, form.outlet_id === o.id && styles.optionActive]}>
                    <Text style={[styles.optionText, form.outlet_id === o.id && styles.optionTextActive]}>{o.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <Text style={styles.label}>Purpose</Text>
            <TextInput style={styles.input} value={form.purpose} onChangeText={v => setForm(f => ({ ...f, purpose: v }))} placeholder="e.g. Restocking, Training…" />
            <Text style={styles.label}>Outcome</Text>
            <TextInput style={styles.input} value={form.outcome} onChangeText={v => setForm(f => ({ ...f, outcome: v }))} placeholder="What was achieved?" />
            <Text style={styles.label}>Notes</Text>
            <TextInput style={[styles.input, { height: 80 }]} multiline value={form.notes} onChangeText={v => setForm(f => ({ ...f, notes: v }))} placeholder="Optional…" />
          </ScrollView>

          <TouchableOpacity style={[styles.submitBtn, { backgroundColor: '#059669' }]} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit Visit</Text>}
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  addBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  card: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 10, borderRadius: 14, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  cardSub: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  detail: { fontSize: 13, color: '#475569', marginTop: 6 },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 60, fontSize: 14 },
  noProjectBanner: { backgroundColor: '#fef3c7', color: '#92400e', fontSize: 12, textAlign: 'center', paddingVertical: 8 },
  modal: { flex: 1, backgroundColor: '#f8fafc', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
  label: { fontSize: 12, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#0f172a', marginBottom: 16, backgroundColor: '#fff' },
  picker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  option: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff' },
  optionActive: { backgroundColor: '#059669', borderColor: '#059669' },
  optionText: { fontSize: 13, color: '#475569' },
  optionTextActive: { color: '#fff', fontWeight: '600' },
  submitBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 12 },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 16 },
})
