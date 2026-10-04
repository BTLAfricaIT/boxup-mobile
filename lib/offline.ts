import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from './supabase'

export type Kind = 'sale' | 'visit' | 'event'
export interface QueueItem {
  id: string
  kind: Kind
  agent_id: string
  label: string
  createdAt: number
  row: Record<string, any>
  orders?: Record<string, any>[]
  lastError?: string
}

const QKEY = 'offline:queue'
const TABLES: Record<Kind, string> = { sale: 'btl_sales', visit: 'btl_visits', event: 'btl_activations' }

export function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

function withTimeout<T>(p: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms)
    Promise.resolve(p).then(v => { clearTimeout(t); resolve(v) }, e => { clearTimeout(t); reject(e) })
  })
}

export function isNetworkError(e: any) {
  if (!e) return false
  if (e.code) return false // real database/RLS error
  const msg = String(e.message || e).toLowerCase()
  return e.name === 'TypeError' || /network|fetch|timeout|offline|connection|failed to/.test(msg)
}

export async function getQueue(): Promise<QueueItem[]> {
  try { return JSON.parse((await AsyncStorage.getItem(QKEY)) || '[]') } catch { return [] }
}
async function saveQueue(q: QueueItem[]) { await AsyncStorage.setItem(QKEY, JSON.stringify(q)) }
export async function enqueue(item: QueueItem) { const q = await getQueue(); q.push(item); await saveQueue(q) }
export async function removeItem(id: string) { await saveQueue((await getQueue()).filter(i => i.id !== id)) }
async function updateItem(id: string, patch: Partial<QueueItem>) {
  await saveQueue((await getQueue()).map(i => (i.id === id ? { ...i, ...patch } : i)))
}

// Returns null on success, or an error. Client-generated ids make retries safe (duplicate key = already saved).
async function sendItem(item: QueueItem, timeoutMs: number): Promise<any> {
  try {
    let { error } = await withTimeout(supabase.from(TABLES[item.kind]).insert(item.row), timeoutMs)
    if (error && error.code !== '23505') return error
    if (item.orders?.length) {
      ;({ error } = await withTimeout(supabase.from('btl_sales').insert(item.orders), timeoutMs))
      if (error && error.code !== '23505') return error
    }
    return null
  } catch (e: any) {
    return e instanceof Error ? e : new Error(String(e))
  }
}

export async function submitEntry(kind: Kind, agent_id: string, row: Record<string, any>, orders: Record<string, any>[] | undefined, label: string) {
  const item: QueueItem = { id: uuid(), kind, agent_id, label, createdAt: Date.now(), row: { id: uuid(), ...row }, orders }
  const err = await sendItem(item, 10000)
  if (!err) return { status: 'sent' as const }
  if (isNetworkError(err)) { await enqueue(item); return { status: 'queued' as const } }
  return { status: 'error' as const, message: err.message as string }
}

let flushing = false
export async function flushQueue(userId?: string) {
  if (flushing) return { sent: 0 }
  flushing = true
  let sent = 0
  try {
    for (const item of await getQueue()) {
      if (userId && item.agent_id !== userId) continue
      const err = await sendItem(item, 20000)
      if (!err) { await removeItem(item.id); sent++ }
      else if (isNetworkError(err)) break
      else await updateItem(item.id, { lastError: err.message })
    }
  } finally { flushing = false }
  return { sent }
}

// Network-first read that falls back to the last successful result stored on the device.
export async function cachedQuery<T = any>(key: string, q: PromiseLike<{ data: T | null; error: any }>): Promise<{ data: T | null; fromCache: boolean }> {
  try {
    const { data, error } = await withTimeout(q, 10000)
    if (!error && data) {
      AsyncStorage.setItem('cache:' + key, JSON.stringify(data)).catch(() => {})
      return { data, fromCache: false }
    }
  } catch { /* offline */ }
  try {
    const raw = await AsyncStorage.getItem('cache:' + key)
    if (raw) return { data: JSON.parse(raw), fromCache: true }
  } catch { /* ignore */ }
  return { data: null, fromCache: true }
}
