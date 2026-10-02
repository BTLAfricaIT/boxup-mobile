import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Modal, StyleSheet, Alert, ActivityIndicator, RefreshControl,
} from 'react-native'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

export default function SalesScreen() {
  const { profile } = useAuth()
  const [sales, setSales] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [outlets, setOutlets] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [form, setForm] = useState({ product_id: '', outlet_id: '', quantity: '1', sale_type: 'activation', notes: '' })

  async function load() {
    let salesQuery = supabase.from('btl_sales').select('*, btl_products(name), btl_outlets(name), btl_projects(name)').order('created_at', { ascending: false }).limit(50)
    if (profile?.project_id) salesQuery = salesQuery.eq('project_id', profile.project_id)
    let productsQuery = supabase.from('btl_products').select('id, name').eq('is_active', true).order('name')
    if (profile?.project_id) productsQuery = productsQuery.or(`project_id.is.null,project_id.eq.${profile.project_id}`)
    let outletsQuery = supabase.from('btl_outlets').select('id, name').eq('is_active', true).order('name')
    if (profile?.project_id) outletsQuery = outletsQuery.or(`project_id.is.null,project_id.eq.${profile.project_id}`)
    const [s, p, o] = await Promise.all([
      salesQuery,
      productsQuery,
      outletsQuery,
    ])
    if (s.data) setSales(s.data)
    if (p.data) setProducts(p.data)
    if (o.data) setOutlets(o.data)
  }

  useEffect(() => { load() }, [profile?.project_id])

  async function save() {
    if (!profile?.project_id) { Alert.alert('No project assigned', 'Choose a project on your Profile tab before logging a sale.'); return }
    setSaving(true)
    const { error } = await supabase.from('btl_sales').insert({
      agent_id: profile!.id,
      product_id: form.product_id || null,
      outlet_id: form.outlet_id || null,
      project_id: profile.project_id,
      quantity: parseInt(form.quantity) || 1,
      sale_type: form.sale_type,
      notes: form.notes || null,
      sale_date: new Date().toISOString().slice(0, 10),
    })
    setSaving(false)
    if (error) { Alert.alert('Error', error.message); return }
    setShowForm(false)
    setForm({ product_id: '', outlet_id: '', quantity: '1', sale_type: 'activation', notes: '' })
    load()
  }

  async function onRefresh() { setRefreshing(true); await load(); setRefreshing(false) }

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Sales & Activations</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => profile?.project_id ? setShowForm(true) : Alert.alert('No project assigned', 'Choose a project on your Profile tab before logging a sale.')}>
          <Text style={styles.addBtnText}>+ Log Sale</Text>
        </TouchableOpacity>
      </View>
      {!profile?.project_id && <Text style={styles.noProjectBanner}>Choose your project on the Profile tab to start logging.</Text>}

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {sales.map((s, i) => (
          <View key={s.id} style={[styles.card, i === 0 && { marginTop: 12 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={styles.cardTitle}>{s.btl_products?.name || 'Unknown product'}</Text>
              <Text style={styles.qty}>{s.quantity}×</Text>
            </View>
            <Text style={styles.cardSub}>{s.btl_outlets?.name || 'No outlet'}{s.btl_projects?.name ? ` · ${s.btl_projects.name}` : ''} · {s.sale_date}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{s.sale_type}</Text>
            </View>
          </View>
        ))}
        {!sales.length && <Text style={styles.empty}>No sales yet. Tap + to log one.</Text>}
      </ScrollView>

      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Log Sale</Text>
            <TouchableOpacity onPress={() => setShowForm(false)}>
              <Text style={{ color: '#64748b', fontSize: 15 }}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }}>
            <Text style={styles.label}>Product</Text>
            <View style={styles.picker}>
              {products.map(p => (
                <TouchableOpacity key={p.id} onPress={() => setForm(f => ({ ...f, product_id: p.id }))}
                  style={[styles.option, form.product_id === p.id && styles.optionActive]}>
                  <Text style={[styles.optionText, form.product_id === p.id && styles.optionTextActive]}>{p.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Outlet</Text>
            <View style={styles.picker}>
              {outlets.map(o => (
                <TouchableOpacity key={o.id} onPress={() => setForm(f => ({ ...f, outlet_id: o.id }))}
                  style={[styles.option, form.outlet_id === o.id && styles.optionActive]}>
                  <Text style={[styles.optionText, form.outlet_id === o.id && styles.optionTextActive]}>{o.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Quantity</Text>
            <TextInput style={styles.input} keyboardType="number-pad" value={form.quantity}
              onChangeText={v => setForm(f => ({ ...f, quantity: v }))} />

            <Text style={styles.label}>Type</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              {['activation', 'volume'].map(t => (
                <TouchableOpacity key={t} onPress={() => setForm(f => ({ ...f, sale_type: t }))}
                  style={[styles.option, form.sale_type === t && styles.optionActive, { flex: 1 }]}>
                  <Text style={[styles.optionText, form.sale_type === t && styles.optionTextActive, { textAlign: 'center', textTransform: 'capitalize' }]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Notes</Text>
            <TextInput style={[styles.input, { height: 80 }]} multiline value={form.notes}
              onChangeText={v => setForm(f => ({ ...f, notes: v }))} placeholder="Optional…" />
          </ScrollView>

          <TouchableOpacity style={styles.submitBtn} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit Sale</Text>}
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  addBtn: { backgroundColor: '#4d7c0f', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  card: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 10, borderRadius: 14, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b', flex: 1 },
  qty: { fontSize: 18, fontWeight: '800', color: '#4d7c0f' },
  cardSub: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  badge: { marginTop: 8, alignSelf: 'flex-start', backgroundColor: '#dbeafe', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 11, color: '#4d7c0f', fontWeight: '600', textTransform: 'capitalize' },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 60, fontSize: 14 },
  noProjectBanner: { backgroundColor: '#fef3c7', color: '#92400e', fontSize: 12, textAlign: 'center', paddingVertical: 8 },
  modal: { flex: 1, backgroundColor: '#f8fafc', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
  label: { fontSize: 12, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#0f172a', marginBottom: 16, backgroundColor: '#fff' },
  picker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  option: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff' },
  optionActive: { backgroundColor: '#4d7c0f', borderColor: '#4d7c0f' },
  optionText: { fontSize: 13, color: '#475569' },
  optionTextActive: { color: '#fff', fontWeight: '600' },
  submitBtn: { backgroundColor: '#4d7c0f', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 12 },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 16 },
})
