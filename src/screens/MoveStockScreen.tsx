import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/client';
import { useTheme } from '../context/ThemeContext';
import Screen from '../components/Screen';
import FitInput from '../components/FitInput';

type EventLite = { id: string; name: string };
type LocationT = { id: string; name: string; type: string; isSystem?: boolean; eventLocations?: { event: EventLite }[] };
type StockEntry = { id: string; quantity: number; damagedQuantity?: number; temporaryQuantity?: number; location: LocationT; event?: EventLite | null };
type Item = { id: string; name: string; stock?: StockEntry[] };

type StockRow = {
  key: string; itemId: string; itemName: string;
  locationId: string; locationName: string;
  eventId: string | null; eventName: string | null;
  available: number; fromDamaged?: boolean;
};

type CartLine = {
  id: string; itemId: string; itemName: string;
  fromLocationId?: string; fromLocationName?: string; fromEventId?: string | null; fromEventName?: string | null;
  toLocationId?: string; toLocationName?: string; toEventId?: string | null; toEventName?: string | null;
  quantity: number; maxQuantity?: number; temporary?: boolean; fromDamaged?: boolean;
};

type Mode = 'transport' | 'import' | 'export' | 'return' | 'damage' | 'repair';

const MODE_LABELS: Record<Mode, string> = {
  transport: 'Μεταφορά', import: 'Εισαγωγή', export: 'Κατανάλωση', return: 'Επιστροφή', damage: 'Ζημιά', repair: 'Επισκευή',
};

