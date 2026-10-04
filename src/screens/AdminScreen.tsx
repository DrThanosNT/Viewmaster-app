import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import Screen from '../components/Screen';
import { parseDateTime, todayInput } from '../utils/dateTime';

type LocationType = 'STORAGE' | 'VEHICLE' | 'OTHER';
type LocationT = { id: string; name: string; type: string; isSystem?: boolean };
type EventT = { id: string; name: string; startDate: string; endDate: string; eventLocations: { location: LocationT }[] };
type Member = { id: string; name: string; phone?: string; email?: string; role: string; photoUrl?: string | null };

const TYPE_OPTIONS: { value: LocationType; label: string }[] = [
  { value: 'STORAGE', label: 'Αποθήκη' }, { value: 'VEHICLE', label: 'Όχημα' }, { value: 'OTHER', label: 'Άλλο' },
];
const ROLE_LABELS: Record<string, string> = { ADMIN: 'Διαχειριστής', MANAGER: 'Υπεύθυνος', WORKER: 'Εργαζόμενος' };
const ROLE_ORDER: Record<string, number> = { ADMIN: 0, MANAGER: 1, WORKER: 2 };

type View = 'menu' | 'createLocation' | 'manageLocations' | 'createEvent' | 'manageEvents' | 'registerUser' | 'members' | 'memberDetail';

export default function AdminScreen() {
  const [view, setView] = useState<View>('menu');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const { spacing, typography } = useTheme();
  const styles = makeStyles(useTheme().colors, spacing);

  if (view === 'createLocation') return <CreateLocationScreen onBack={() => setView('menu')} />;
  if (view === 'manageLocations') return <ManageLocationsScreen onBack={() => setView('menu')} />;
  if (view === 'createEvent') return <CreateEventScreen onBack={() => setView('menu')} />;
  if (view === 'manageEvents') return <ManageEventsScreen onBack={() => setView('menu')} />;
  if (view === 'registerUser') return <RegisterUserScreen onBack={() => setView('menu')} />;
  if (view === 'members') return <MembersScreen onBack={() => setView('menu')} onSelect={(m) => { setSelectedMember(m); setView('memberDetail'); }} />;
  if (view === 'memberDetail' && selectedMember) return <MemberDetailScreen member={selectedMember} onBack={() => setView('members')} />;

  const rows: { label: string; onPress: () => void }[] = [
    { label: 'Νέα Τοποθεσία', onPress: () => setView('createLocation') },
    { label: 'Τοποθεσίες', onPress: () => setView('manageLocations') },
    { label: 'Νέα Εκδήλωση', onPress: () => setView('createEvent') },
    { label: 'Εκδηλώσεις', onPress: () => setView('manageEvents') },
    { label: 'Νέος Χρήστης', onPress: () => setView('registerUser') },
    { label: 'Μέλη', onPress: () => setView('members') },
  ];

  return (
    <Screen>
      <Text style={[typography.title, { marginBottom: spacing.lg }]}>Διαχείριση</Text>
      {rows.map((r) => (
        <TouchableOpacity key={r.label} style={styles.menuRow} onPress={r.onPress}>
          <Text style={styles.menuText}>{r.label}</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      ))}
    </Screen>
  );
}

