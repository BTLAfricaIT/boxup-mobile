import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react'
import { AppState } from 'react-native'
import { useAuth } from './AuthContext'
import { QueueItem, Kind, getQueue, removeItem, flushQueue, submitEntry } from '../lib/offline'

interface OfflineValue {
  pending: QueueItem[]
  syncing: boolean
  tick: number // increments after a successful sync so screens can reload
  syncNow: () => Promise<void>
  discard: (id: string) => Promise<void>
  submit: (kind: Kind, row: Record<string, any>, orders: Record<string, any>[] | undefined, label: string) => Promise<{ status: 'sent' | 'queued' | 'error'; message?: string }>
}

const Ctx = createContext<OfflineValue | undefined>(undefined)

export function OfflineProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const userId = session?.user?.id
  const [pending, setPending] = useState<QueueItem[]>([])
  const [syncing, setSyncing] = useState(false)
  const [tick, setTick] = useState(0)
  const pendingRef = useRef<QueueItem[]>([])
  pendingRef.current = pending

  const refresh = useCallback(async () => setPending(await getQueue()), [])

  const syncNow = useCallback(async () => {
    if (!userId) return
    setSyncing(true)
    const { sent } = await flushQueue(userId)
    setSyncing(false)
    await refresh()
    if (sent > 0) setTick(t => t + 1)
  }, [userId, refresh])

  useEffect(() => { refresh().then(() => syncNow()) }, [userId])

  useEffect(() => {
    const id = setInterval(() => { if (pendingRef.current.length) syncNow() }, 20000)
    const sub = AppState.addEventListener('change', s => { if (s === 'active') syncNow() })
    return () => { clearInterval(id); sub.remove() }
  }, [syncNow])

  const submit: OfflineValue['submit'] = async (kind, row, orders, label) => {
    const r = await submitEntry(kind, userId || row.agent_id, row, orders, label)
    await refresh()
    return r
  }

  const discard = async (id: string) => { await removeItem(id); await refresh() }

  return <Ctx.Provider value={{ pending, syncing, tick, syncNow, discard, submit }}>{children}</Ctx.Provider>
}

export function useOffline() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useOffline must be used within OfflineProvider')
  return v
}
