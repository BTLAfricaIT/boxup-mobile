import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, StyleSheet, Alert, ActivityIndicator, RefreshControl } from 'react-native'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

export default function EventsScreen() {
  const { profile } = useAuth()
  const [events, setEvents] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [form, setForm] = useState({ event_name: '', location: '', region: '', product_id: '', participants: '0', units_distributed: '0', notes: '' })

  async function load() {
    let eventsQuery = supabase.from('btl_activations').select('*, btl_products(name), btl_projects(name)').order('created_at', { ascending: false }).limit(50)
    if (profile?.project_id) eventsQuery = eventsQuery.eq('project_id', profile.project_id)
    let productsQuery = supabase.from('btl_products').select('id, name').eq('is_active', true).order('name')
    if (profile?.project_id) productsQuery = productsQuery.or(`project_id.is.null,project_id.eq.${profile.project_id}`)
    const [a, p] = await Promise.all([
      eventsQuery,
      productsQuery,
    ])
    if (a.data) setEvents(a.data)
    if (p.data) setProducts(p.data)
  }

  useEffect(() => { load() }, [profile?.project_id])

  async function save() {
    if (!form.event_name.trim()) { Alert.alert('Error', 'Event name is required'); return }
    if (!profile?.project_id) { Alert.alert('No project assigned', 'Choose a project on your Profile tab before logging an event.'); return }
    setSaving(true)
    const { error } = await supabase.from('btl_activations').insert({
      agent_id: profile!.id,
      event_name: form.event_name.trim(),
      location: form.location || null,
      region: form.region || null,
      product_id: form.product_id || null,
      project_id: profile.project_id,
      participants: parseInt(form.participants) || 0,
      units_distributed: parseInt(form.units_distributed) || 0,
      notes: form.notes || null,
      activation_date: new Date().toISOString().slice(0, 10),
    })
    setSaving(false)
    if (error) { Alert.alert('Error', error.message); return }
    setShowForm(false); setForm({ event_name: '', location: '', region: '', product_id: '', participants: '0', units_distributed: '0', notes: '' }); load()
  }

  async function onRefresh() { setRefreshing(true); await load(); setRefreshing(false) }

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Promo Events</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => profile?.project_id ? setShowForm(true) : Alert.alert('No project assigned', 'Choose a project on your Profile tab before logging an event.')}>
          <Text style={styles.addBtnText}>+ Log Event</Text>
        </TouchableOpacity>
      </View>
      {!profile?.project_id && <Text style={styles.noProjectBanner}>Choose your project on the Profile tab to start logging.</Text>}

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {events.map((e, i) => (
          <View key={e.id} style={[styles.card, i === 0 && { marginTop: 12 }]}>
            <Text style={styles.cardTitle}>{e.event_name}</Text>
            <Text style={styles.cardSub}>{[e.location, e.region].filter(Boolean).join(', ') || 'No location'} · {e.activation_date}{e.btl_projects?.name ? ` · ${e.btl_projects.name}` : ''}</Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              <Text style={styles.stat}><Text style={styles.statVal}>{e.participants}</Text> participants</Text>
              <Text style={styles.stat}><Text style={styles.statVal}>{e.units_distributed}</Text> units out</Text>
            </View>
          </View>
        ))}
        {!events.length && <Text style={styles.empty}>No events yet. Tap + to log one.</Text>}
      </ScrollView>

      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Log Promo Event</Text>
            <TouchableOpacity onPress={() => setShowForm(false)}><Text style={{ color: '#64748b', fontSize: 15 }}>Cancel</Text></TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }}>
            <Text style={styles.label}>Event Name *</Text>
            <TextInput style={styles.input} value={form.event_name} onChangeText={v => setForm(f => ({ ...f, event_name: v }))} placeholder="e.g. Market Day Activation" />
            <Text style={styles.label}>Location</Text>
            <TextInput style={styles.input} value={form.location} onChangeText={v => setForm(f => ({ ...f, location: v }))} />
            <Text style={styles.label}>Region</Text>
            <TextInput style={styles.input} value={form.region} onChangeText={v => setForm(f => ({ ...f, region: v }))} />
            <Text style={styles.label}>Product</Text>
            <View style={styles.picker}>
              {products.map(p => (
                <TouchableOpacity key={p.id} onPress={() => setForm(f => ({ ...f, product_id: p.id }))}
                  style={[styles.option, form.product_id === p.id && styles.optionActive]}>
                  <Text style={[styles.optionText, form.product_id === p.id && styles.optionTextActive]}>{p.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Participants</Text>
                <TextInput style={styles.input} keyboardType="number-pad" value={form.participants} onChangeText={v => setForm(f => ({ ...f, participants: v }))} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Units Out</Text>
                <TextInput style={styles.input} keyboardType="number-pad" value={form.units_distributed} onChangeText={v => setForm(f => ({ ...f, units_distributed: v }))} />
              </View>
            </View>
            <Text style={styles.label}>Notes</Text>
            <TextInput style={[styles.input, { height: 80 }]} multiline value={form.notes} onChangeText={v => setForm(f => ({ ...f, notes: v }))} placeholder="Optional…" />
          </ScrollView>
          <TouchableOpacity style={styles.submitBtn} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit Event</Text>}
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  addBtn: { backgroundColor: '#7c3aed', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  card: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 10, borderRadius: 14, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  cardSub: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  stat: { fontSize: 13, color: '#64748b' },
  statVal: { fontWeight: '700', color: '#7c3aed' },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 60, fontSize: 14 },
  noProjectBanner: { backgroundColor: '#fef3c7', color: '#92400e', fontSize: 12, textAlign: 'center', paddingVertical: 8 },
  modal: { flex: 1, backgroundColor: '#f8fafc', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
  label: { fontSize: 12, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#0f172a', marginBottom: 16, backgroundColor: '#fff' },
  picker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  option: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff' },
  optionActive: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  optionText: { fontSize: 13, color: '#475569' },
  optionTextActive: { color: '#fff', fontWeight: '600' },
  submitBtn: { backgroundColor: '#7c3aed', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 12 },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 16 },
})