function CreateLocationScreen({ onBack }: { onBack: () => void }) {
  const { colors, spacing, typography } = useTheme();
  const styles = makeStyles(colors, spacing);
  const [name, setName] = useState('');
  const [type, setType] = useState<LocationType>('STORAGE');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate() {
    if (!name.trim()) { Alert.alert('Λείπει το όνομα', 'Δώσε ένα όνομα στην τοποθεσία.'); return; }
    setSubmitting(true);
    try {
      await api.createLocation({ name: name.trim(), type, address: address.trim() || undefined });
      Alert.alert('Δημιουργήθηκε', `Η τοποθεσία "${name}" δημιουργήθηκε.`);
      onBack();
    } catch (err: any) {
      Alert.alert('Αποτυχία', err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen noPadding>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={onBack} style={styles.backRow}><Text style={styles.backText}>‹ Διαχείριση</Text></TouchableOpacity>
          <Text style={[typography.title, { marginBottom: spacing.lg }]}>Νέα Τοποθεσία</Text>
          <Text style={typography.label}>Όνομα</Text>
          <TextInput style={styles.input} placeholder="π.χ. Αποθήκη 4, Βαν 2" placeholderTextColor={colors.muted} value={name} onChangeText={setName} />
          <Text style={[typography.label, { marginTop: spacing.lg }]}>Τύπος</Text>
          <View style={styles.typeRow}>
            {TYPE_OPTIONS.map((opt) => (
              <TouchableOpacity key={opt.value} style={[styles.typeButton, type === opt.value && styles.typeButtonActive]} onPress={() => setType(opt.value)}>
                <Text style={[styles.typeButtonText, type === opt.value && styles.typeButtonTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[typography.label, { marginTop: spacing.lg }]}>Διεύθυνση (προαιρετικό)</Text>
          <TextInput style={styles.input} placeholder="π.χ. Λεωφ. Ανδρέα Συγγρού 364" placeholderTextColor={colors.muted} value={address} onChangeText={setAddress} />
          <TouchableOpacity style={[styles.button, submitting && styles.buttonDisabled]} onPress={handleCreate} disabled={submitting}>
            <Text style={styles.buttonText}>{submitting ? 'Δημιουργία...' : 'Δημιουργία Τοποθεσίας'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function ManageLocationsScreen({ onBack }: { onBack: () => void }) {
  const { colors, spacing, typography } = useTheme();
  const styles = makeStyles(colors, spacing);
  const [locations, setLocations] = useState<LocationT[]>([]);

  useFocusEffect(useCallback(() => { api.getLocations().then(setLocations).catch(() => {}); }, []));

  function confirmDelete(loc: LocationT) {
    Alert.alert('Διαγραφή τοποθεσίας', `Να διαγραφεί η "${loc.name}";`, [
      { text: 'Ακύρωση', style: 'cancel' },
      { text: 'Διαγραφή', style: 'destructive', onPress: async () => {
        try {
          await api.deleteLocation(loc.id);
          setLocations((prev) => prev.filter((l) => l.id !== loc.id));
        } catch (err: any) {
          Alert.alert('Αποτυχία', err.message);
        }
      }},
    ]);
  }

  return (
    <Screen>
      <TouchableOpacity onPress={onBack} style={styles.backRow}><Text style={styles.backText}>‹ Διαχείριση</Text></TouchableOpacity>
      <Text style={[typography.title, { marginBottom: spacing.lg }]}>Τοποθεσίες</Text>
      <ScrollView>
        {locations.filter((l) => !l.isSystem).map((loc) => (
          <View key={loc.id} style={styles.listRow}>
            <Text style={styles.listRowText} numberOfLines={1}>{loc.name}</Text>
            <TouchableOpacity onPress={() => confirmDelete(loc)}><Text style={styles.deleteText}>Διαγραφή</Text></TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

function CreateEventScreen({ onBack }: { onBack: () => void }) {
  const { colors, spacing, typography } = useTheme();
  const styles = makeStyles(colors, spacing);
  const [locations, setLocations] = useState<LocationT[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useFocusEffect(useCallback(() => { api.getLocations().then((locs: LocationT[]) => setLocations(locs.filter((l) => l.type !== 'STORAGE' && !l.isSystem))).catch(() => {}); }, []));

  function toggleLocation(id: string) { setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])); }

  async function handleCreate() {
    if (!name.trim()) { Alert.alert('Λείπει το όνομα', 'Δώσε ένα όνομα στην εκδήλωση.'); return; }
    if (selectedIds.length === 0) { Alert.alert('Λείπουν τοποθεσίες', 'Επίλεξε τουλάχιστον μία τοποθεσία.'); return; }
    const start = parseDateTime(startDate, startTime);
    const end = parseDateTime(endDate, endTime);
    if (!start || !end) { Alert.alert('Μη έγκυρη ημερομηνία', 'Χρησιμοποίησε τη μορφή ΕΕΕΕ-ΜΜ-ΗΗ και ΩΩ:ΛΛ (ώρα 00-23).'); return; }
    if (end <= start) { Alert.alert('Μη έγκυρο διάστημα', 'Η λήξη πρέπει να είναι μετά την έναρξη.'); return; }

    setSubmitting(true);
    try {
      await api.createEvent({ name: name.trim(), startDate: start.toISOString(), endDate: end.toISOString(), locationIds: selectedIds });
      Alert.alert('Δημιουργήθηκε', `Η εκδήλωση "${name}" δημιουργήθηκε.`);
      onBack();
    } catch (err: any) {
      Alert.alert('Αποτυχία', err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen noPadding>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={onBack} style={styles.backRow}><Text style={styles.backText}>‹ Διαχείριση</Text></TouchableOpacity>
          <Text style={[typography.title, { marginBottom: spacing.lg }]}>Νέα Εκδήλωση</Text>

          <Text style={typography.label}>Όνομα</Text>
          <TextInput style={styles.input} placeholder="π.χ. Συναυλία Ιουλίου" placeholderTextColor={colors.muted} value={name} onChangeText={setName} />

          <Text style={[typography.label, { marginTop: spacing.lg }]}>Τοποθεσίες</Text>
          <Text style={styles.hint}>Επίλεξε από τις υπάρχουσες τοποθεσίες (όχι αποθήκες).</Text>
          <View style={styles.chipWrap}>
            {locations.map((loc) => (
              <TouchableOpacity key={loc.id} style={[styles.chip, selectedIds.includes(loc.id) && styles.chipActive]} onPress={() => toggleLocation(loc.id)}>
                <Text style={[styles.chipText, selectedIds.includes(loc.id) && styles.chipTextActive]} numberOfLines={1}>{loc.name}</Text>
              </TouchableOpacity>
            ))}
            {locations.length === 0 && <Text style={styles.hint}>Δεν υπάρχουν διαθέσιμες τοποθεσίες (οχήματα/άλλο).</Text>}
          </View>

          <Text style={[typography.label, { marginTop: spacing.lg }]}>Έναρξη</Text>
          <View style={styles.row2}>
            <TextInput style={[styles.input, { flex: 1 }]} placeholder="ΕΕΕΕ-ΜΜ-ΗΗ" placeholderTextColor={colors.muted} value={startDate} onChangeText={setStartDate} onFocus={() => { if (!startDate) setStartDate(todayInput()); }} />
            <TextInput style={[styles.input, { flex: 1 }]} placeholder="ΩΩ:ΛΛ" placeholderTextColor={colors.muted} value={startTime} onChangeText={setStartTime} />
          </View>

          <Text style={[typography.label, { marginTop: spacing.lg }]}>Λήξη</Text>
          <View style={styles.row2}>
            <TextInput style={[styles.input, { flex: 1 }]} placeholder="ΕΕΕΕ-ΜΜ-ΗΗ" placeholderTextColor={colors.muted} value={endDate} onChangeText={setEndDate} onFocus={() => { if (!endDate) setEndDate(todayInput()); }} />
            <TextInput style={[styles.input, { flex: 1 }]} placeholder="ΩΩ:ΛΛ" placeholderTextColor={colors.muted} value={endTime} onChangeText={setEndTime} />
          </View>

          <TouchableOpacity style={[styles.button, submitting && styles.buttonDisabled]} onPress={handleCreate} disabled={submitting}>
            <Text style={styles.buttonText}>{submitting ? 'Δημιουργία...' : 'Δημιουργία Εκδήλωσης'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function eventStatus(ev: EventT) {
  const now = Date.now();
  const s = new Date(ev.startDate).getTime(), e = new Date(ev.endDate).getTime();
  if (now < s) return 'upcoming';
  if (now > e) return 'passed';
  return 'ongoing';
}

function formatEventRange(startIso: string, endIso: string) {
  const s = new Date(startIso), e = new Date(endIso);
  const sStr = s.toLocaleDateString('el-GR', { day: 'numeric', month: 'short' });
  const eStr = e.toLocaleDateString('el-GR', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${sStr} – ${eStr}`;
}

function ManageEventsScreen({ onBack }: { onBack: () => void }) {
  const { colors, spacing, radius, typography } = useTheme();
  const styles = makeStyles(colors, spacing);
  const [events, setEvents] = useState<EventT[]>([]);
  const [openEvent, setOpenEvent] = useState<EventT | null>(null);

  useFocusEffect(useCallback(() => { api.getEvents().then(setEvents).catch(() => {}); }, []));

  const statusMeta: Record<string, { label: string; color: string; soft: string }> = {
    upcoming: { label: 'Επερχόμενη', color: colors.petrol, soft: colors.petrolSoft },
    ongoing: { label: 'Σε εξέλιξη', color: colors.moss, soft: colors.mossSoft },
    passed: { label: 'Ολοκληρώθηκε', color: colors.muted, soft: colors.line },
  };

  if (openEvent) return <EventDetailScreen event={openEvent} onBack={() => setOpenEvent(null)} onDeleted={() => { setOpenEvent(null); setEvents((prev) => prev.filter((e) => e.id !== openEvent.id)); }} />;

  return (
    <Screen>
      <TouchableOpacity onPress={onBack} style={styles.backRow}><Text style={styles.backText}>‹ Διαχείριση</Text></TouchableOpacity>
      <Text style={[typography.title, { marginBottom: spacing.lg }]}>Εκδηλώσεις</Text>
      <ScrollView>
        {events.map((ev) => {
          const st = statusMeta[eventStatus(ev)];
          return (
            <TouchableOpacity key={ev.id} style={styles.eventRow} onPress={() => setOpenEvent(ev)}>
              <View style={{ flex: 1, minWidth: 0, marginRight: spacing.sm }}>
                <Text style={styles.listRowText} numberOfLines={1}>{ev.name}</Text>
                <Text style={styles.hint} numberOfLines={1}>{formatEventRange(ev.startDate, ev.endDate)} · {ev.eventLocations.map((el) => el.location.name).join(', ')}</Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: st.soft }]}>
                <Text style={[styles.statusPillText, { color: st.color }]}>{st.label}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
        {events.length === 0 && <Text style={styles.hint}>Καμία εκδήλωση ακόμα.</Text>}
      </ScrollView>
    </Screen>
  );
}

function EventDetailScreen({ event, onBack, onDeleted }: { event: EventT; onBack: () => void; onDeleted: () => void }) {
  const { colors, spacing, radius, typography } = useTheme();
  const styles = makeStyles(colors, spacing);
  const [expandedLocationId, setExpandedLocationId] = useState<string | null>(null);
  const [locationItems, setLocationItems] = useState<Record<string, { name: string; quantity: number }[]>>({});
  const [loadingLocation, setLoadingLocation] = useState<string | null>(null);

  const statusMeta: Record<string, { label: string; color: string; soft: string }> = {
    upcoming: { label: 'Επερχόμενη', color: colors.petrol, soft: colors.petrolSoft },
    ongoing: { label: 'Σε εξέλιξη', color: colors.moss, soft: colors.mossSoft },
    passed: { label: 'Ολοκληρώθηκε', color: colors.muted, soft: colors.line },
  };
  const st = statusMeta[eventStatus(event)];

  async function toggleLocation(locationId: string) {
    if (expandedLocationId === locationId) { setExpandedLocationId(null); return; }
    setExpandedLocationId(locationId);
    if (!locationItems[locationId]) {
      setLoadingLocation(locationId);
      try {
        const detail = await api.getLocation(locationId);
        const items = (detail.stock || [])
          .filter((s: any) => s.eventId === event.id && s.quantity > 0)
          .map((s: any) => ({ name: s.item.name, quantity: s.quantity }));
        setLocationItems((prev) => ({ ...prev, [locationId]: items }));
      } catch {
        setLocationItems((prev) => ({ ...prev, [locationId]: [] }));
      } finally {
        setLoadingLocation(null);
      }
    }
  }

  function confirmDelete() {
    Alert.alert('Διαγραφή εκδήλωσης', `Να διαγραφεί η "${event.name}";`, [
      { text: 'Ακύρωση', style: 'cancel' },
      { text: 'Διαγραφή', style: 'destructive', onPress: async () => {
        try {
          await api.deleteEvent(event.id);
          onDeleted();
        } catch (err: any) {
          Alert.alert('Αποτυχία', err.message);
        }
      }},
    ]);
  }

  return (
    <Screen>
      <TouchableOpacity onPress={onBack} style={styles.backRow}><Text style={styles.backText}>‹ Εκδηλώσεις</Text></TouchableOpacity>
      <Text style={typography.title} numberOfLines={2}>{event.name}</Text>
      <View style={[styles.statusPill, { backgroundColor: st.soft, alignSelf: 'flex-start', marginTop: spacing.sm, marginBottom: spacing.sm }]}>
        <Text style={[styles.statusPillText, { color: st.color }]}>{st.label}</Text>
      </View>
      <Text style={[typography.bodyMuted, { marginBottom: spacing.xl }]}>{formatEventRange(event.startDate, event.endDate)}</Text>

      <Text style={[typography.label, { marginBottom: spacing.sm }]}>Τοποθεσίες</Text>
      <ScrollView>
        {event.eventLocations.map(({ location }) => (
          <View key={location.id} style={styles.locationBlock}>
            <TouchableOpacity style={styles.locationBlockHeader} onPress={() => toggleLocation(location.id)}>
              <Text style={styles.listRowText} numberOfLines={1}>{location.name}</Text>
              <Text style={styles.chevron}>{expandedLocationId === location.id ? '︿' : '›'}</Text>
            </TouchableOpacity>
            {expandedLocationId === location.id && (
              <View style={styles.locationItemsBox}>
                {loadingLocation === location.id ? (
                  <Text style={styles.hint}>Φόρτωση...</Text>
                ) : (locationItems[location.id]?.length || 0) === 0 ? (
                  <Text style={styles.hint}>Κανένα αντικείμενο εδώ ακόμα.</Text>
                ) : (
                  locationItems[location.id].map((it, idx) => (
                    <View key={idx} style={styles.itemLineRow}>
                      <Text style={styles.itemLineText} numberOfLines={1}>{it.name}</Text>
                      <Text style={styles.itemLineQty}>{it.quantity}</Text>
                    </View>
                  ))
                )}
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      <TouchableOpacity style={styles.deleteButton} onPress={confirmDelete}>
        <Text style={styles.deleteButtonText}>Διαγραφή Εκδήλωσης</Text>
      </TouchableOpacity>
    </Screen>
  );
}

function RegisterUserScreen({ onBack }: { onBack: () => void }) {
  const { colors, spacing, typography } = useTheme();
  const styles = makeStyles(colors, spacing);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'WORKER' | 'MANAGER' | 'ADMIN'>('WORKER');
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate() {
    if (!name.trim() || !phone.trim() || !password.trim()) { Alert.alert('Λείπουν στοιχεία', 'Συμπλήρωσε όνομα, τηλέφωνο και κωδικό.'); return; }
    setSubmitting(true);
    try {
      await api.createUser({ name: name.trim(), phone: phone.trim(), password, role });
      Alert.alert('Δημιουργήθηκε', `Ο χρήστης "${name}" δημιουργήθηκε.`);
      onBack();
    } catch (err: any) {
      Alert.alert('Αποτυχία', err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen noPadding>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={onBack} style={styles.backRow}><Text style={styles.backText}>‹ Διαχείριση</Text></TouchableOpacity>
          <Text style={[typography.title, { marginBottom: spacing.lg }]}>Νέος Χρήστης</Text>
          <Text style={typography.label}>Όνομα</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor={colors.muted} />
          <Text style={[typography.label, { marginTop: spacing.lg }]}>Τηλέφωνο</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholderTextColor={colors.muted} />
          <Text style={[typography.label, { marginTop: spacing.lg }]}>Κωδικός</Text>
          <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry placeholderTextColor={colors.muted} />
          <Text style={[typography.label, { marginTop: spacing.lg }]}>Ρόλος</Text>
          <View style={styles.typeRow}>
            {(['WORKER', 'MANAGER', 'ADMIN'] as const).map((r) => (
              <TouchableOpacity key={r} style={[styles.typeButton, role === r && styles.typeButtonActive]} onPress={() => setRole(r)}>
                <Text style={[styles.typeButtonText, role === r && styles.typeButtonTextActive]}>{ROLE_LABELS[r]}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={[styles.button, submitting && styles.buttonDisabled]} onPress={handleCreate} disabled={submitting}>
            <Text style={styles.buttonText}>{submitting ? 'Δημιουργία...' : 'Δημιουργία Χρήστη'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function MembersScreen({ onBack, onSelect }: { onBack: () => void; onSelect: (m: Member) => void }) {
  const { colors, spacing, typography } = useTheme();
  const styles = makeStyles(colors, spacing);
  const [members, setMembers] = useState<Member[]>([]);

  useFocusEffect(useCallback(() => {
    api.getUsers().then((users: Member[]) => setMembers([...users].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.name.localeCompare(b.name)))).catch(() => {});
  }, []));

  return (
    <Screen>
      <TouchableOpacity onPress={onBack} style={styles.backRow}><Text style={styles.backText}>‹ Διαχείριση</Text></TouchableOpacity>
      <Text style={[typography.title, { marginBottom: spacing.lg }]}>Μέλη</Text>
      <ScrollView>
        {members.map((m) => (
          <TouchableOpacity key={m.id} style={styles.listRow} onPress={() => onSelect(m)}>
            <View style={{ flex: 1, minWidth: 0, marginRight: spacing.sm }}>
              <Text style={styles.listRowText} numberOfLines={1}>{m.name}</Text>
              <Text style={styles.hint}>{ROLE_LABELS[m.role]}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </Screen>
  );
}

function MemberDetailScreen({ member, onBack }: { member: Member; onBack: () => void }) {
  const { colors, spacing, typography } = useTheme();
  const styles = makeStyles(colors, spacing);
  const { user: currentUser } = useAuth();
  const [role, setRole] = useState(member.role);
  const isSelf = currentUser?.id === member.id;

  async function changeRole(newRole: string) {
    try {
      await api.updateUserRole(member.id, newRole);
      setRole(newRole);
    } catch (err: any) {
      Alert.alert('Αποτυχία', err.message);
    }
  }

  function confirmDelete() {
    Alert.alert('Διαγραφή μέλους', `Να διαγραφεί ο/η "${member.name}";`, [
      { text: 'Ακύρωση', style: 'cancel' },
      { text: 'Διαγραφή', style: 'destructive', onPress: async () => {
        try {
          await api.deleteUser(member.id);
          onBack();
        } catch (err: any) {
          Alert.alert('Αποτυχία', err.message);
        }
      }},
    ]);
  }

  return (
    <Screen>
      <TouchableOpacity onPress={onBack} style={styles.backRow}><Text style={styles.backText}>‹ Μέλη</Text></TouchableOpacity>
      <Text style={[typography.title, { marginBottom: spacing.sm }]} numberOfLines={1}>{member.name}</Text>
      {member.phone && <Text style={typography.bodyMuted}>{member.phone}</Text>}
      {member.email && <Text style={typography.bodyMuted}>{member.email}</Text>}

      <Text style={[typography.label, { marginTop: spacing.xl }]}>Ρόλος</Text>
      <View style={styles.typeRow}>
        {(['WORKER', 'MANAGER', 'ADMIN'] as const).map((r) => (
          <TouchableOpacity key={r} style={[styles.typeButton, role === r && styles.typeButtonActive, isSelf && styles.typeButtonDisabled]} onPress={() => !isSelf && changeRole(r)} disabled={isSelf}>
            <Text style={[styles.typeButtonText, role === r && styles.typeButtonTextActive]}>{ROLE_LABELS[r]}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {isSelf && <Text style={styles.hint}>Δεν μπορείς να αλλάξεις τον δικό σου ρόλο.</Text>}

      <TouchableOpacity style={[styles.deleteButton, isSelf && styles.buttonDisabled]} onPress={confirmDelete} disabled={isSelf}>
        <Text style={styles.deleteButtonText}>Διαγραφή Χρήστη</Text>
      </TouchableOpacity>
      {isSelf && <Text style={styles.hint}>Δεν μπορείς να διαγράψεις τον εαυτό σου.</Text>}
    </Screen>
  );
}

function makeStyles(colors: any, spacing: any) {
  return StyleSheet.create({
    flex: { flex: 1 },
    container: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: 48 },
    backRow: { marginBottom: spacing.md },
    backText: { fontSize: 14, color: colors.petrol, fontWeight: '600' },
    input: { borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 10, paddingVertical: 13, paddingHorizontal: spacing.lg, fontSize: 15, color: colors.ink, backgroundColor: colors.card, marginTop: spacing.sm },
    row2: { flexDirection: 'row', gap: spacing.md },
    typeRow: { gap: spacing.sm, marginTop: spacing.sm },
    typeButton: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.lineStrong },
    typeButtonActive: { backgroundColor: colors.ink, borderColor: colors.ink },
    typeButtonDisabled: { opacity: 0.4 },
    typeButtonText: { fontSize: 14, color: colors.ink, fontWeight: '600' },
    typeButtonTextActive: { color: colors.paper },
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
    chip: { paddingVertical: 8, paddingHorizontal: spacing.md, borderRadius: 999, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.lineStrong, maxWidth: '100%' },
    chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
    chipText: { fontSize: 13, fontWeight: '600', color: colors.ink2 },
    chipTextActive: { color: colors.paper },
    hint: { fontSize: 12, color: colors.muted, marginTop: spacing.sm },
    menuRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card, borderRadius: 10, borderWidth: 1, borderColor: colors.line, padding: spacing.lg, marginBottom: spacing.sm },
    menuText: { fontSize: 16, fontWeight: '600', color: colors.ink },
    chevron: { fontSize: 22, color: colors.muted, flexShrink: 0 },
    listRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card, borderRadius: 10, borderWidth: 1, borderColor: colors.line, padding: spacing.lg, marginBottom: spacing.sm },
    listRowText: { fontSize: 15, fontWeight: '600', color: colors.ink },
    deleteText: { color: colors.rust, fontWeight: '700', fontSize: 13, flexShrink: 0 },
    eventRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card, borderRadius: 10, borderWidth: 1, borderColor: colors.line, padding: spacing.lg, marginBottom: spacing.sm },
    statusPill: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, flexShrink: 0 },
    statusPillText: { fontSize: 11, fontWeight: '700' },
    locationBlock: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, backgroundColor: colors.card, marginBottom: spacing.sm, overflow: 'hidden' },
    locationBlockHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg },
    locationItemsBox: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderTopWidth: 1, borderTopColor: colors.paper },
    itemLineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
    itemLineText: { fontSize: 13, color: colors.ink, flex: 1, minWidth: 0, marginRight: spacing.sm },
    itemLineQty: { fontSize: 13, fontWeight: '700', color: colors.ink, flexShrink: 0 },
    deleteButton: { borderWidth: 1, borderColor: colors.rust, borderRadius: 10, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.xl },
    deleteButtonText: { color: colors.rust, fontWeight: '700', fontSize: 15 },
    button: { backgroundColor: colors.ink, paddingVertical: spacing.lg, borderRadius: 14, marginTop: spacing.xxl },
    buttonDisabled: { opacity: 0.5 },
    buttonText: { color: colors.paper, textAlign: 'center', fontWeight: '700', fontSize: 16 },
  });
}