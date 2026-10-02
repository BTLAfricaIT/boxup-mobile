import { useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

export default function TargetsScreen() {
  const { profile } = useAuth()
  const [targets, setTargets] = useState<any[]>([])
  const [progress, setProgress] = useState<Record<string, number>>({})
  const [refreshing, setRefreshing] = useState(false)

  async function load() {
    if (!profile?.id) return
    const { data: t } = await supabase
      .from('btl_targets')
      .select('*, btl_products(name)')
      .eq('user_id', profile.id)
      .order('period_end', { ascending: false })
    if (!t) return
    setTargets(t)

    // Calculate actual progress for each target
    const prog: Record<string, number> = {}
    for (const target of t) {
      if (target.target_type === 'sales') {
        const { data } = await supabase.from('btl_sales').select('quantity')
          .eq('agent_id', profile.id)
          .gte('sale_date', target.period_start).lte('sale_date', target.period_end)
        prog[target.id] = (data || []).reduce((sum: number, r: any) => sum + r.quantity, 0)
      } else if (target.target_type === 'visits') {
        const { count } = await supabase.from('btl_visits').select('*', { count: 'exact', head: true })
          .eq('agent_id', profile.id)
          .gte('visit_date', target.period_start).lte('visit_date', target.period_end)
        prog[target.id] = count || 0
      } else if (target.target_type === 'activations') {
        const { count } = await supabase.from('btl_activations').select('*', { count: 'exact', head: true })
          .eq('agent_id', profile.id)
          .gte('activation_date', target.period_start).lte('activation_date', target.period_end)
        prog[target.id] = count || 0
      }
    }
    setProgress(prog)
  }

  useEffect(() => { load() }, [profile?.id])

  async function onRefresh() { setRefreshing(true); await load(); setRefreshing(false) }

  const pct = (targetId: string, targetQty: number) => Math.min(100, Math.round(((progress[targetId] || 0) / targetQty) * 100))

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f8fafc' }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <Text style={styles.sectionTitle}>My Targets</Text>
      {targets.length === 0 && <Text style={styles.empty}>No targets assigned yet.</Text>}
      {targets.map(t => {
        const done = progress[t.id] || 0
        const p = pct(t.id, t.target_qty)
        const color = p >= 100 ? '#059669' : p >= 60 ? '#d97706' : '#ef4444'
        return (
          <View key={t.id} style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.type}>{t.target_type.toUpperCase()}</Text>
                <Text style={styles.product}>{t.btl_products?.name || 'Any product'}</Text>
                <Text style={styles.period}>{t.period_start} → {t.period_end}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.pct, { color }]}>{p}%</Text>
                <Text style={styles.progress}>{done} / {t.target_qty}</Text>
              </View>
            </View>
            <View style={styles.barBg}>
              <View style={[styles.barFill, { width: `${p}%` as any, backgroundColor: color }]} />
            </View>
            {t.notes && <Text style={styles.notes}>{t.notes}</Text>}
          </View>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b', margin: 20, marginBottom: 12 },
  card: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 12, borderRadius: 14, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  type: { fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 0.5 },
  product: { fontSize: 15, fontWeight: '700', color: '#1e293b', marginTop: 2 },
  period: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  pct: { fontSize: 22, fontWeight: '800' },
  progress: { fontSize: 12, color: '#94a3b8' },
  barBg: { height: 8, backgroundColor: '#f1f5f9', borderRadius: 4, marginTop: 10, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  notes: { fontSize: 12, color: '#94a3b8', marginTop: 8 },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 60, fontSize: 14 },
})
