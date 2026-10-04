import { useState } from 'react'
import { View, Text, TouchableOpacity, TextInput, Modal, FlatList, StyleSheet } from 'react-native'

type Option = { id: string; name: string }

export default function Dropdown({ options, value, onChange, placeholder = 'Select…' }: {
  options: Option[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const selected = options.find(o => o.id === value)
  const filtered = query.trim() ? options.filter(o => o.name.toLowerCase().includes(query.trim().toLowerCase())) : options

  function close() { setOpen(false); setQuery('') }

  return (
    <View style={{ marginBottom: 16 }}>
      <TouchableOpacity style={styles.field} onPress={() => setOpen(true)} activeOpacity={0.7}>
        <Text style={[styles.fieldText, !selected && { color: '#94a3b8' }]} numberOfLines={1}>{selected ? selected.name : placeholder}</Text>
        <Text style={styles.chevron}>▾</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={close}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet}>
            {options.length > 8 && (
              <TextInput style={styles.search} placeholder="Search…" value={query} onChangeText={setQuery} autoCorrect={false} />
            )}
            <FlatList
              data={filtered}
              keyExtractor={o => o.id}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={styles.empty}>No matches</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity style={[styles.row, item.id === value && styles.rowActive]} onPress={() => { onChange(item.id); close() }}>
                  <Text style={[styles.rowText, item.id === value && styles.rowTextActive]}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.cancel} onPress={close}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#fff' },
  fieldText: { fontSize: 15, color: '#0f172a', flex: 1, marginRight: 8 },
  chevron: { fontSize: 14, color: '#64748b' },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'center', padding: 24 },
  sheet: { backgroundColor: '#fff', borderRadius: 16, maxHeight: '75%', paddingVertical: 8 },
  search: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, marginHorizontal: 12, marginVertical: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  row: { paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  rowActive: { backgroundColor: '#ecfccb' },
  rowText: { fontSize: 15, color: '#1e293b' },
  rowTextActive: { fontWeight: '700', color: '#365314' },
  empty: { textAlign: 'center', color: '#94a3b8', padding: 20 },
  cancel: { paddingVertical: 14, alignItems: 'center' },
  cancelText: { color: '#64748b', fontSize: 15, fontWeight: '600' },
})
