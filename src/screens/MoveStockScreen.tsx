import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { api } from '../api/client';

type Location = { id: string; name: string; type: string };
type StockEntry = { id: string; quantity: number; location: Location };
type Item = { id: string; name: string; stock?: StockEntry[] };

// A single row in the item search dropdown - one per (item, location) pair
type StockRow = {
  key: string;
  itemId: string;
  itemName: string;
  locationId: string;
  locationName: string;
  available: number;
};

// A confirmed line in the "items to move" list
type CartLine = {
  id: string;
  itemId: string;
  itemName: string;
  locationId: string;
  locationName: string;
  quantity: number;
  maxQuantity: number;
};

export default function MoveStockScreen() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [allStockRows, setAllStockRows] = useState<StockRow[]>([]);

  // DESTINATION ("Προς") - strict dropdown, no free text fallback
  const [toQuery, setToQuery] = useState('');
  const [toLocation, setToLocation] = useState<Location | null>(null);
  const [toFocused, setToFocused] = useState(false);

  // ITEM PICKER (for adding a line to the cart)
  const [itemQuery, setItemQuery] = useState('');
  const [itemFocused, setItemFocused] = useState(false);
  const [pendingRow, setPendingRow] = useState<StockRow | null>(null);
  const [pendingQuantity, setPendingQuantity] = useState('');

  // THE LIST OF ITEMS BEING MOVED
  const [cart, setCart] = useState<CartLine[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingQuantity, setEditingQuantity] = useState('');

  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.getLocations().then(setLocations).catch(() => {});
    loadStockRows();
  }, []);

  function loadStockRows() {
    api
      .searchItems('')
      .then((items: Item[]) => {
        const rows: StockRow[] = [];
        items.forEach((it) => {
          (it.stock || []).forEach((s) => {
            if (s.quantity > 0) {
              rows.push({
                key: `${it.id}-${s.location.id}`,
                itemId: it.id,
                itemName: it.name,
                locationId: s.location.id,
                locationName: s.location.name,
                available: s.quantity,
              });
            }
          });
        });
        setAllStockRows(rows);
      })
      .catch(() => {});
  }

  // TO dropdown results - live-filtered, shown even when empty. Strict: no
  // way to submit a location that isn't in this list.
  const toResults = useMemo(() => {
    if (!toFocused || toLocation) return [];
    if (toQuery.length === 0) return locations;
    return locations.filter((l) => l.name.toLowerCase().includes(toQuery.toLowerCase()));
  }, [toQuery, toFocused, toLocation, locations]);

  // ITEM dropdown results - live-filtered by item name, shown even when
  // empty. Each row carries its own location so the same item at two
  // different storages shows as two separate selectable rows.
  const itemResults = useMemo(() => {
    if (!itemFocused || pendingRow) return [];
    const alreadyInCart = new Set(cart.map((c) => `${c.itemId}-${c.locationId}`));
    const pool = allStockRows.filter((r) => !alreadyInCart.has(r.key));
    if (itemQuery.length === 0) return pool;
    return pool.filter((r) => r.itemName.toLowerCase().includes(itemQuery.toLowerCase()));
  }, [itemQuery, itemFocused, pendingRow, allStockRows, cart]);

  function handlePendingQuantityChange(text: string) {
    const digitsOnly = text.replace(/[^0-9]/g, '');
    if (digitsOnly === '') {
      setPendingQuantity('');
      return;
    }
    let num = parseInt(digitsOnly, 10);
    if (pendingRow && num > pendingRow.available) num = pendingRow.available;
    setPendingQuantity(String(num));
  }

  function addToCart() {
    if (!pendingRow) return;
    const qty = Number(pendingQuantity) || 0;
    if (qty <= 0) {
      Alert.alert('Μη έγκυρη ποσότητα', 'Η ποσότητα πρέπει να είναι μεγαλύτερη από 0.');
      return;
    }
    setCart((prev) => [
      ...prev,
      {
        id: `${pendingRow.key}-${Date.now()}`,
        itemId: pendingRow.itemId,
        itemName: pendingRow.itemName,
        locationId: pendingRow.locationId,
        locationName: pendingRow.locationName,
        quantity: qty,
        maxQuantity: pendingRow.available,
      },
    ]);
    setPendingRow(null);
    setPendingQuantity('');
    setItemQuery('');
  }

  function removeFromCart(id: string) {
    setCart((prev) => prev.filter((c) => c.id !== id));
  }

  // Editing a cart line only ever changes its quantity - never the item or
  // the location. To change either of those, remove the line and add a new one.
  function startEditing(line: CartLine) {
    setEditingId(line.id);
    setEditingQuantity(String(line.quantity));
  }

  function handleEditingQuantityChange(text: string, max: number) {
    const digitsOnly = text.replace(/[^0-9]/g, '');
    if (digitsOnly === '') {
      setEditingQuantity('');
      return;
    }
    let num = parseInt(digitsOnly, 10);
    if (num > max) num = max;
    setEditingQuantity(String(num));
  }

  function saveEditing(id: string) {
    const qty = Number(editingQuantity) || 0;
    if (qty <= 0) {
      Alert.alert('Μη έγκυρη ποσότητα', 'Η ποσότητα πρέπει να είναι μεγαλύτερη από 0.');
      return;
    }
    setCart((prev) => prev.map((c) => (c.id === id ? { ...c, quantity: qty } : c)));
    setEditingId(null);
  }

  function resetForm() {
    setToQuery('');
    setToLocation(null);
    setItemQuery('');
    setPendingRow(null);
    setPendingQuantity('');
    setCart([]);
    setNote('');
    loadStockRows();
  }

  const canSubmit = !!toLocation && cart.length > 0 && !submitting;

  async function handleSubmit() {
    if (!canSubmit || !toLocation) return;
    setSubmitting(true);
    try {
      for (const line of cart) {
        await api.moveStock({
          itemId: line.itemId,
          fromLocationId: line.locationId,
          toLocationId: toLocation.id,
          quantity: line.quantity,
          note: note || undefined,
        });
      }

      Alert.alert('Μεταφέρθηκε', `${cart.length} αντικείμενα μεταφέρθηκαν.`);
      resetForm();
    } catch (err: any) {
      Alert.alert('Η μεταφορά απέτυχε', err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.screenTitle}>Μεταφορά αποθέματος</Text>

        {/* DESTINATION */}
        <Text style={styles.label}>Προς</Text>
        {toLocation ? (
          <SelectedField label={toLocation.name} onChange={() => { setToLocation(null); setToQuery(''); }} />
        ) : (
          <>
            <TextInput
              style={styles.input}
              placeholder="Αναζήτηση τοποθεσίας..."
              placeholderTextColor="#999"
              value={toQuery}
              onChangeText={setToQuery}
              onFocus={() => setToFocused(true)}
              onBlur={() => setTimeout(() => setToFocused(false), 150)}
              autoCapitalize="none"
            />
            {toFocused && (
              <View style={styles.dropdown}>
                <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                  {toResults.length === 0 ? (
                    <View style={styles.option}>
                      <Text style={styles.emptyHint}>Δεν βρέθηκε τοποθεσία.</Text>
                    </View>
                  ) : (
                    toResults.map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.option}
                        onPress={() => { setToLocation(item); setToQuery(''); setToFocused(false); }}
                      >
                        <Text style={styles.optionText}>{item.name}</Text>
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              </View>
            )}
          </>
        )}

        {/* ITEM PICKER */}
        <Text style={styles.label}>Προσθήκη αντικειμένου</Text>
        {pendingRow ? (
          <SelectedField
            label={`${pendingRow.itemName} — ${pendingRow.locationName}`}
            onChange={() => { setPendingRow(null); setPendingQuantity(''); }}
          />
        ) : (
          <>
            <TextInput
              style={styles.input}
              placeholder="Αναζήτηση αντικειμένου..."
              placeholderTextColor="#999"
              value={itemQuery}
              onChangeText={setItemQuery}
              onFocus={() => setItemFocused(true)}
              onBlur={() => setTimeout(() => setItemFocused(false), 150)}
              autoCapitalize="none"
            />
            {itemFocused && (
              <View style={styles.dropdown}>
                <ScrollView style={{ maxHeight: 220 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                  {itemResults.length === 0 ? (
                    <View style={styles.option}>
                      <Text style={styles.emptyHint}>Δεν βρέθηκε αντικείμενο.</Text>
                    </View>
                  ) : (
                    itemResults.map((item) => (
                      <TouchableOpacity
                        key={item.key}
                        style={styles.option}
                        onPress={() => { setPendingRow(item); setItemFocused(false); }}
                      >
                        <Text style={styles.optionText}>
                          {item.itemName} <Text style={styles.optionSub}>— {item.locationName} ({item.available})</Text>
                        </Text>
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              </View>
            )}
          </>
        )}

        {/* QUANTITY - grayed out and disabled until an item is picked */}
        <Text style={[styles.label, !pendingRow && styles.labelDisabled]}>Ποσότητα</Text>
        <TextInput
          style={[styles.input, !pendingRow && styles.inputDisabled]}
          keyboardType="numeric"
          value={pendingQuantity}
          onChangeText={handlePendingQuantityChange}
          placeholder={pendingRow ? `έως ${pendingRow.available}` : 'Επίλεξε πρώτα αντικείμενο'}
          placeholderTextColor="#aaa"
          editable={!!pendingRow}
        />

        <TouchableOpacity
          style={[styles.addButton, !pendingRow && styles.addButtonDisabled]}
          onPress={addToCart}
          disabled={!pendingRow}
        >
          <Text style={styles.addButtonText}>+ Προσθήκη στη λίστα</Text>
        </TouchableOpacity>

        {/* CART - every line has an edit (quantity only) and a remove button */}
        {cart.length > 0 && (
          <>
            <Text style={styles.label}>Αντικείμενα προς μεταφορά ({cart.length})</Text>
            <View style={styles.cartList}>
              {cart.map((line) => (
                <View key={line.id} style={styles.cartRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cartItemName}>{line.itemName}</Text>
                    <Text style={styles.cartItemSub}>{line.locationName}</Text>
                  </View>

                  {editingId === line.id ? (
                    <>
                      <TextInput
                        style={styles.editInput}
                        keyboardType="numeric"
                        value={editingQuantity}
                        onChangeText={(t) => handleEditingQuantityChange(t, line.maxQuantity)}
                        autoFocus
                      />
                      <TouchableOpacity onPress={() => saveEditing(line.id)} style={styles.iconButton}>
                        <Text style={styles.saveText}>OK</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <Text style={styles.cartQuantity}>×{line.quantity}</Text>
                      <TouchableOpacity onPress={() => startEditing(line)} style={styles.iconButton}>
                        <Text style={styles.editText}>Επεξ.</Text>
                      </TouchableOpacity>
                    </>
                  )}

                  <TouchableOpacity onPress={() => removeFromCart(line.id)} style={styles.iconButton}>
                    <Text style={styles.removeText}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </>
        )}

        {/* NOTE - the one free-text field */}
        <Text style={styles.label}>Σημείωση (προαιρετικό)</Text>
        <TextInput
          style={[styles.input, styles.noteInput]}
          value={note}
          onChangeText={setNote}
          placeholder="π.χ. για τη συναυλία στο Κέντρο Νιάρχος"
          placeholderTextColor="#999"
          multiline
        />

        <TouchableOpacity
          style={[styles.button, !canSubmit && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
        >
          <Text style={styles.buttonText}>{submitting ? 'Μεταφορά...' : 'Μεταφορά'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SelectedField({ label, onChange }: { label: string; onChange: () => void }) {
  return (
    <View style={styles.selectedRow}>
      <Text style={styles.selectedChipText}>{label}</Text>
      <TouchableOpacity onPress={onChange}>
        <Text style={styles.changeLink}>Αλλαγή</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f7f8fa' },
  container: { padding: 20, paddingBottom: 48 },
  screenTitle: { fontSize: 22, fontWeight: '700', color: '#111', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginTop: 18, marginBottom: 8 },
  labelDisabled: { color: '#bbb' },
  emptyHint: { fontSize: 13, color: '#999', fontStyle: 'italic' },

  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#111',
    backgroundColor: '#fff',
  },
  inputDisabled: {
    backgroundColor: '#f0f0f0',
    borderColor: '#eaeaea',
    color: '#aaa',
  },
  noteInput: { minHeight: 60, textAlignVertical: 'top' },

  dropdown: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  option: { paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#f2f2f2' },
  optionText: { fontSize: 15, color: '#222' },
  optionSub: { fontSize: 13, color: '#888', fontWeight: '400' },

  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  selectedChipText: { fontSize: 15, fontWeight: '600', color: '#111', flex: 1 },
  changeLink: { fontSize: 13, color: '#2563eb', fontWeight: '600', marginLeft: 12 },

  addButton: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
  },
  addButtonDisabled: { backgroundColor: '#f2f2f2' },
  addButtonText: { color: '#2563eb', fontWeight: '700', fontSize: 14 },

  cartList: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  cartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f2f2f2',
  },
  cartItemName: { fontSize: 15, fontWeight: '600', color: '#111' },
  cartItemSub: { fontSize: 12, color: '#888', marginTop: 2 },
  cartQuantity: { fontSize: 15, fontWeight: '600', color: '#333', marginRight: 10 },
  editInput: {
    width: 50,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginRight: 8,
    textAlign: 'center',
    color: '#111',
  },
  iconButton: { paddingHorizontal: 8, paddingVertical: 4 },
  editText: { color: '#2563eb', fontWeight: '600', fontSize: 13 },
  saveText: { color: '#16a34a', fontWeight: '700', fontSize: 13 },
  removeText: { color: '#dc2626', fontWeight: '700', fontSize: 18 },

  button: {
    backgroundColor: '#111',
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 32,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  buttonDisabled: { backgroundColor: '#ccc' },
  buttonText: { color: '#fff', textAlign: 'center', fontWeight: '700', fontSize: 16 },
});