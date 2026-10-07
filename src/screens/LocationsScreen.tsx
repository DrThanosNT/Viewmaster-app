import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/client';
import { useTheme } from '../context/ThemeContext';
import Screen from '../components/Screen';
import PressableCard from '../components/PressableCard';
import FitInput from '../components/FitInput';

type EventLite = { id: string; name: string };
type StockEntry = { quantity: number; damagedQuantity?: number; temporaryQuantity?: number };
type LocationT = { id: string; name: string; type: string; isSystem?: boolean; stock?: StockEntry[] };
type StockRow = { id: string; quantity: number; damagedQuantity: number; temporaryQuantity: number; runningLow: boolean; eventId: string | null; event?: EventLite | null; item: { id: string; name: string; kind: string } };
type CrossRow = { id: string; damagedQuantity?: number; temporaryQuantity?: number; item: { name: string }; location: { name: string }; event?: EventLite | null };
type CrossKind = 'damaged' | 'temporary';

const TYPE_LABELS: Record<string, string> = { STORAGE: 'Αποθήκη', VEHICLE: 'Όχημα', OTHER: 'Άλλο' };

function subtitleFor(lines: number, units: number) {
  return `${lines} ${lines === 1 ? 'είδος' : 'είδη'} · ${units} τεμ.`;
}