export default function MoveStockScreen() {
  const { colors, spacing, radius } = useTheme();
  const styles = makeStyles(colors, spacing, radius);

  const [mode, setMode] = useState<Mode>('transport');
  const [locations, setLocations] = useState<LocationT[]>([]);
  const [allStockRows, setAllStockRows] = useState<StockRow[]>([]);
  const [allTemporaryRows, setAllTemporaryRows] = useState<StockRow[]>([]);
  const [allDamagedRows, setAllDamagedRows] = useState<StockRow[]>([]);
  const [allItems, setAllItems] = useState<Item[]>([]);

  const [carts, setCarts] = useState<Record<Mode, CartLine[]>>({ transport: [], import: [], export: [], return: [], damage: [], repair: [] });

  const [itemQuery, setItemQuery] = useState('');
  const [itemFocused, setItemFocused] = useState(false);
  const [pendingItem, setPendingItem] = useState<Item | null>(null);
  const [pendingRow, setPendingRow] = useState<StockRow | null>(null);
  const [pendingTemporary, setPendingTemporary] = useState(false);
  const [creatingNewItem, setCreatingNewItem] = useState(false);

  const [toQuery, setToQuery] = useState('');
  const [toFocused, setToFocused] = useState(false);
  const [pendingDestination, setPendingDestination] = useState<LocationT | null>(null);
  const [pendingToEvent, setPendingToEvent] = useState<EventLite | null>(null);

  const [pendingQuantity, setPendingQuantity] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingQuantity, setEditingQuantity] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const cart = carts[mode];

  useFocusEffect(useCallback(() => { loadData(); }, []));

  function loadData() {
    api.getLocations().then((locs: LocationT[]) => setLocations(locs.filter((l) => !l.isSystem))).catch(() => {});
    api.searchItems('').then((items: Item[]) => {
      setAllItems(items);
      const rows: StockRow[] = [], tempRows: StockRow[] = [], damagedRows: StockRow[] = [];
      items.forEach((it) => {
        (it.stock || []).forEach((s) => {
          if (s.location.isSystem) return;
          const base = { itemId: it.id, itemName: it.name, locationId: s.location.id, locationName: s.location.name, eventId: s.event?.id || null, eventName: s.event?.name || null };
          if (s.quantity > 0) rows.push({ key: `${it.id}-${s.location.id}-${s.event?.id || 'none'}`, ...base, available: s.quantity });
          if ((s.temporaryQuantity || 0) > 0) tempRows.push({ key: `${it.id}-${s.location.id}-${s.event?.id || 'none'}-temp`, ...base, available: s.temporaryQuantity || 0 });
          if ((s.damagedQuantity || 0) > 0) damagedRows.push({ key: `${it.id}-${s.location.id}-${s.event?.id || 'none'}-dmg`, ...base, available: s.damagedQuantity || 0, fromDamaged: true });
        });
      });
      setAllStockRows(rows);
      setAllTemporaryRows(tempRows);
      setAllDamagedRows(damagedRows);
    }).catch(() => {});
  }

  function resetPending() {
    setItemQuery(''); setItemFocused(false); setPendingItem(null); setPendingRow(null); setPendingTemporary(false); setCreatingNewItem(false);
    setToQuery(''); setToFocused(false); setPendingDestination(null); setPendingToEvent(null); setPendingQuantity('');
  }

  function switchMode(m: Mode) { setMode(m); resetPending(); }

  function remainingAvailable(row: StockRow) {
    const committed = cart.filter((c) => c.itemId === row.itemId && c.fromLocationId === row.locationId && (c.fromEventId ?? null) === row.eventId && !!c.fromDamaged === !!row.fromDamaged).reduce((sum, c) => sum + c.quantity, 0);
    return Math.max(row.available - committed, 0);
  }

  // Κατανάλωση can pull from BOTH the normal pool and the damaged pool - the
  // picker shows both, tagged, so you choose exactly which one you mean.
  const sourceRows = mode === 'return' ? allTemporaryRows : mode === 'repair' ? allDamagedRows : mode === 'export' ? [...allStockRows, ...allDamagedRows] : allStockRows;

  const itemResults = useMemo(() => {
    if (!itemFocused) return [];
    if (mode === 'import') {
      if (pendingItem) return [];
      const q = itemQuery.toLowerCase();
      return allItems.filter((it) => it.name.toLowerCase().includes(q));
    }
    if (pendingRow) return [];
    const withRemaining = sourceRows.map((r) => ({ ...r, remaining: remainingAvailable(r) })).filter((r) => r.remaining > 0);
    const q = itemQuery.toLowerCase();
    return q.length === 0 ? withRemaining : withRemaining.filter((r) => r.itemName.toLowerCase().includes(q));
  }, [itemQuery, itemFocused, pendingItem, pendingRow, allItems, sourceRows, cart, mode]);

  const showCreateNewItem = mode === 'import' && !pendingItem && itemQuery.trim().length >= 2 && !allItems.some((it) => it.name.toLowerCase() === itemQuery.trim().toLowerCase());

  async function createAndSelectItem() {
    const trimmed = itemQuery.trim();
    if (!trimmed) return;
    setCreatingNewItem(true);
    try {
      const created = await api.createItem(trimmed);
      setAllItems((prev) => [...prev, created]);
      setPendingItem(created);
      setItemFocused(false);
    } catch (err: any) {
      Alert.alert('Αποτυχία δημιουργίας', err.message);
    } finally {
      setCreatingNewItem(false);
    }
  }

  const toResults = useMemo(() => {
    if (!toFocused || pendingDestination) return [];
    const excludeId = mode === 'transport' ? pendingRow?.locationId : undefined;
    const pool = locations.filter((l) => l.id !== excludeId);
    const q = toQuery.toLowerCase();
    return q.length === 0 ? pool : pool.filter((l) => l.name.toLowerCase().includes(q));
  }, [toQuery, toFocused, pendingDestination, locations, mode, pendingRow]);

  const destEvents: EventLite[] = pendingDestination?.eventLocations?.map((el) => el.event) || [];
  const requiresEventChoice = destEvents.length > 1;
  const resolvedToEvent = destEvents.length === 1 ? destEvents[0] : requiresEventChoice ? pendingToEvent : null;

  const maxForPending = mode === 'import' ? undefined : pendingRow ? remainingAvailable(pendingRow) : 0;

  function handlePendingQuantityChange(text: string) {
    const digitsOnly = text.replace(/[^0-9]/g, '');
    if (digitsOnly === '') { setPendingQuantity(''); return; }
    let num = parseInt(digitsOnly, 10);
    if (maxForPending !== undefined && num > maxForPending) num = maxForPending;
    setPendingQuantity(String(num));
  }

  const needsDestination = mode === 'transport' || mode === 'import';
  const needsEventStep = needsDestination && !!pendingDestination && requiresEventChoice;

  const readyToAdd =
    mode === 'transport' ? !!pendingRow && !!pendingDestination && (!requiresEventChoice || !!pendingToEvent) :
    mode === 'import' ? !!pendingItem && !!pendingDestination && (!requiresEventChoice || !!pendingToEvent) :
    !!pendingRow;

  function addToCart() {
    const qty = Number(pendingQuantity) || 0;
    if (qty <= 0) { Alert.alert('Μη έγκυρη ποσότητα', 'Η ποσότητα πρέπει να είναι μεγαλύτερη από 0.'); return; }

    let line: CartLine;
    if (mode === 'transport' && pendingRow && pendingDestination) {
      line = {
        id: `${pendingRow.key}-${pendingDestination.id}-${Date.now()}`,
        itemId: pendingRow.itemId, itemName: pendingRow.itemName,
        fromLocationId: pendingRow.locationId, fromLocationName: pendingRow.locationName, fromEventId: pendingRow.eventId, fromEventName: pendingRow.eventName,
        toLocationId: pendingDestination.id, toLocationName: pendingDestination.name, toEventId: resolvedToEvent?.id ?? null, toEventName: resolvedToEvent?.name ?? null,
        quantity: qty, maxQuantity: pendingRow.available,
      };
    } else if (mode === 'import' && pendingItem && pendingDestination) {
      line = {
        id: `${pendingItem.id}-${pendingDestination.id}-${Date.now()}`,
        itemId: pendingItem.id, itemName: pendingItem.name,
        toLocationId: pendingDestination.id, toLocationName: pendingDestination.name, toEventId: resolvedToEvent?.id ?? null, toEventName: resolvedToEvent?.name ?? null,
        quantity: qty, temporary: pendingTemporary,
      };
    } else if (pendingRow && ['export', 'return', 'damage', 'repair'].includes(mode)) {
      line = {
        id: `${pendingRow.key}-${mode}-${Date.now()}`,
        itemId: pendingRow.itemId, itemName: pendingRow.itemName,
        fromLocationId: pendingRow.locationId, fromLocationName: pendingRow.locationName, fromEventId: pendingRow.eventId, fromEventName: pendingRow.eventName,
        quantity: qty, maxQuantity: pendingRow.available, fromDamaged: pendingRow.fromDamaged,
      };
    } else return;

    setCarts((prev) => ({ ...prev, [mode]: [...prev[mode], line] }));
    resetPending();
  }

  function removeFromCart(id: string) { setCarts((prev) => ({ ...prev, [mode]: prev[mode].filter((c) => c.id !== id) })); }
  function startEditing(line: CartLine) { setEditingId(line.id); setEditingQuantity(String(line.quantity)); }

  function handleEditingQuantityChange(text: string, line: CartLine) {
    const digitsOnly = text.replace(/[^0-9]/g, '');
    if (digitsOnly === '') { setEditingQuantity(''); return; }
    let num = parseInt(digitsOnly, 10);
    if (line.maxQuantity !== undefined) {
      const committedElsewhere = cart.filter((c) => c.id !== line.id && c.itemId === line.itemId && c.fromLocationId === line.fromLocationId && (c.fromEventId ?? null) === (line.fromEventId ?? null) && !!c.fromDamaged === !!line.fromDamaged).reduce((sum, c) => sum + c.quantity, 0);
      const max = Math.max(line.maxQuantity - committedElsewhere, 0);
      if (num > max) num = max;
    }
    setEditingQuantity(String(num));
  }

  function saveEditing(id: string) {
    const qty = Number(editingQuantity) || 0;
    if (qty <= 0) { Alert.alert('Μη έγκυρη ποσότητα', 'Η ποσότητα πρέπει να είναι μεγαλύτερη από 0.'); return; }
    setCarts((prev) => ({ ...prev, [mode]: prev[mode].map((c) => (c.id === id ? { ...c, quantity: qty } : c)) }));
    setEditingId(null);
  }

  function resetCurrentCart() { setCarts((prev) => ({ ...prev, [mode]: [] })); setNote(''); resetPending(); loadData(); }

  const canSubmit = cart.length > 0 && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      if (mode === 'transport') {
        await api.moveStockBatch({ lines: cart.map((l) => ({ itemId: l.itemId, locationId: l.fromLocationId, fromEventId: l.fromEventId ?? null, toLocationId: l.toLocationId!, toEventId: l.toEventId ?? null, quantity: l.quantity })), note: note || undefined });
      } else if (mode === 'import') {
        await api.moveStockBatch({ lines: cart.map((l) => ({ itemId: l.itemId, toLocationId: l.toLocationId!, toEventId: l.toEventId ?? null, quantity: l.quantity, temporary: l.temporary })), note: note || undefined });
      } else if (mode === 'export') {
        await api.exportStockBatch({ lines: cart.map((l) => ({ itemId: l.itemId, locationId: l.fromLocationId!, eventId: l.fromEventId ?? null, quantity: l.quantity, fromDamaged: l.fromDamaged })), note: note || undefined });
      } else if (mode === 'return') {
        await api.returnStockBatch({ lines: cart.map((l) => ({ itemId: l.itemId, locationId: l.fromLocationId!, eventId: l.fromEventId ?? null, quantity: l.quantity })), note: note || undefined });
      } else if (mode === 'damage') {
        await api.damageStockBatch({ lines: cart.map((l) => ({ itemId: l.itemId, locationId: l.fromLocationId!, eventId: l.fromEventId ?? null, quantity: l.quantity })), note: note || undefined });
      } else {
        await api.repairStockBatch({ lines: cart.map((l) => ({ itemId: l.itemId, locationId: l.fromLocationId!, eventId: l.fromEventId ?? null, quantity: l.quantity })), note: note || undefined });
      }
      Alert.alert('Ολοκληρώθηκε', `${cart.length} καταχωρήσεις καταγράφηκαν.`);
      resetCurrentCart();
    } catch (err: any) {
      Alert.alert('Απέτυχε', err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen noPadding>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.screenTitle}>Απόθεμα</Text>

          <View style={styles.modeRow}>
            {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
              <TouchableOpacity key={m} style={[styles.modeButton, mode === m && styles.modeButtonActive]} onPress={() => switchMode(m)}>
                <Text style={[styles.modeButtonText, mode === m && styles.modeButtonTextActive]} numberOfLines={1}>{MODE_LABELS[m]}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>1. Αντικείμενο</Text>
          {mode === 'import' ? (
            pendingItem ? (
              <SelectedField styles={styles} label={pendingItem.name} onChange={resetPending} />
            ) : (
              <>
                <FitInput placeholder="Αναζήτηση ή νέο αντικείμενο..." value={itemQuery} onChangeText={setItemQuery} onFocus={() => setItemFocused(true)} onBlur={() => setTimeout(() => setItemFocused(false), 150)} autoCapitalize="none" />
                {itemFocused && (
                  <View style={styles.dropdown}>
                    <ScrollView style={{ maxHeight: 220 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                      {itemResults.length === 0 && !showCreateNewItem ? (
                        <View style={styles.option}><Text style={styles.emptyHint}>Δεν βρέθηκε αντικείμενο.</Text></View>
                      ) : (
                        (itemResults as Item[]).map((it) => (
                          <TouchableOpacity key={it.id} style={styles.option} onPress={() => { setPendingItem(it); setItemFocused(false); }}>
                            <Text style={styles.optionText} numberOfLines={1}>{it.name}</Text>
                          </TouchableOpacity>
                        ))
                      )}
                      {showCreateNewItem && (
                        <TouchableOpacity style={styles.createOption} onPress={createAndSelectItem} disabled={creatingNewItem}>
                          <Text style={styles.createOptionText} numberOfLines={1}>{creatingNewItem ? 'Δημιουργία...' : `+ Δημιουργία "${itemQuery.trim()}"`}</Text>
                        </TouchableOpacity>
                      )}
                    </ScrollView>
                  </View>
                )}
              </>
            )
          ) : pendingRow ? (
            <SelectedField styles={styles} label={`${pendingRow.itemName} — ${pendingRow.locationName}${pendingRow.eventName ? ` (${pendingRow.eventName})` : ''}${pendingRow.fromDamaged ? ' · κατεστραμμένο' : ''}`} onChange={resetPending} />
          ) : (
            <>
              <FitInput
                placeholder={mode === 'return' ? 'Αναζήτηση δανεικού αντικειμένου...' : mode === 'repair' ? 'Αναζήτηση κατεστραμμένου αντικειμένου...' : 'Αναζήτηση αντικειμένου...'}
                value={itemQuery}
                onChangeText={setItemQuery}
                onFocus={() => setItemFocused(true)}
                onBlur={() => setTimeout(() => setItemFocused(false), 150)}
                autoCapitalize="none"
              />
              {itemFocused && (
                <Dropdown styles={styles} emptyText={mode === 'return' ? 'Κανένα δανεικό αντικείμενο εκεί.' : mode === 'repair' ? 'Κανένα κατεστραμμένο αντικείμενο.' : 'Δεν βρέθηκε αντικείμενο.'} items={itemResults as (StockRow & { remaining: number })[]} keyExtractor={(r) => r.key} onSelect={(r) => { setPendingRow(r); setItemFocused(false); }} render={(r) => (
                  <Text style={styles.optionText} numberOfLines={1}>
                    {r.itemName} <Text style={styles.optionSub}>— {r.locationName}{r.eventName ? ` (${r.eventName})` : ''} ({r.remaining}){r.fromDamaged ? ' · κατεστρ.' : ''}</Text>
                  </Text>
                )} />
              )}
            </>
          )}

          {needsDestination && (pendingRow || pendingItem) && (
            <>
              <Text style={styles.label}>2. Προς</Text>
              {pendingDestination ? (
                <SelectedField styles={styles} label={pendingDestination.name} onChange={() => { setPendingDestination(null); setToQuery(''); setPendingToEvent(null); }} />
              ) : (
                <>
                  <FitInput placeholder="Αναζήτηση τοποθεσίας..." value={toQuery} onChangeText={setToQuery} onFocus={() => setToFocused(true)} onBlur={() => setTimeout(() => setToFocused(false), 150)} autoCapitalize="none" />
                  {toFocused && (
                    <Dropdown styles={styles} emptyText="Δεν βρέθηκε τοποθεσία." items={toResults} keyExtractor={(l) => l.id} onSelect={(l) => { setPendingDestination(l); setToQuery(''); setToFocused(false); }} render={(l) => <Text style={styles.optionText} numberOfLines={1}>{l.name}</Text>} />
                  )}
                </>
              )}
            </>
          )}

          {needsEventStep && (
            <>
              <Text style={styles.label}>Για ποια εκδήλωση;</Text>
              <View style={styles.chipRow}>
                {destEvents.map((ev) => (
                  <TouchableOpacity key={ev.id} style={[styles.chip, pendingToEvent?.id === ev.id && styles.chipActive]} onPress={() => setPendingToEvent(ev)}>
                    <Text style={[styles.chipText, pendingToEvent?.id === ev.id && styles.chipTextActive]} numberOfLines={1}>{ev.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {mode === 'import' && pendingItem && pendingDestination && (!requiresEventChoice || pendingToEvent) && (
            <TouchableOpacity style={styles.checkboxRow} onPress={() => setPendingTemporary((v) => !v)}>
              <View style={[styles.checkbox, pendingTemporary && styles.checkboxChecked]}>{pendingTemporary && <Text style={styles.checkboxMark}>✓</Text>}</View>
              <Text style={styles.checkboxLabel}>Προσωρινό (δανεικό) — θα επιστραφεί αργότερα</Text>
            </TouchableOpacity>
          )}

          {readyToAdd && (
            <>
              <Text style={styles.label}>{needsDestination ? '3.' : '2.'} Ποσότητα</Text>
              <FitInput keyboardType="numeric" value={pendingQuantity} onChangeText={handlePendingQuantityChange} placeholder={maxForPending !== undefined ? `έως ${maxForPending}` : 'Ποσότητα'} />
              <TouchableOpacity style={styles.addButton} onPress={addToCart}><Text style={styles.addButtonText}>+ Προσθήκη στη λίστα</Text></TouchableOpacity>
            </>
          )}

          {cart.length > 0 && (
            <>
              <Text style={styles.label}>{MODE_LABELS[mode]} ({cart.length})</Text>
              <View style={styles.cartList}>
                {cart.map((line) => (
                  <View key={line.id} style={styles.cartRow}>
                    <View style={styles.cartTextCol}>
                      <Text style={styles.cartItemName} numberOfLines={1}>{line.itemName}{line.temporary ? <Text style={styles.temporaryTag}> (δανεικό)</Text> : null}{line.fromDamaged ? <Text style={styles.temporaryTag}> (κατεστρ.)</Text> : null}</Text>
                      <Text style={styles.cartRoute} numberOfLines={1}>
                        {line.fromLocationName ? `${line.fromLocationName}${line.fromEventName ? ` (${line.fromEventName})` : ''}` : ''}
                        {line.fromLocationName && line.toLocationName ? <Text style={styles.arrow}> → </Text> : ''}
                        {line.toLocationName ? `${line.toLocationName}${line.toEventName ? ` (${line.toEventName})` : ''}` : ''}
                        {!line.toLocationName && line.fromLocationName ? <Text style={styles.arrow}> → {MODE_LABELS[mode]}</Text> : null}
                      </Text>
                    </View>
                    {editingId === line.id ? (
                      <>
                        <TextInput style={styles.editInput} keyboardType="numeric" value={editingQuantity} onChangeText={(t) => handleEditingQuantityChange(t, line)} autoFocus />
                        <TouchableOpacity onPress={() => saveEditing(line.id)} style={styles.iconButton}><Text style={styles.saveText}>OK</Text></TouchableOpacity>
                      </>
                    ) : (
                      <>
                        <Text style={styles.cartQuantity}>×{line.quantity}</Text>
                        <TouchableOpacity onPress={() => startEditing(line)} style={styles.iconButton}><Text style={styles.editText}>Επεξ.</Text></TouchableOpacity>
                      </>
                    )}
                    <TouchableOpacity onPress={() => removeFromCart(line.id)} style={styles.iconButton}><Text style={styles.removeText}>×</Text></TouchableOpacity>
                  </View>
                ))}
              </View>
            </>
          )}

          <Text style={styles.label}>Σημείωση (προαιρετικό)</Text>
          <TextInput style={[styles.input, styles.noteInput]} value={note} onChangeText={setNote} placeholder="π.χ. για μια εκδήλωση στο πάρκο" placeholderTextColor={colors.muted} multiline />

          <TouchableOpacity style={[styles.button, !canSubmit && styles.buttonDisabled]} onPress={handleSubmit} disabled={!canSubmit}>
            <Text style={styles.buttonText}>{submitting ? 'Καταγραφή...' : MODE_LABELS[mode]}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

// The chosen item stays on ONE line and shrinks (down to 75%) to fit before
// it truncates, so long names never wrap or push "Αλλαγή" out of the box.
function SelectedField({ label, onChange, styles }: { label: string; onChange: () => void; styles: any }) {
  return (
    <View style={styles.selectedRow}>
      <Text style={styles.selectedChipText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{label}</Text>
      <TouchableOpacity onPress={onChange}><Text style={styles.changeLink}>Αλλαγή</Text></TouchableOpacity>
    </View>
  );
}

function Dropdown<T>({ items, keyExtractor, onSelect, render, emptyText, styles }: { items: T[]; keyExtractor: (item: T) => string; onSelect: (item: T) => void; render: (item: T) => React.ReactNode; emptyText: string; styles: any }) {
  return (
    <View style={styles.dropdown}>
      <ScrollView style={{ maxHeight: 220 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
        {items.length === 0 ? (
          <View style={styles.option}><Text style={styles.emptyHint}>{emptyText}</Text></View>
        ) : (
          items.map((item) => (
            <TouchableOpacity key={keyExtractor(item)} style={styles.option} onPress={() => onSelect(item)}>{render(item)}</TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: any, spacing: any, radius: any) {
  return StyleSheet.create({
    flex: { flex: 1 },
    container: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: 48 },
    screenTitle: { fontSize: 25, fontWeight: '700', color: colors.ink, marginBottom: spacing.lg },
    modeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
    modeButton: { flexGrow: 1, minWidth: '30%', paddingVertical: spacing.md, paddingHorizontal: 4, borderRadius: radius.sm, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderBottomWidth: 3, borderBottomColor: 'transparent', alignItems: 'center' },
    modeButtonActive: { backgroundColor: colors.ink, borderColor: colors.ink, borderBottomColor: colors.amber },
    modeButtonText: { fontSize: 12.5, fontWeight: '600', color: colors.ink2 },
    modeButtonTextActive: { color: colors.paper, fontWeight: '700' },
    label: { fontSize: 13, fontWeight: '600', color: colors.ink2, marginTop: spacing.lg, marginBottom: spacing.sm },
    emptyHint: { fontSize: 13, color: colors.muted, fontStyle: 'italic' },
    input: { borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radius.md, paddingVertical: 13, paddingHorizontal: spacing.lg, fontSize: 15, color: colors.ink, backgroundColor: colors.card },
    noteInput: { minHeight: 60, textAlignVertical: 'top' },
    dropdown: { marginTop: spacing.sm, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.card, overflow: 'hidden' },
    option: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.paper },
    optionText: { fontSize: 15, color: colors.ink },
    optionSub: { fontSize: 13, color: colors.muted, fontWeight: '400' },
    createOption: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
    createOptionText: { fontSize: 14, color: colors.petrol, fontWeight: '700' },
    selectedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radius.md, minHeight: 50, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
    selectedChipText: { fontSize: 15, fontWeight: '600', color: colors.ink, flex: 1, minWidth: 0, marginRight: spacing.sm },
    changeLink: { fontSize: 13, color: colors.petrol, fontWeight: '600', flexShrink: 0 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    chip: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.lineStrong, maxWidth: '100%' },
    chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
    chipText: { fontSize: 13, fontWeight: '600', color: colors.ink2 },
    chipTextActive: { color: colors.paper },
    checkboxRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg },
    checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.lineStrong, marginRight: spacing.sm + 2, alignItems: 'center', justifyContent: 'center' },
    checkboxChecked: { backgroundColor: colors.ink, borderColor: colors.ink },
    checkboxMark: { color: colors.paper, fontSize: 14, fontWeight: '700' },
    checkboxLabel: { fontSize: 14, color: colors.ink, flex: 1, minWidth: 0 },
    addButton: { marginTop: spacing.md + 2, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.petrolSoft, alignItems: 'center' },
    addButtonText: { color: colors.petrol, fontWeight: '700', fontSize: 14 },
    cartList: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.card, overflow: 'hidden' },
    cartRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.paper },
    cartTextCol: { flex: 1, minWidth: 0, marginRight: spacing.sm },
    cartItemName: { fontSize: 15, fontWeight: '600', color: colors.ink },
    temporaryTag: { fontSize: 12, fontWeight: '600', color: colors.amber },
    cartRoute: { fontSize: 12, color: colors.muted, marginTop: 2 },
    arrow: { color: colors.petrol, fontWeight: '700' },
    cartQuantity: { fontSize: 15, color: colors.ink, fontWeight: '700', marginRight: spacing.sm + 2, flexShrink: 0 },
    editInput: { width: 56, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radius.sm, paddingVertical: 4, paddingHorizontal: 6, marginRight: spacing.sm, textAlign: 'center', color: colors.ink, flexShrink: 0 },
    iconButton: { paddingHorizontal: spacing.sm, paddingVertical: 4, flexShrink: 0 },
    editText: { color: colors.petrol, fontWeight: '600', fontSize: 13 },
    saveText: { color: colors.moss, fontWeight: '700', fontSize: 13 },
    removeText: { color: colors.rust, fontWeight: '700', fontSize: 18 },
    button: { backgroundColor: colors.ink, paddingVertical: spacing.lg, borderRadius: radius.lg, marginTop: spacing.xxl },
    buttonDisabled: { backgroundColor: colors.lineStrong },
    buttonText: { color: colors.paper, textAlign: 'center', fontWeight: '700', fontSize: 16 },
  });
}