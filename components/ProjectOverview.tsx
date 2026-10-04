import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { supabase } from '../lib/supabase'

type Row = { agent_id: string | null; date: string; value: number; label: string; extra?: number; extra2?: number }
const typeLabels: Record<string, string> = { sales: 'Sales Activation', visit: 'Outlet Visit', event: 'Event' }
const targetTypeFor: Record<string, string> = { sales: 'sales', visit: 'visits', event: 'activations' }
const COLORS: Record<string, string> = { sales: '#4d7c0f', visit: '#059669', event: '#7c3aed' }

function group(rows: Row[], key: (r: Row) => string, val: (r: Row) => number) {
  const m = new Map<string, number>()
  rows.forEach(r => { const k = key(r); m.set(k, (m.get(k) || 0) + val(r)) })
  return [...m.entries()].map(([k, v]) => ({ key: k, value: v })).sort((a, b) => b.value - a.value)
}

export default function ProjectOverview({ project, reloadKey }: { project: { id: string; name: string; type: string | null; capture_orders?: boolean }; reloadKey: number }) {
  const type = project.type || 'sales'
  const color = COLORS[type] || '#4d7c0f'
  const [rows, setRows] = useState<Row[]>([])
  const [orders, setOrders] = useState(0)
  const [targets, setTargets] = useState<any[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [period, setPeriod] = useState<'month' | 'all'>('month')
  const [loading, setLoading] = useState(true)

  const today = new Date().toISOString().slice(0, 10)
  const monthStart = today.slice(0, 7) + '-01'

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      let data: Row[] = []
      let failed = false
      if (type === 'sales') {
        const { data: d, error: e } = await supabase.from('btl_sales').select('agent_id, quantity, sale_date, btl_products(name)').eq('project_id', project.id).order('sale_date', { ascending: false }).limit(5000)
        failed = !!e
        data = (d || []).map((r: any) => ({ agent_id: r.agent_id, date: r.sale_date, value: r.quantity || 0, label: r.btl_products?.name || 'Unknown product' }))
      } else if (type === 'visit') {
        const { data: d, error: e } = await supabase.from('btl_visits').select('agent_id, visit_date, outlet_name, btl_outlets(name)').eq('project_id', project.id).order('visit_date', { ascending: false }).limit(5000)
        failed = !!e
        data = (d || []).map((r: any) => ({ agent_id: r.agent_id, date: r.visit_date, value: 1, label: r.btl_outlets?.name || r.outlet_name || 'Unknown outlet' }))
      } else {
        const { data: d, error: e } = await supabase.from('btl_activations').select('agent_id, event_name, participants, units_distributed, activation_date').eq('project_id', project.id).order('activation_date', { ascending: false }).limit(5000)
        failed = !!e
        data = (d || []).map((r: any) => ({ agent_id: r.agent_id, date: r.activation_date, value: 1, label: r.event_name || 'Event', extra: r.participants || 0, extra2: r.units_distributed || 0 }))
      }
      if (failed) { if (!cancelled) setLoading(false); return } // offline: keep what is already shown
      let orderQty = 0
      if (type === 'visit' && project.capture_orders) {
        const { data: o } = await supabase.from('btl_sales').select('quantity').eq('project_id', project.id).eq('sale_type', 'order')
        orderQty = (o || []).reduce((s: number, r: any) => s + (r.quantity || 0), 0)
      }
      const { data: t } = await supabase.from('btl_targets').select('user_id, target_type, target_qty, period_start, period_end').eq('project_id', project.id).eq('target_type', targetTypeFor[type]).lte('period_start', today).gte('period_end', today)
      const ids = [...new Set([...data.map(r => r.agent_id), ...(t || []).map((x: any) => x.user_id)].filter(Boolean))] as string[]
      const nm: Record<string, string> = {}
      if (ids.length) {
        const { data: p } = await supabase.from('profiles').select('id, full_name, email').in('id', ids)
        ;(p || []).forEach((x: any) => { nm[x.id] = x.full_name || x.email || 'Agent' })
      }
      if (cancelled) return
      setRows(data); setOrders(orderQty); setTargets(t || []); setNames(nm); setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [project.id, reloadKey])

  const inPeriod = period === 'month' ? rows.filter(r => r.date >= monthStart) : rows
  const total = inPeriod.reduce((s, r) => s + r.value, 0)
  const agents = new Set(inPeriod.map(r => r.agent_id).filter(Boolean)).size
  const participants = inPeriod.reduce((s, r) => s + (r.extra || 0), 0)
  const unitsOut = inPeriod.reduce((s, r) => s + (r.extra2 || 0), 0)
  const distinctLabels = new Set(inPeriod.map(r => r.label)).size

  const kpis: { label: string; value: number }[] = []
  if (type === 'sales') kpis.push({ label: 'Units sold', value: total }, { label: 'Entries logged', value: inPeriod.length }, { label: 'Products moving', value: distinctLabels }, { label: 'Active agents', value: agents })
  if (type === 'visit') {
    kpis.push({ label: 'Visits', value: total }, { label: 'Outlets reached', value: distinctLabels }, { label: 'Active agents', value: agents })
    if (project.capture_orders) kpis.push({ label: 'Order units (all time)', value: orders })
  }
  if (type === 'event') kpis.push({ label: 'Events', value: total }, { label: 'Participants', value: participants }, { label: 'Units out', value: unitsOut }, { label: 'Active agents', value: agents })

  const byAgent = group(inPeriod, r => r.agent_id || 'unknown', r => r.value).slice(0, 8)
  const byLabel = group(inPeriod, r => r.label, r => r.value).slice(0, 6)
  const maxAgent = Math.max(1, ...byAgent.map(a => a.value))
  const maxLabel = Math.max(1, ...byLabel.map(a => a.value))
  const labelTitle = type === 'sales' ? 'Top products' : type === 'visit' ? 'Most visited outlets' : 'Events by name'
  const unit = type === 'sales' ? 'units' : type === 'visit' ? 'visits' : 'events'

  const days: { d: string; v: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)
    days.push({ d, v: rows.filter(r => r.date === d).reduce((s, r) => s + r.value, 0) })
  }
  const maxDay = Math.max(1, ...days.map(d => d.v))

  // Target progress per agent (current target period)
  const targetRows = targets.map(t => {
    const ach = rows.filter(r => r.agent_id === t.user_id && r.date >= t.period_start && r.date <= t.period_end).reduce((s, r) => s + r.value, 0)
    return { ...t, ach }
  })
  const tTotal = targetRows.reduce((s, t) => s + (t.target_qty || 0), 0)
  const tAch = targetRows.reduce((s, t) => s + t.ach, 0)
  const tPct = tTotal > 0 ? Math.min(100, Math.round((tAch / tTotal) * 100)) : 0

  return (
    <View>
      <View style={st.head}>
        <Text style={st.title}>{project.name}</Text>
        <Text style={[st.sub, { color }]}>{typeLabels[type] || type} · Project performance</Text>
        <View style={st.toggle}>
          {(['month', 'all'] as const).map(p => (
            <TouchableOpacity key={p} onPress={() => setPeriod(p)} style={[st.toggleBtn, period === p && { backgroundColor: color }]}>
              <Text style={[st.toggleText, period === p && { color: '#fff' }]}>{p === 'month' ? 'This month' : 'All time'}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? <ActivityIndicator color={color} style={{ marginTop: 30 }} /> : (
        <>
          <View style={st.grid}>
            {kpis.map(k => (
              <View key={k.label} style={[st.kpi, { borderLeftColor: color }]}>
                <Text style={[st.kpiVal, { color }]}>{k.value}</Text>
                <Text style={st.kpiLabel}>{k.label}</Text>
              </View>
            ))}
          </View>

          {targetRows.length > 0 && (
            <View style={st.box}>
              <View style={st.rowBetween}>
                <Text style={st.boxTitle}>Target progress</Text>
                <Text style={[st.boxTitle, { color: '#f97316' }]}>{tPct}%</Text>
              </View>
              <Text style={st.big}>{tAch} / {tTotal}</Text>
              <View style={st.track}><View style={[st.fill, { width: `${tPct}%`, backgroundColor: tPct >= 100 ? '#059669' : '#f97316' }]} /></View>
              {targetRows.map((t, i) => {
                const p = t.target_qty > 0 ? Math.min(100, Math.round((t.ach / t.target_qty) * 100)) : 0
                return (
                  <View key={i} style={{ marginTop: 10 }}>
                    <View style={st.rowBetween}>
                      <Text style={st.rowName}>{names[t.user_id] || 'Agent'}</Text>
                      <Text style={st.rowVal}>{t.ach} / {t.target_qty} · {p}%</Text>
                    </View>
                    <View style={st.trackSm}><View style={[st.fill, { width: `${p}%`, backgroundColor: p >= 100 ? '#059669' : '#f97316' }]} /></View>
                  </View>
                )
              })}
            </View>
          )}

          <View style={st.box}>
            <Text style={st.boxTitle}>Last 7 days</Text>
            <View style={st.bars}>
              {days.map(d => (
                <View key={d.d} style={st.barCol}>
                  <Text style={st.barVal}>{d.v}</Text>
                  <View style={[st.bar, { height: Math.max(3, Math.round((d.v / maxDay) * 70)), backgroundColor: color }]} />
                  <Text style={st.barDay}>{d.d.slice(8)}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={st.box}>
            <Text style={st.boxTitle}>Agent leaderboard</Text>
            {byAgent.length === 0 ? <Text style={st.empty}>No activity yet.</Text> : byAgent.map((a, i) => (
              <View key={a.key} style={{ marginTop: 10 }}>
                <View style={st.rowBetween}>
                  <Text style={st.rowName}>{i + 1}. {names[a.key] || 'Unknown agent'}</Text>
                  <Text style={st.rowVal}>{a.value} {unit}</Text>
                </View>
                <View style={st.trackSm}><View style={[st.fill, { width: `${(a.value / maxAgent) * 100}%`, backgroundColor: color }]} /></View>
              </View>
            ))}
          </View>

          <View style={st.box}>
            <Text style={st.boxTitle}>{labelTitle}</Text>
            {byLabel.length === 0 ? <Text style={st.empty}>No activity yet.</Text> : byLabel.map(a => (
              <View key={a.key} style={{ marginTop: 10 }}>
                <View style={st.rowBetween}>
                  <Text style={[st.rowName, { flex: 1 }]} numberOfLines={1}>{a.key}</Text>
                  <Text style={st.rowVal}>{a.value} {unit}</Text>
                </View>
                <View style={st.trackSm}><View style={[st.fill, { width: `${(a.value / maxLabel) * 100}%`, backgroundColor: color }]} /></View>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  )
}

const st = StyleSheet.create({
  head: { padding: 20, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  sub: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  toggle: { flexDirection: 'row', marginTop: 12, backgroundColor: '#e2e8f0', borderRadius: 10, padding: 3, alignSelf: 'flex-start' },
  toggleBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  toggleText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 8, marginBottom: 8 },
  kpi: { backgroundColor: '#fff', borderRadius: 14, padding: 16, width: '47%', borderLeftWidth: 4, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  kpiVal: { fontSize: 26, fontWeight: '800' },
  kpiLabel: { fontSize: 12, color: '#64748b', marginTop: 2 },
  box: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 12, borderRadius: 14, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  boxTitle: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
  big: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginTop: 6 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  rowName: { fontSize: 13, fontWeight: '600', color: '#1e293b' },
  rowVal: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  track: { height: 8, backgroundColor: '#f1f5f9', borderRadius: 4, marginTop: 8, overflow: 'hidden' },
  trackSm: { height: 6, backgroundColor: '#f1f5f9', borderRadius: 3, marginTop: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 12, height: 110 },
  barCol: { alignItems: 'center', flex: 1, justifyContent: 'flex-end' },
  bar: { width: 18, borderRadius: 4 },
  barVal: { fontSize: 10, color: '#64748b', marginBottom: 2 },
  barDay: { fontSize: 10, color: '#94a3b8', marginTop: 4 },
  empty: { color: '#94a3b8', fontSize: 13, marginTop: 10 },
})
