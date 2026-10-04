import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useOffline } from '../contexts/OfflineContext'

export default function SyncBanner() {
  const { pending, syncing, syncNow, discard } = useOffline()
  if (!pending.length) return null
  const failed = pending.filter(p => p.lastError)
  return (
    <View style={s.wrap}>
      <View style={{ flex: 1 }}>
        <Text style={s.text}>
          {pending.length} {pending.length === 1 ? 'entry' : 'entries'} waiting to sync{failed.length ? ` · ${failed.length} rejected` : ''}
        </Text>
        {failed[0]?.lastError && <Text style={s.err} numberOfLines={2}>{failed[0].lastError}</Text>}
      </View>
      {failed.length > 0 && (
        <TouchableOpacity onPress={() => failed.forEach(f => discard(f.id))}><Text style={s.link}>Discard</Text></TouchableOpacity>
      )}
      <TouchableOpacity onPress={syncNow} disabled={syncing} style={{ marginLeft: 14 }}>
        {syncing ? <ActivityIndicator size="small" color="#92400e" /> : <Text style={s.link}>Sync now</Text>}
      </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef3c7', paddingHorizontal: 16, paddingVertical: 10 },
  text: { color: '#92400e', fontSize: 12, fontWeight: '700' },
  err: { color: '#b45309', fontSize: 11, marginTop: 2 },
  link: { color: '#92400e', fontSize: 12, fontWeight: '800', textDecorationLine: 'underline' },
})