export default function LocationsScreen({ onBack, initialList }: { onBack?: () => void; initialList?: CrossKind }) {
  const { colors, spacing, radius, typography } = useTheme();
  const styles = makeStyles(colors, spacing, radius);

  const [locations, setLocations] = useState<LocationT[]>([]);
  const [damaged, setDamaged] = useState<CrossRow[]>([]);
  const [temporary, setTemporary] = useState<CrossRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [selected, setSelected] = useState<LocationT | null>(null);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const [crossKind, setCrossKind] = useState<CrossKind | null>(initialList ?? null);
  const [enteredDirect] = useState(!!initialList);
  const [crossQuery, setCrossQuery] = useState('');

  useFocusEffect(useCallback(() => {
    Promise.all([
      api.getLocations().catch(() => null),
      api.getDamagedStock().catch(() => null),
      api.getTemporaryStock().catch(() => null),
    ]).then(([locs, dmg, tmp]) => {
      if (locs) setLocations(locs);
      if (dmg) setDamaged(dmg);
      if (tmp) setTemporary(tmp);
      setLoaded(true);
    });
  }, []));

  const stockedLocations = locations.filter((loc) => !loc.isSystem && (loc.stock || []).some((s) => s.quantity > 0 || (s.damagedQuantity || 0) > 0 || (s.temporaryQuantity || 0) > 0));
  const damagedUnits = damaged.reduce((s, r) => s + (r.damagedQuantity || 0), 0);
  const temporaryUnits = temporary.reduce((s, r) => s + (r.temporaryQuantity || 0), 0);

  function openLocation(loc: LocationT) {
    setSelected(loc); setQuery(''); setLoading(true);
    api.getLocation(loc.id).then((detail) => setStock(detail.stock || [])).catch(() => {}).finally(() => setLoading(false));
  }

  function goBackToList() { setSelected(null); setStock([]); setQuery(''); }

  function openCross(kind: CrossKind) { setCrossKind(kind); setCrossQuery(''); }

  function closeCross() {
    if (enteredDirect) { onBack?.(); return; }
    setCrossKind(null);
    setCrossQuery('');
  }

  async function toggleRunningLow(row: StockRow) {
    if (!selected) return;
    const newValue = !row.runningLow;
    setStock((prev) => prev.map((s) => (s.id === row.id ? { ...s, runningLow: newValue } : s)));
    try {
      await api.setRunningLow(row.item.id, selected.id, row.eventId ?? null, newValue);
    } catch {
      setStock((prev) => prev.map((s) => (s.id === row.id ? { ...s, runningLow: !newValue } : s)));
    }
  }

  // ---------- Damaged / temporary list ----------
  if (crossKind) {
    const isDamaged = crossKind === 'damaged';
    const rows = isDamaged ? damaged : temporary;
    const accent = isDamaged ? colors.rust : colors.amber;
    const title = isDamaged ? 'Με ζημιά' : 'Προσωρινά';
    const q = crossQuery.trim().toLowerCase();
    const filteredRows = rows.filter((r) => q.length === 0 || r.item.name.toLowerCase().includes(q) || r.location.name.toLowerCase().includes(q));

    return (
      <Screen>
        <TouchableOpacity onPress={closeCross} style={styles.backRow}>
          <Text style={styles.backText}>{enteredDirect ? '‹ Επισκόπηση' : '‹ Όλα τα αντικείμενα'}</Text>
        </TouchableOpacity>
        <Text style={[typography.title, { marginBottom: spacing.lg }]}>{title}</Text>

        <FitInput placeholder="Αναζήτηση αντικειμένου ή τοποθεσίας..." value={crossQuery} onChangeText={setCrossQuery} autoCapitalize="none" />

        <ScrollView style={{ marginTop: spacing.md }} keyboardShouldPersistTaps="handled">
          {!loaded ? (
            <Text style={styles.emptyText}>Φόρτωση...</Text>
          ) : rows.length === 0 ? (
            <Text style={styles.emptyText}>{isDamaged ? 'Τίποτα με ζημιά προς το παρόν.' : 'Τίποτα προσωρινό προς το παρόν.'}</Text>
          ) : filteredRows.length === 0 ? (
            <Text style={styles.emptyText}>Δεν βρέθηκαν αποτελέσματα.</Text>
          ) : (
            filteredRows.map((r) => (
              <View key={r.id} style={[styles.crossItemRow, { borderLeftColor: accent }]}>
                <View style={styles.crossTextCol}>
                  <Text style={styles.itemName} numberOfLines={1}>{r.item.name}</Text>
                  <Text style={typography.caption} numberOfLines={1}>{r.location.name}{r.event ? ` (${r.event.name})` : ''}</Text>
                </View>
                <Text style={[styles.crossQty, { color: accent }]}>{isDamaged ? r.damagedQuantity : r.temporaryQuantity}</Text>
              </View>
            ))
          )}
        </ScrollView>
      </Screen>
    );
  }

  // ---------- Single location ----------
  if (selected) {
    const isEventCapable = selected.type !== 'STORAGE';
    const filtered = stock.filter((s) => s.quantity > 0 || s.damagedQuantity > 0 || s.temporaryQuantity > 0).filter((s) => s.item.name.toLowerCase().includes(query.toLowerCase()));
    const withEvent = isEventCapable ? filtered.filter((s) => s.eventId) : [];
    const withoutEvent = isEventCapable ? filtered.filter((s) => !s.eventId) : filtered;
    const groups = new Map<string, { name: string; rows: StockRow[] }>();
    withEvent.forEach((s) => {
      const key = s.eventId!;
      if (!groups.has(key)) groups.set(key, { name: s.event?.name || '', rows: [] });
      groups.get(key)!.rows.push(s);
    });

    return (
      <Screen>
        <TouchableOpacity onPress={goBackToList} style={styles.backRow}><Text style={styles.backText}>‹ Όλα τα αντικείμενα</Text></TouchableOpacity>
        <Text style={typography.title} numberOfLines={1}>{selected.name}</Text>
        <Text style={[typography.bodyMuted, { marginBottom: spacing.lg }]}>{TYPE_LABELS[selected.type] || selected.type}</Text>

        <FitInput placeholder="Αναζήτηση αντικειμένου..." value={query} onChangeText={setQuery} autoCapitalize="none" />

        <ScrollView style={{ marginTop: spacing.md }} keyboardShouldPersistTaps="handled">
          {loading ? (
            <Text style={styles.emptyText}>Φόρτωση...</Text>
          ) : filtered.length === 0 ? (
            <Text style={styles.emptyText}>Δεν βρέθηκαν αντικείμενα.</Text>
          ) : (
            <>
              {withoutEvent.map((s) => <ItemRow key={s.id} row={s} styles={styles} onToggleLow={toggleRunningLow} />)}
              {[...groups.entries()].map(([eventId, g]) => (
                <View key={eventId} style={{ marginTop: spacing.md }}>
                  <Text style={styles.eventHeader} numberOfLines={1}>{g.name}</Text>
                  {g.rows.map((s) => <ItemRow key={s.id} row={s} styles={styles} onToggleLow={toggleRunningLow} />)}
                </View>
              ))}
            </>
          )}
        </ScrollView>
      </Screen>
    );
  }

  // ---------- Root: special lists + locations ----------
  return (
    <Screen>
      {onBack && <TouchableOpacity onPress={onBack} style={styles.backRow}><Text style={styles.backText}>‹ Επισκόπηση</Text></TouchableOpacity>}
      <Text style={[typography.title, { marginBottom: spacing.lg }]}>Όλα τα αντικείμενα</Text>

      <ScrollView>
        <PressableCard style={[styles.specialRow, { borderLeftColor: colors.rust }]} onPress={() => openCross('damaged')} disabled={damaged.length === 0}>
          <View style={[styles.badge, { backgroundColor: colors.rustSoft, borderColor: colors.rust }]}>
            <Text style={[styles.badgeSymbol, { color: colors.rust }]}>!</Text>
          </View>
          <View style={styles.specialText}>
            <Text style={styles.specialTitle}>Με ζημιά</Text>
            <Text style={styles.specialSub} numberOfLines={1}>{!loaded ? ' ' : damaged.length === 0 ? 'Τίποτα προς το παρόν.' : subtitleFor(damaged.length, damagedUnits)}</Text>
          </View>
          {damaged.length > 0 && <Text style={styles.chevron}>›</Text>}
        </PressableCard>

        <PressableCard style={[styles.specialRow, { borderLeftColor: colors.amber }]} onPress={() => openCross('temporary')} disabled={temporary.length === 0}>
          <View style={[styles.badge, { backgroundColor: colors.amberSoft, borderColor: colors.amber }]}>
            <Text style={[styles.badgeSymbol, { color: colors.amber }]}>↔</Text>
          </View>
          <View style={styles.specialText}>
            <Text style={styles.specialTitle}>Προσωρινά</Text>
            <Text style={styles.specialSub} numberOfLines={1}>{!loaded ? ' ' : temporary.length === 0 ? 'Τίποτα προς το παρόν.' : subtitleFor(temporary.length, temporaryUnits)}</Text>
          </View>
          {temporary.length > 0 && <Text style={styles.chevron}>›</Text>}
        </PressableCard>

        <Text style={styles.sectionLabel}>Τοποθεσίες</Text>
        {stockedLocations.length === 0 ? (
          <Text style={styles.emptyText}>Καμία τοποθεσία με απόθεμα ακόμα.</Text>
        ) : (
          stockedLocations.map((loc) => (
            <PressableCard key={loc.id} style={styles.locationRow} onPress={() => openLocation(loc)}>
              <View style={{ flex: 1, minWidth: 0, marginRight: spacing.sm }}>
                <Text style={styles.locationName} numberOfLines={1}>{loc.name}</Text>
                <Text style={typography.caption}>{TYPE_LABELS[loc.type] || loc.type}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </PressableCard>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

function ItemRow({ row, styles, onToggleLow }: { row: StockRow; styles: any; onToggleLow: (r: StockRow) => void }) {
  return (
    <View style={[styles.itemRow, row.damagedQuantity > 0 ? styles.itemRowDamaged : row.temporaryQuantity > 0 ? styles.itemRowTemporary : null]}>
      <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
        <Text style={styles.itemName} numberOfLines={1}>{row.item.name}</Text>
        {row.item.kind === 'CONSUMABLE' && (
          <TouchableOpacity onPress={() => onToggleLow(row)} style={[styles.lowChip, row.runningLow && styles.lowChipActive]}>
            <Text style={[styles.lowChipText, row.runningLow && styles.lowChipTextActive]}>Τελειώνει</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.qtyGroup}>
        {row.quantity > 0 && <Text style={styles.itemQty}>{row.quantity}</Text>}
        {row.temporaryQuantity > 0 && <Text style={styles.temporaryQty}>{row.temporaryQuantity} προσωρινό</Text>}
        {row.damagedQuantity > 0 && <Text style={styles.damagedQty}>{row.damagedQuantity} με ζημιά</Text>}
      </View>
    </View>
  );
}

function makeStyles(colors: any, spacing: any, radius: any) {
  return StyleSheet.create({
    backRow: { marginBottom: spacing.md },
    backText: { fontSize: 14, color: colors.petrol, fontWeight: '600' },
    emptyText: { textAlign: 'center', color: colors.muted, marginTop: spacing.xxl },
    sectionLabel: { fontSize: 13, fontWeight: '600', color: colors.ink2, marginTop: spacing.lg, marginBottom: spacing.sm },

    specialRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, borderLeftWidth: 3, padding: spacing.lg, marginBottom: spacing.sm },
    specialText: { flex: 1, minWidth: 0, marginRight: spacing.sm },
    specialTitle: { fontSize: 16, fontWeight: '600', color: colors.ink },
    specialSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
    badge: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md, flexShrink: 0 },
    badgeSymbol: { fontSize: 13, fontWeight: '800' },

    locationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: spacing.lg, marginBottom: spacing.sm },
    locationName: { fontSize: 16, fontWeight: '600', color: colors.ink },
    chevron: { fontSize: 22, color: colors.muted, flexShrink: 0 },

    crossItemRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, borderLeftWidth: 3, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
    crossTextCol: { flex: 1, minWidth: 0, marginRight: spacing.sm },
    crossQty: { fontFamily: 'monospace', fontSize: 16, fontWeight: '700', flexShrink: 0 },

    eventHeader: { fontSize: 13, fontWeight: '700', color: colors.petrol, marginBottom: spacing.sm },
    itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
    itemRowDamaged: { borderLeftWidth: 3, borderLeftColor: colors.rust },
    itemRowTemporary: { borderLeftWidth: 3, borderLeftColor: colors.amber },
    itemName: { fontSize: 15, color: colors.ink },
    qtyGroup: { alignItems: 'flex-end', flexShrink: 0 },
    itemQty: { fontFamily: 'monospace', fontSize: 15, color: colors.ink, fontWeight: '700' },
    temporaryQty: { fontSize: 12, fontWeight: '600', color: colors.amber, marginTop: 2 },
    damagedQty: { fontSize: 12, fontWeight: '600', color: colors.rust, marginTop: 2 },
    lowChip: { alignSelf: 'flex-start', marginTop: 6, paddingVertical: 3, paddingHorizontal: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.lineStrong },
    lowChipActive: { backgroundColor: colors.amberSoft, borderColor: colors.amber },
    lowChipText: { fontSize: 11, color: colors.muted, fontWeight: '600' },
    lowChipTextActive: { color: colors.amber },
  });
}