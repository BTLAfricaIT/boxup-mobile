import { useCallback, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import ProjectOverview from '../../components/ProjectOverview'

interface StatCard { label: string; value: number; color: string }

const typeLabels: Record<string, string> = { sales: 'Sales Activation', visit: 'Outlet Visit', event: 'Event' }
const typeToTargetType: Record<string, string> = { sales: 'sales', visit: 'visits', event: 'activations' }

export default function DashboardScreen() {
  const { profile } = useAuth()
  const [stats, setStats] = useState({ sales: 0, visits: 0, events: 0, participants: 0 })
  const [recentSales, setRecentSales] = useState<any[]>([])
  const [recentVisits, setRecentVisits] = useState<any[]>([])
  const [recentEvents, setRecentEvents] = useState<any[]>([])
  const [target, setTarget] = useState<any>(null)
  const [achieved, setAchieved] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const thisMonth = new Date().toISOString().slice(0, 7)
  const today = new Date().toISOString().slice(0, 10)
  const projectType = profile?.project?.type
  const isOverview = (profile?.role === 'admin' || profile?.role === 'manager') && !!profile?.project
  const [reloadKey, setReloadKey] = useState(0)

  async function load() {
    if (isOverview) { setReloadKey(k => k + 1); return }
    const [s, v, a] = await Promise.all([
      supabase.from('btl_sales').select('quantity, sale_date').gte('sale_date', thisMonth + '-01'),
      supabase.from('btl_visits').select('id, visit_date').gte('visit_date', thisMonth + '-01'),
      supabase.from('btl_activations').select('participants, activation_date').gte('activation_date', thisMonth + '-01'),
    ])
    if (s.error || v.error || a.error) return // offline: keep the numbers already on screen
    const salesQty = (s.data || []).reduce((sum: number, r: any) => sum + r.quantity, 0)
    const participants = (a.data || []).reduce((sum: number, r: any) => sum + (r.participants || 0), 0)
    setStats({ sales: salesQty, visits: (v.data || []).length, events: (a.data || []).length, participants })

    if (!projectType || projectType === 'sales') {
      const { data } = await supabase.from('btl_sales').select('id, quantity, sale_date, btl_products(name), btl_outlets(name)').order('created_at', { ascending: false }).limit(5)
      setRecentSales(data || [])
    }
    if (projectType === 'visit') {
      const { data } = await supabase.from('btl_visits').select('id, visit_date, purpose, btl_outlets(name)').order('created_at', { ascending: false }).limit(5)
      setRecentVisits(data || [])
    }
    if (projectType === 'event') {
      const { data } = await supabase.from('btl_activations').select('id, event_name, activation_date, participants').order('created_at', { ascending: false }).limit(5)
      setRecentEvents(data || [])
    }

    if (profile?.role === 'agent' && profile.project_id) {
      const targetType = typeToTargetType[projectType || 'sales']
      const { data: t } = await supabase.from('btl_targets').select('*').eq('user_id', profile.id).eq('project_id', profile.project_id).eq('target_type', targetType).lte('period_start', today).gte('period_end', today).order('period_end', { ascending: false }).limit(1).maybeSingle()
      if (t) {
        setTarget(t)
        let ach = 0
        if (targetType === 'sales') {
          const { data } = await supabase.from('btl_sales').select('quantity').eq('project_id', profile.project_id).gte('sale_date', t.period_start).lte('sale_date', t.period_end)
          ach = (data || []).reduce((sum: number, r: any) => sum + r.quantity, 0)
        } else if (targetType === 'visits') {
          const { count } = await supabase.from('btl_visits').select('id', { count: 'exact', head: true }).eq('project_id', profile.project_id).gte('visit_date', t.period_start).lte('visit_date', t.period_end)
          ach = count || 0
        } else {
          const { count } = await supabase.from('btl_activations').select('id', { count: 'exact', head: true }).eq('project_id', profile.project_id).gte('activation_date', t.period_start).lte('activation_date', t.period_end)
          ach = count || 0
        }
        setAchieved(ach)
      } else {
        setTarget(null)
        setAchieved(0)
      }
    } else {
      setTarget(null)
      setAchieved(0)
    }
  }

  useFocusEffect(useCallback(() => { load() }, [profile?.id, profile?.project_id, profile?.role]))

  async function onRefresh() { setRefreshing(true); await load(); setRefreshing(false) }

  const cards: StatCard[] = []
  if (!projectType || projectType === 'sales') cards.push({ label: 'Sales this month', value: stats.sales, color: '#4d7c0f' })
  if (!projectType || projectType === 'visit') cards.push({ label: 'Visits this month', value: stats.visits, color: '#059669' })
  if (!projectType || projectType === 'event') {
    cards.push({ label: 'Promo events', value: stats.events, color: '#7c3aed' })
    cards.push({ label: 'Participants', value: stats.participants, color: '#d97706' })
  }

  const pct = target && target.target_qty > 0 ? Math.min(100, Math.round((achieved / target.target_qty) * 100)) : 0

  if (isOverview && profile?.project) {
    return (
      <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <ProjectOverview project={profile.project as any} reloadKey={reloadKey} />
        <View style={{ height: 24 }} />
      </ScrollView>
    )
  }

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={styles.greeting}>
        <Text style={styles.hello}>Hi, {profile?.full_name?.split(' ')[0] || 'Agent'} 👋</Text>
        <Text style={styles.month}>{new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}</Text>
        {profile?.project && (
          <Text style={styles.projectLine}>{profile.project.name} · {typeLabels[projectType || ''] || projectType}</Text>
        )}
      </View>

      {target && (
        <View style={styles.targetCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.targetTitle}>Project Target Progress</Text>
            <Text style={styles.targetPct}>{pct}%</Text>
          </View>
          <Text style={styles.targetNums}>{achieved} / {target.target_qty}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: pct >= 100 ? '#059669' : '#f97316' }]} />
          </View>
          <Text style={styles.targetSub}>{target.period_start} → {target.period_end}</Text>
        </View>
      )}

      <View style={styles.grid}>
        {cards.map(c => (
          <View key={c.label} style={[styles.card, { borderLeftColor: c.color }]}>
            <Text style={[styles.cardValue, { color: c.color }]}>{c.value}</Text>
            <Text style={styles.cardLabel}>{c.label}</Text>
          </View>
        ))}
      </View>

      {(!projectType || projectType === 'sales') && (
        <>
          <Text style={styles.sectionTitle}>Recent Sales</Text>
          <View style={styles.listCard}>
            {recentSales.length === 0 ? (
              <Text style={styles.empty}>No sales logged yet this month.</Text>
            ) : (
              recentSales.map((s, i) => (
                <View key={s.id} style={[styles.row, i < recentSales.length - 1 && styles.rowBorder]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{s.btl_products?.name || 'Unknown product'}</Text>
                    <Text style={styles.rowSub}>{s.btl_outlets?.name || 'No outlet'} · {s.sale_date}</Text>
                  </View>
                  <Text style={styles.qty}>{s.quantity}×</Text>
                </View>
              ))
            )}
          </View>
        </>
      )}

      {projectType === 'visit' && (
        <>
          <Text style={styles.sectionTitle}>Recent Visits</Text>
          <View style={styles.listCard}>
            {recentVisits.length === 0 ? (
              <Text style={styles.empty}>No visits logged yet.</Text>
            ) : (
              recentVisits.map((v, i) => (
                <View key={v.id} style={[styles.row, i < recentVisits.length - 1 && styles.rowBorder]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{v.btl_outlets?.name || 'Unknown outlet'}</Text>
                    <Text style={styles.rowSub}>{v.purpose || 'No purpose noted'} · {v.visit_date}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </>
      )}

      {projectType === 'event' && (
        <>
          <Text style={styles.sectionTitle}>Recent Events</Text>
          <View style={styles.listCard}>
            {recentEvents.length === 0 ? (
              <Text style={styles.empty}>No events logged yet.</Text>
            ) : (
              recentEvents.map((e, i) => (
                <View key={e.id} style={[styles.row, i < recentEvents.length - 1 && styles.rowBorder]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{e.event_name}</Text>
                    <Text style={styles.rowSub}>{e.activation_date}</Text>
                  </View>
                  <Text style={styles.qty}>{e.participants}</Text>
                </View>
              ))
            )}
          </View>
        </>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  greeting: { padding: 20, paddingBottom: 12 },
  hello: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  month: { fontSize: 13, color: '#64748b', marginTop: 2 },
  projectLine: { fontSize: 12, color: '#4d7c0f', marginTop: 6, fontWeight: '600' },
  targetCard: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 12, borderRadius: 14, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  targetTitle: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
  targetPct: { fontSize: 13, fontWeight: '800', color: '#f97316' },
  targetNums: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginTop: 6 },
  progressTrack: { height: 8, backgroundColor: '#f1f5f9', borderRadius: 4, marginTop: 8, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  targetSub: { fontSize: 11, color: '#94a3b8', marginTop: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 8, marginBottom: 8 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    width: '47%', borderLeftWidth: 4,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  cardValue: { fontSize: 28, fontWeight: '800' },
  cardLabel: { fontSize: 12, color: '#64748b', marginTop: 2 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b', marginHorizontal: 20, marginTop: 16, marginBottom: 8 },
  listCard: { backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 14, marginBottom: 20, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  rowTitle: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  rowSub: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  qty: { fontSize: 16, fontWeight: '800', color: '#4d7c0f' },
  empty: { padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 14 },
})
