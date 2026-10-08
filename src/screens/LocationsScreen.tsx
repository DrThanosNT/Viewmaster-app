import React, { useCallback, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Modal, Pressable, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/client';
import { useTheme } from '../context/ThemeContext';
import Screen from '../components/Screen';
import PressableCard from '../components/PressableCard';
import FitInput from '../components/FitInput';
import AppIcon, { ion } from '../components/AppIcon';
import LocationIcon, { EVENT_ICON } from '../components/LocationIcon';
import { dueInfo, formatDue, formatDayTime, compareDue } from '../utils/dateTime';
import useTick from '../utils/useTick';

type EventLite = { id: string; name: string };
type StockEntry = { quantity: number; damagedQuantity?: number; temporaryQuantity?: number; eventId?: string | null; event?: EventLite | null };
type LocationT = { id: string; name: string; type: string; isSystem?: boolean; stock?: StockEntry[] };
// A location as part of one event: it lists only that event's items.
type EventPlace = { key: string; location: LocationT; event: EventLite };
type StockRow = { id: string; quantity: number; damagedQuantity: number; temporaryQuantity: number; expectedReturnAt?: string | null; runningLow: boolean; eventId: string | null; event?: EventLite | null; item: { id: string; name: string; kind: string } };
type HistoryKind = 'temporary' | 'return' | 'damage' | 'repair';
type HistoryEntry = { kind: HistoryKind; quantity: number; note: string | null; createdAt: string; moverName: string | null };
type CrossRow = {
  id: string; damagedQuantity?: number; temporaryQuantity?: number; expectedReturnAt?: string | null;
  item: { name: string }; location: { name: string };
  event?: (EventLite & { endDate?: string }) | null;
  history?: HistoryEntry[];
};
type CrossKind = 'damaged' | 'temporary';

const TYPE_LABELS: Record<string, string> = { STORAGE: 'Αποθήκη', VEHICLE: 'Όχημα', OTHER: 'Άλλο' };

function subtitleFor(lines: number, units: number) {
  return `${lines} ${lines === 1 ? 'είδος' : 'είδη'} · ${units} τεμ.`;
}

export default function LocationsScreen({ onBack, initialList }: { onBack?: () => void; initialList?: CrossKind }) {
  const { colors, spacing, radius, typography } = useTheme();
  const styles = makeStyles(colors, spacing, radius);
  // Re-renders while the screen is open so an item turns red the moment it is late.
  useTick();

  const [locations, setLocations] = useState<LocationT[]>([]);
  const [damaged, setDamaged] = useState<CrossRow[]>([]);
  const [temporary, setTemporary] = useState<CrossRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [selected, setSelected] = useState<LocationT | null>(null);
  // When set, the location is opened "for this event": only its items show.
  const [selectedEvent, setSelectedEvent] = useState<EventLite | null>(null);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [holdId, setHoldId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const [crossKind, setCrossKind] = useState<CrossKind | null>(initialList ?? null);
  const [enteredDirect] = useState(!!initialList);
  const [crossQuery, setCrossQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
  const lateCount = temporary.filter((r) => r.expectedReturnAt && dueInfo(r.expectedReturnAt).overdue).length;

  // One entry per (event, location) that currently holds something for that
  // event. An event can have several locations, each listed on its own.
  const eventPlaces: EventPlace[] = [];
  locations.filter((loc) => !loc.isSystem).forEach((loc) => {
    const events = new Map<string, EventLite>();
    (loc.stock || []).forEach((s) => {
      if (!s.eventId || !s.event) return;
      if (s.quantity > 0 || (s.damagedQuantity || 0) > 0 || (s.temporaryQuantity || 0) > 0) events.set(s.eventId, s.event);
    });
    events.forEach((event) => eventPlaces.push({ key: `${event.id}:${loc.id}`, location: loc, event }));
  });
  eventPlaces.sort((a, b) => a.event.name.localeCompare(b.event.name) || a.location.name.localeCompare(b.location.name));

  function openLocation(loc: LocationT, event: EventLite | null = null) {
    setSelected(loc); setSelectedEvent(event); setQuery(''); setHoldId(null); setLoading(true);
    api.getLocation(loc.id).then((detail) => setStock(detail.stock || [])).catch(() => {}).finally(() => setLoading(false));
  }

  function goBackToList() { setSelected(null); setSelectedEvent(null); setStock([]); setQuery(''); setHoldId(null); }

  function openCross(kind: CrossKind) { setCrossKind(kind); setCrossQuery(''); setExpandedId(null); }

  function closeCross() {
    if (enteredDirect) { onBack?.(); return; }
    setCrossKind(null);
    setCrossQuery('');
    setExpandedId(null);
  }

  async function toggleRunningLow(row: StockRow) {
    if (!selected) return;
    const newValue = !row.runningLow;
    setStock((prev) => prev.map((s) => (s.id === row.id ? { ...s, runningLow: newValue } : s)));
    try {
      await api.setRunningLow(row.item.id, selected.id, row.eventId ?? null, newValue);
    } catch (err: any) {
      // Put the mark back the way it was and say what went wrong.
      setStock((prev) => prev.map((s) => (s.id === row.id ? { ...s, runningLow: !newValue } : s)));
      Alert.alert('Αποτυχία', err?.message || 'Η αλλαγή δεν αποθηκεύτηκε. Δοκίμασε ξανά.');
    }
  }

  // ---------- Damaged / temporary list ----------
  if (crossKind) {
    const isDamaged = crossKind === 'damaged';
    // Borrowed stock: the late ones first, then by how soon it is due, undated last.
    const rows = isDamaged ? damaged : [...temporary].sort((a, b) => compareDue(a.expectedReturnAt, b.expectedReturnAt));
    const title = isDamaged ? 'Με ζημιά' : 'Προσωρινά';
    const q = crossQuery.trim().toLowerCase();
    const filteredRows = rows.filter((r) => q.length === 0 || r.item.name.toLowerCase().includes(q) || r.location.name.toLowerCase().includes(q));

    return (
      <Screen>
        <TouchableOpacity onPress={closeCross} style={styles.backRow}>
          <Text style={styles.backText}>{enteredDirect ? '‹ Επισκόπηση' : '‹ Όλα τα αντικείμενα'}</Text>
        </TouchableOpacity>
        <Text style={[typography.title, { marginBottom: spacing.xs }]}>{title}</Text>
        <Text style={[typography.caption, { marginBottom: spacing.lg }]}>
          {isDamaged ? 'Πάτα ένα αντικείμενο για να δεις τις σημειώσεις.' : 'Πάτα ένα αντικείμενο για να δεις πότε πρέπει να φύγει και τις σημειώσεις.'}
        </Text>

        {!isDamaged && lateCount > 0 ? (
          <View style={styles.lateBanner}>
            <AppIcon icon={ion('alert-circle')} size={18} color={colors.rust} />
            <Text style={styles.lateBannerText}>
              {lateCount === 1 ? '1 είδος ξεπέρασε την προθεσμία επιστροφής' : `${lateCount} είδη ξεπέρασαν την προθεσμία επιστροφής`}
            </Text>
          </View>
        ) : null}

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
              <CrossCard
                key={r.id}
                row={r}
                isDamaged={isDamaged}
                open={expandedId === r.id}
                onToggle={() => setExpandedId((cur) => (cur === r.id ? null : r.id))}
                styles={styles}
                colors={colors}
                spacing={spacing}
                typography={typography}
              />
            ))
          )}
        </ScrollView>
      </Screen>
    );
  }

  // ---------- Single location (or one event's part of it) ----------
  if (selected) {
    const isEventCapable = selected.type !== 'STORAGE';
    const filtered = stock
      .filter((s) => s.quantity > 0 || s.damagedQuantity > 0 || s.temporaryQuantity > 0)
      .filter((s) => s.item.name.toLowerCase().includes(query.toLowerCase()))
      // Opened for an event: only what was sent here for that event.
      .filter((s) => !selectedEvent || s.eventId === selectedEvent.id);
    // The plain location shows everything there, grouped by event; an event's
    // own view is a flat list of just its items.
    const withEvent = isEventCapable && !selectedEvent ? filtered.filter((s) => s.eventId) : [];
    const withoutEvent = isEventCapable && !selectedEvent ? filtered.filter((s) => !s.eventId) : filtered;
    const groups = new Map<string, { name: string; rows: StockRow[] }>();
    withEvent.forEach((s) => {
      const key = s.eventId!;
      if (!groups.has(key)) groups.set(key, { name: s.event?.name || '', rows: [] });
      groups.get(key)!.rows.push(s);
    });
    // Looked up by id so the popup always shows the current state of the row.
    const holdRow = holdId ? stock.find((s) => s.id === holdId) ?? null : null;

    return (
      <Screen>
        <TouchableOpacity onPress={goBackToList} style={styles.backRow}><Text style={styles.backText}>‹ Όλα τα αντικείμενα</Text></TouchableOpacity>
        <View style={styles.detailHeader}>
          <LocationIcon type={selectedEvent ? 'OTHER' : selected.type} size={48} />
          <View style={{ flex: 1, minWidth: 0, marginLeft: spacing.md }}>
            <Text style={typography.title} numberOfLines={1}>{selectedEvent ? selectedEvent.name : selected.name}</Text>
            <Text style={typography.bodyMuted} numberOfLines={1}>{selectedEvent ? selected.name : (TYPE_LABELS[selected.type] || selected.type)}</Text>
          </View>
        </View>

        <FitInput placeholder="Αναζήτηση αντικειμένου..." value={query} onChangeText={setQuery} autoCapitalize="none" />
        <Text style={[typography.caption, { marginTop: spacing.sm }]}>Κράτα πατημένο ένα αντικείμενο για να το σημειώσεις ως «Τελειώνει».</Text>

        <ScrollView style={{ marginTop: spacing.md }} keyboardShouldPersistTaps="handled">
          {loading ? (
            <Text style={styles.emptyText}>Φόρτωση...</Text>
          ) : filtered.length === 0 ? (
            <Text style={styles.emptyText}>Δεν βρέθηκαν αντικείμενα.</Text>
          ) : (
            <>
              {withoutEvent.map((s) => <ItemRow key={s.id} row={s} styles={styles} onHold={(r) => setHoldId(r.id)} />)}
              {[...groups.entries()].map(([eventId, g]) => (
                <View key={eventId} style={{ marginTop: spacing.md }}>
                  <View style={styles.eventHeaderRow}>
                    <AppIcon icon={EVENT_ICON} size={17} color={colors.plum} />
                    <Text style={styles.eventHeader} numberOfLines={1}>{g.name}</Text>
                  </View>
                  {g.rows.map((s) => <ItemRow key={s.id} row={s} styles={styles} onHold={(r) => setHoldId(r.id)} />)}
                </View>
              ))}
            </>
          )}
        </ScrollView>

        <RunningLowSheet
          row={holdRow}
          styles={styles}
          onClose={() => setHoldId(null)}
          onConfirm={(r) => { setHoldId(null); toggleRunningLow(r); }}
        />
      </Screen>
    );
  }

  // ---------- Root: special lists + locations + event locations ----------
  return (
    <Screen>
      {onBack && <TouchableOpacity onPress={onBack} style={styles.backRow}><Text style={styles.backText}>‹ Επισκόπηση</Text></TouchableOpacity>}
      <Text style={[typography.title, { marginBottom: spacing.lg }]}>Όλα τα αντικείμενα</Text>

      <ScrollView>
        <PressableCard style={[styles.specialRow, { borderLeftColor: colors.rust }]} onPress={() => openCross('damaged')} disabled={damaged.length === 0}>
          <View style={[styles.badge, { backgroundColor: colors.rustSoft, borderColor: colors.rust }]}>
            <AppIcon icon={ion('warning')} size={19} color={colors.rust} />
          </View>
          <View style={styles.specialText}>
            <Text style={styles.specialTitle}>Με ζημιά</Text>
            <Text style={styles.specialSub} numberOfLines={1}>{!loaded ? ' ' : damaged.length === 0 ? 'Τίποτα προς το παρόν.' : subtitleFor(damaged.length, damagedUnits)}</Text>
          </View>
          {damaged.length > 0 && <Text style={styles.chevron}>›</Text>}
        </PressableCard>

        <PressableCard style={[styles.specialRow, { borderLeftColor: lateCount > 0 ? colors.rust : colors.amber }]} onPress={() => openCross('temporary')} disabled={temporary.length === 0}>
          <View style={[styles.badge, lateCount > 0 ? { backgroundColor: colors.rustSoft, borderColor: colors.rust } : { backgroundColor: colors.amberSoft, borderColor: colors.amber }]}>
            <AppIcon icon={ion(lateCount > 0 ? 'alert-circle' : 'swap-horizontal')} size={20} color={lateCount > 0 ? colors.rust : colors.amber} />
          </View>
          <View style={styles.specialText}>
            <Text style={styles.specialTitle}>Προσωρινά</Text>
            <Text style={styles.specialSub} numberOfLines={1}>{!loaded ? ' ' : temporary.length === 0 ? 'Τίποτα προς το παρόν.' : subtitleFor(temporary.length, temporaryUnits)}</Text>
            {lateCount > 0 ? <Text style={styles.specialLate} numberOfLines={1}>{lateCount === 1 ? '1 εκπρόθεσμο' : `${lateCount} εκπρόθεσμα`}</Text> : null}
          </View>
          {temporary.length > 0 && <Text style={styles.chevron}>›</Text>}
        </PressableCard>

        <Text style={styles.sectionLabel}>Τοποθεσίες</Text>
        {stockedLocations.length === 0 ? (
          <Text style={styles.emptyText}>Καμία τοποθεσία με απόθεμα ακόμα.</Text>
        ) : (
          stockedLocations.map((loc) => (
            <PressableCard key={loc.id} style={styles.locationRow} onPress={() => openLocation(loc)}>
              <LocationIcon type={loc.type} size={42} />
              <View style={{ flex: 1, minWidth: 0, marginHorizontal: spacing.md }}>
                <Text style={styles.locationName} numberOfLines={1}>{loc.name}</Text>
                <Text style={typography.caption}>{TYPE_LABELS[loc.type] || loc.type}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </PressableCard>
          ))
        )}

        {eventPlaces.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Εκδηλώσεις</Text>
            {eventPlaces.map((p) => (
              <PressableCard key={p.key} style={styles.locationRow} onPress={() => openLocation(p.location, p.event)}>
                {/* "OTHER" draws the event icon. */}
                <LocationIcon type="OTHER" size={42} />
                <View style={{ flex: 1, minWidth: 0, marginHorizontal: spacing.md }}>
                  <Text style={styles.locationName} numberOfLines={1}>{p.event.name}</Text>
                  <Text style={typography.caption} numberOfLines={1}>{p.location.name}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </PressableCard>
            ))}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const HISTORY_KINDS = (colors: any): Record<HistoryKind, { label: string; color: string; soft: string }> => ({
  temporary: { label: 'Παραλαβή δανεικού', color: colors.amber, soft: colors.amberSoft },
  return: { label: 'Επιστροφή', color: colors.moss, soft: colors.mossSoft },
  damage: { label: 'Ζημιά', color: colors.rust, soft: colors.rustSoft },
  repair: { label: 'Επισκευή', color: colors.moss, soft: colors.mossSoft },
});

// One damaged / temporary row. Tapping it opens the details: for borrowed
// stock when it is due back, and for both kinds the notes left in the logs.
function CrossCard({ row, isDamaged, open, onToggle, styles, colors, spacing, typography }: {
  row: CrossRow; isDamaged: boolean; open: boolean; onToggle: () => void;
  styles: any; colors: any; spacing: any; typography: any;
}) {
  const qty = isDamaged ? row.damagedQuantity : row.temporaryQuantity;
  const due = !isDamaged && row.expectedReturnAt ? dueInfo(row.expectedReturnAt) : null;
  const late = !!due && due.overdue;
  // Late borrowed stock is flagged in red; it is never removed or moved.
  const accent = isDamaged || late ? colors.rust : colors.amber;
  const dueColor = late ? colors.rust : colors.amber;
  const kinds = HISTORY_KINDS(colors);
  const history = row.history || [];

  return (
    <View style={[styles.crossCard, { borderLeftColor: accent }]}>
      <PressableCard style={[styles.crossHead, late && { backgroundColor: colors.rustSoft }]} onPress={onToggle}>
        <View style={styles.crossTextCol}>
          <Text style={[styles.itemName, late && { color: colors.rust, fontWeight: '700' }]} numberOfLines={1}>{row.item.name}</Text>
          <Text style={typography.caption} numberOfLines={1}>{row.location.name}{row.event ? ` (${row.event.name})` : ''}</Text>
          {due && row.expectedReturnAt ? (
            <View style={[styles.duePill, { backgroundColor: late ? colors.rust : colors.amberSoft }]}>
              <AppIcon icon={ion(late ? 'alert-circle' : 'time-outline')} size={12} color={late ? '#fff' : dueColor} />
              <Text style={[styles.duePillText, { color: late ? '#fff' : dueColor }]} numberOfLines={1}>
                {late ? due.phrase : `έως ${formatDue(row.expectedReturnAt)}`}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.crossQty, { color: accent }]}>{qty}</Text>
        <View style={{ marginLeft: spacing.sm }}>
          <AppIcon icon={ion(open ? 'chevron-up' : 'chevron-down')} size={18} color={colors.muted} />
        </View>
      </PressableCard>

      {open ? (
        <View style={styles.crossDetail}>
          {!isDamaged ? (
            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>Πρέπει να φύγουν / να επιστραφούν</Text>
              {due && row.expectedReturnAt ? (
                <View style={styles.dueLine}>
                  <Text style={[styles.dueValue, late && { color: colors.rust }]}>{formatDue(row.expectedReturnAt)}</Text>
                  <View style={[styles.duePill, { backgroundColor: late ? colors.rust : colors.amberSoft, marginTop: 0, marginLeft: spacing.sm }]}>
                    <Text style={[styles.duePillText, { color: late ? '#fff' : dueColor, marginLeft: 0 }]}>{due.phrase}</Text>
                  </View>
                </View>
              ) : (
                <>
                  <Text style={styles.detailMuted}>Δεν έχει οριστεί ημερομηνία επιστροφής.</Text>
                  {row.event?.endDate ? (
                    <Text style={[styles.detailMuted, { marginTop: 2 }]}>Η εκδήλωση «{row.event.name}» τελειώνει: {formatDue(row.event.endDate)}</Text>
                  ) : null}
                </>
              )}
            </View>
          ) : null}

          <View style={styles.detailBlock}>
            <Text style={styles.detailLabel}>Σημειώσεις</Text>
            {history.length === 0 ? (
              <Text style={styles.detailMuted}>Δεν υπάρχουν καταγραφές.</Text>
            ) : (
              history.map((h, i) => {
                const meta = kinds[h.kind];
                return (
                  <View key={`${h.createdAt}-${i}`} style={[styles.historyRow, i > 0 && styles.historyRowBorder]}>
                    <View style={styles.historyTop}>
                      <View style={[styles.kindPill, { backgroundColor: meta.soft }]}>
                        <Text style={[styles.kindPillText, { color: meta.color }]}>{meta.label}</Text>
                      </View>
                      <Text style={styles.historyMeta} numberOfLines={1}>{h.quantity}× · {h.moverName || 'Άγνωστος'} · {formatDayTime(h.createdAt)}</Text>
                    </View>
                    {h.note ? <Text style={styles.historyNote}>«{h.note}»</Text> : <Text style={styles.historyNoNote}>Χωρίς σημείωση</Text>}
                  </View>
                );
              })
            )}
          </View>
        </View>
      ) : null}
    </View>
  );
}

// Holding a row opens the "Τελειώνει" popup. A row that is already marked
// shows a small amber tag so the state is visible without opening anything.
function ItemRow({ row, styles, onHold }: { row: StockRow; styles: any; onHold: (r: StockRow) => void }) {
  const { colors } = useTheme();
  const late = row.temporaryQuantity > 0 && !!row.expectedReturnAt && dueInfo(row.expectedReturnAt).overdue;
  return (
    <Pressable
      onLongPress={() => onHold(row)}
      delayLongPress={350}
      style={[styles.itemRow, row.damagedQuantity > 0 ? styles.itemRowDamaged : row.temporaryQuantity > 0 ? styles.itemRowTemporary : null, late && styles.itemRowLate]}
    >
      {({ pressed }) => (
        <>
          <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
            <Text style={styles.itemName} numberOfLines={1}>{row.item.name}</Text>
            {row.runningLow ? (
              <View style={styles.lowBadge}>
                <AppIcon icon={ion('hourglass-outline')} size={12} color={colors.amber} />
                <Text style={styles.lowBadgeText}>Τελειώνει</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.qtyGroup}>
            {row.quantity > 0 && <Text style={styles.itemQty}>{row.quantity}</Text>}
            {row.temporaryQuantity > 0 && <Text style={[styles.temporaryQty, late && styles.lateQty]}>{row.temporaryQuantity} προσωρινό{late ? ' · εκπρόθεσμο' : ''}</Text>}
            {row.damagedQuantity > 0 && <Text style={styles.damagedQty}>{row.damagedQuantity} με ζημιά</Text>}
          </View>
          {pressed ? <View pointerEvents="none" style={styles.pressOverlay} /> : null}
        </>
      )}
    </Pressable>
  );
}

// The popup shown after holding an item: one button that marks it as
// "Τελειώνει", or removes the mark if it is already set.
function RunningLowSheet({ row, styles, onClose, onConfirm }: {
  row: StockRow | null; styles: any; onClose: () => void; onConfirm: (r: StockRow) => void;
}) {
  const { colors } = useTheme();
  // Keep the last row so the text doesn't blank out while the popup fades away.
  const last = useRef<StockRow | null>(row);
  if (row) last.current = row;
  const shown = row ?? last.current;
  const low = !!shown?.runningLow;

  return (
    <Modal visible={!!row} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.sheetCard} onPress={() => {}}>
          <View style={styles.sheetHeader}>
            <View style={styles.sheetTile}>
              <AppIcon icon={ion('hourglass-outline')} size={22} color={colors.amber} />
            </View>
            <Text style={styles.sheetTitle} numberOfLines={2}>{shown?.item.name}</Text>
          </View>
          <Text style={styles.sheetStatus}>
            {low ? 'Αυτή τη στιγμή είναι σημειωμένο ως «Τελειώνει».' : 'Αυτή τη στιγμή το απόθεμα θεωρείται κανονικό.'}
          </Text>

          <TouchableOpacity style={styles.sheetPrimary} onPress={() => shown && onConfirm(shown)}>
            <AppIcon icon={ion(low ? 'checkmark-circle-outline' : 'hourglass-outline')} size={18} color={colors.paper} />
            <Text style={styles.sheetPrimaryText} numberOfLines={1}>{low ? 'Αφαίρεση σήμανσης «Τελειώνει»' : 'Σήμανση ως «Τελειώνει»'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sheetCancel} onPress={onClose}>
            <Text style={styles.sheetCancelText}>Ακύρωση</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
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
    specialLate: { fontSize: 12, fontWeight: '700', color: colors.rust, marginTop: 2 },
    lateBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.rustSoft, borderRadius: radius.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.md },
    lateBannerText: { fontSize: 13, fontWeight: '700', color: colors.rust, marginLeft: spacing.sm, flex: 1, minWidth: 0 },
    badge: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md, flexShrink: 0 },

    locationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: spacing.lg, marginBottom: spacing.sm },
    locationName: { fontSize: 16, fontWeight: '600', color: colors.ink },
    chevron: { fontSize: 22, color: colors.muted, flexShrink: 0 },

    detailHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },

    crossCard: { backgroundColor: colors.card, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, borderLeftWidth: 3, marginBottom: spacing.sm, overflow: 'hidden' },
    crossHead: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
    crossDetail: { borderTopWidth: 1, borderTopColor: colors.paper, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
    detailBlock: { marginTop: spacing.md },
    detailLabel: { fontSize: 11, fontWeight: '700', color: colors.muted, marginBottom: 6 },
    detailMuted: { fontSize: 13, color: colors.muted, fontStyle: 'italic' },
    dueLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
    dueValue: { fontSize: 15, fontWeight: '700', color: colors.ink },
    duePill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingVertical: 3, paddingHorizontal: 8, borderRadius: radius.pill, marginTop: 6 },
    duePillText: { fontSize: 11, fontWeight: '700', marginLeft: 4, flexShrink: 1 },
    historyRow: { paddingVertical: spacing.sm },
    historyRowBorder: { borderTopWidth: 1, borderTopColor: colors.paper },
    historyTop: { flexDirection: 'row', alignItems: 'center' },
    kindPill: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: radius.pill, marginRight: spacing.sm, flexShrink: 0 },
    kindPillText: { fontSize: 11, fontWeight: '700' },
    historyMeta: { fontSize: 12, color: colors.ink2, flex: 1, minWidth: 0 },
    historyNote: { fontSize: 14, color: colors.ink, marginTop: 4 },
    historyNoNote: { fontSize: 13, color: colors.muted, fontStyle: 'italic', marginTop: 4 },
    crossTextCol: { flex: 1, minWidth: 0, marginRight: spacing.sm },
    crossQty: { fontFamily: 'monospace', fontSize: 16, fontWeight: '700', flexShrink: 0 },

    eventHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
    eventHeader: { fontSize: 13, fontWeight: '700', color: colors.plum, marginLeft: 6, flex: 1, minWidth: 0 },
    itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
    itemRowDamaged: { borderLeftWidth: 3, borderLeftColor: colors.rust },
    itemRowTemporary: { borderLeftWidth: 3, borderLeftColor: colors.amber },
    itemRowLate: { borderLeftColor: colors.rust, backgroundColor: colors.rustSoft },
    lateQty: { color: colors.rust, fontWeight: '700' },
    itemName: { fontSize: 15, color: colors.ink },
    qtyGroup: { alignItems: 'flex-end', flexShrink: 0 },
    itemQty: { fontFamily: 'monospace', fontSize: 15, color: colors.ink, fontWeight: '700' },
    temporaryQty: { fontSize: 12, fontWeight: '600', color: colors.amber, marginTop: 2 },
    damagedQty: { fontSize: 12, fontWeight: '600', color: colors.rust, marginTop: 2 },
    pressOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.pressOverlay, borderRadius: radius.sm },
    lowBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginTop: 6, paddingVertical: 3, paddingHorizontal: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.amber, backgroundColor: colors.amberSoft },
    lowBadgeText: { fontSize: 11, color: colors.amber, fontWeight: '700', marginLeft: 4 },

    sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
    sheetCard: { width: '100%', maxWidth: 420, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: spacing.xl },
    sheetHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
    sheetTile: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.amberSoft, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md, flexShrink: 0 },
    sheetTitle: { fontSize: 18, fontWeight: '700', color: colors.ink, flex: 1, minWidth: 0 },
    sheetStatus: { fontSize: 14, lineHeight: 20, color: colors.ink2, marginBottom: spacing.lg },
    sheetPrimary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink, borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
    sheetPrimaryText: { fontSize: 15, fontWeight: '700', color: colors.paper, marginLeft: 8, flexShrink: 1 },
    sheetCancel: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radius.md, paddingVertical: 14, backgroundColor: colors.card },
    sheetCancelText: { fontSize: 15, fontWeight: '700', color: colors.ink },
  });
}
