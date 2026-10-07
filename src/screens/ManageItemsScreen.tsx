import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/client';
import { useTheme } from '../context/ThemeContext';
import Screen from '../components/Screen';
import FitInput from '../components/FitInput';

type ItemRow = {
  id: string;
  name: string;
  stock?: { quantity: number; damagedQuantity?: number; temporaryQuantity?: number; location?: { isSystem?: boolean } }[];
};

// Stock sitting in system locations (consumed items) doesn't count.
function totalInStock(it: ItemRow) {
  return (it.stock || [])
    .filter((s) => !s.location?.isSystem)
    .reduce((sum, s) => sum + s.quantity + (s.damagedQuantity || 0) + (s.temporaryQuantity || 0), 0);
}

export default function ManageItemsScreen({ onBack }: { onBack: () => void }) {
  const { colors, spacing, radius, typography } = useTheme();
  const styles = makeStyles(colors, spacing, radius);

  const [items, setItems] = useState<ItemRow[]>([]);
  const [query, setQuery] = useState('');
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(useCallback(() => {
    api.searchItems('').then(setItems).catch(() => {}).finally(() => setLoaded(true));
  }, []));

  function confirmDelete(it: ItemRow) {
    Alert.alert('Διαγραφή αντικειμένου', `Να διαγραφεί το "${it.name}"; Οι καταγραφές θα συνεχίσουν να το εμφανίζουν.`, [
      { text: 'Ακύρωση', style: 'cancel' },
      {
        text: 'Διαγραφή',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteItem(it.id);
            setItems((prev) => prev.filter((x) => x.id !== it.id));
          } catch (err: any) {
            Alert.alert('Αποτυχία', err.message);
          }
        },
      },
    ]);
  }

  const q = query.trim().toLowerCase();
  const shown = items.filter((it) => q.length === 0 || it.name.toLowerCase().includes(q));

  return (
    <Screen>
      <TouchableOpacity onPress={onBack} style={styles.backRow}><Text style={styles.backText}>‹ Διαχείριση</Text></TouchableOpacity>
      <Text style={[typography.title, { marginBottom: spacing.lg }]}>Αντικείμενα</Text>

      <FitInput placeholder="Αναζήτηση αντικειμένου..." value={query} onChangeText={setQuery} autoCapitalize="none" />

      <ScrollView style={{ marginTop: spacing.md }} keyboardShouldPersistTaps="handled">
        {!loaded ? (
          <Text style={styles.emptyText}>Φόρτωση...</Text>
        ) : shown.length === 0 ? (
          <Text style={styles.emptyText}>Δεν βρέθηκαν αντικείμενα.</Text>
        ) : (
          shown.map((it) => {
            const total = totalInStock(it);
            return (
              <View key={it.id} style={styles.row}>
                <View style={styles.textCol}>
                  <Text style={styles.name} numberOfLines={1}>{it.name}</Text>
                  <Text style={typography.caption} numberOfLines={1}>{total > 0 ? `${total} τεμ. σε απόθεμα` : 'Χωρίς απόθεμα'}</Text>
                </View>
                {total === 0 && (
                  <TouchableOpacity onPress={() => confirmDelete(it)}><Text style={styles.deleteText}>Διαγραφή</Text></TouchableOpacity>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

function makeStyles(colors: any, spacing: any, radius: any) {
  return StyleSheet.create({
    backRow: { marginBottom: spacing.md },
    backText: { fontSize: 14, color: colors.petrol, fontWeight: '600' },
    emptyText: { textAlign: 'center', color: colors.muted, marginTop: spacing.xxl },
    row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: spacing.lg, marginBottom: spacing.sm },
    textCol: { flex: 1, minWidth: 0, marginRight: spacing.sm },
    name: { fontSize: 15, fontWeight: '600', color: colors.ink },
    deleteText: { color: colors.rust, fontWeight: '700', fontSize: 13, flexShrink: 0 },
  });
}
