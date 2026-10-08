import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, SectionList, ScrollView, StyleSheet, RefreshControl, TextInput, Image, TouchableOpacity } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { api } from '../api/client';
import { useTheme } from '../context/ThemeContext';
import Screen from '../components/Screen';
import PressableCard from '../components/PressableCard';
import AppIcon from '../components/AppIcon';
import { LogEntry, ROLE_LABELS, badgeFor, capitalize, formatFullDate, formatTime } from '../utils/logHelpers';

// List cards are deliberately capped - anything beyond this is one tap
// away on the detail page.
const PREVIEW_DESTINATIONS = 2;
const PREVIEW_ITEMS = 3;

// Badge sizes. The icon fills most of the circle so the arrow reads at a
// glance; the item lines are indented by the badge width plus its gap.
const BADGE = 32;
const BADGE_ICON = 20;
const BADGE_LG = 42;
const BADGE_ICON_LG = 26;

function bucketLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (diffDays === 0) return 'Σήμερα';
  if (diffDays === 1) return 'Χθες';
  if (diffDays <= 7) return 'Τελευταίες 7 ημέρες';
  if (diffDays <= 30) return 'Τελευταίες 30 ημέρες';
  return capitalize(d.toLocaleDateString('el-GR', { month: 'long', year: 'numeric' }));
}

function Avatar({ name, photo, size, colors }: { name?: string | null; photo?: string | null; size: number; colors: any }) {
  if (photo) return <Image source={{ uri: photo }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.paper, fontSize: size * 0.42, fontWeight: '700' }}>{(name || '?').charAt(0).toUpperCase()}</Text>
    </View>
  );
}

export default function LogsScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const styles = makeStyles(colors, spacing, radius);
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [nameFilter, setNameFilter] = useState('');
  const [detailLog, setDetailLog] = useState<LogEntry | null>(null);

  const load = useCallback(() => { api.getLogs().then(setLogs).catch(() => {}); }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Επισκόπηση sends a whole log entry here when you tap a recent-activity
  // row. We open its detail page, then clear the param so going back (or
  // revisiting the tab) doesn't reopen it.
  useEffect(() => {
    const incoming = route.params?.openLog as LogEntry | undefined;
    if (incoming) {
      setDetailLog(incoming);
      navigation.setParams({ openLog: undefined });
    }
  }, [route.params?.openLog]);

  async function onRefresh() {
    setRefreshing(true);
    await api.getLogs().then(setLogs).catch(() => {});
    setRefreshing(false);
  }

  const avatarCache = useMemo(() => {
    const map = new Map<string, string | null | undefined>();
    logs.forEach((l) => { if (l.movedBy && !map.has(l.movedBy.id)) map.set(l.movedBy.id, l.movedBy.photoUrl); });
    return map;
  }, [logs]);

  const sections = useMemo(() => {
    const q = nameFilter.trim().toLowerCase();
    const filtered = logs.filter((l) => q.length === 0 || (l.movedBy?.name || '').toLowerCase().includes(q));
    const map = new Map<string, LogEntry[]>();
    filtered.forEach((l) => {
      const key = bucketLabel(l.createdAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(l);
    });
    return [...map.entries()].map(([title, data]) => ({ title, data }));
  }, [logs, nameFilter]);

  function photoFor(log: LogEntry) {
    if (!log.movedBy) return null;
    return log.movedBy.photoUrl ?? avatarCache.get(log.movedBy.id) ?? null;
  }

  if (detailLog) {
    return <LogDetail log={detailLog} photo={photoFor(detailLog)} onBack={() => setDetailLog(null)} />;
  }

  return (
    <Screen noPadding>
      <View style={styles.headerArea}>
        <Text style={[typography.title, { marginBottom: spacing.md }]}>Καταγραφές</Text>
        <TextInput style={styles.input} placeholder="Αναζήτηση με όνομα..." placeholderTextColor={colors.muted} value={nameFilter} onChangeText={setNameFilter} autoCapitalize="none" />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={styles.emptyText}>Δεν βρέθηκαν καταγραφές.</Text>}
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.stickyHeader}><Text style={styles.stickyHeaderText}>{title}</Text></View>
        )}
        renderItem={({ item }) => <LogCard log={item} photo={photoFor(item)} onPress={() => setDetailLog(item)} />}
      />
    </Screen>
  );
}

function LogCard({ log, photo, onPress }: { log: LogEntry; photo?: string | null; onPress: () => void }) {
  const { colors, spacing, radius, typography } = useTheme();
  const styles = makeStyles(colors, spacing, radius);
  const shownDests = log.destinations.slice(0, PREVIEW_DESTINATIONS);
  const hiddenDests = log.destinations.length - shownDests.length;

  return (
    <PressableCard style={styles.batchCard} onPress={onPress}>
      <View style={styles.batchHeader}>
        <View style={styles.moverRow}>
          <View style={{ marginRight: spacing.sm }}><Avatar name={log.movedBy?.name} photo={photo} size={28} colors={colors} /></View>
          <Text style={styles.moverName} numberOfLines={1}>{log.movedBy?.name || 'Άγνωστος'}</Text>
        </View>
        <Text style={typography.caption}>{formatTime(log.createdAt)}</Text>
        <Text style={styles.cardChevron}>›</Text>
      </View>

      {shownDests.map((dest, di) => {
        const badge = badgeFor(dest, colors);
        const shownItems = dest.items.slice(0, PREVIEW_ITEMS);
        const hiddenItems = dest.items.length - shownItems.length;
        return (
          <View key={`${dest.location.id}-${di}`} style={styles.destBox}>
            <View style={styles.destHeaderRow}>
              <View style={[styles.badge, { backgroundColor: badge.soft, borderColor: badge.color }]}>
                <AppIcon icon={badge.icon} size={BADGE_ICON} color={badge.color} />
              </View>
              <Text style={[styles.destTitle, { color: badge.color }]} numberOfLines={1}>
                {badge.listLabel}{dest.event ? ` (${dest.event.name})` : ''}{dest.isTemporary && !dest.isDamage ? ' · προσωρινά' : ''}
              </Text>
            </View>
            {shownItems.map((it, idx) => (
              <View key={idx} style={styles.itemLineRow}>
                <Text style={styles.itemLineQty}>{it.quantity}×</Text>
                <Text style={styles.itemLineName} numberOfLines={1}>{it.name}</Text>
              </View>
            ))}
            {hiddenItems > 0 && <Text style={styles.moreText}>+{hiddenItems} ακόμα</Text>}
          </View>
        );
      })}
      {hiddenDests > 0 && <Text style={styles.moreText}>+{hiddenDests} ακόμα {hiddenDests === 1 ? 'προορισμός' : 'προορισμοί'}</Text>}
      {log.note ? <Text style={styles.noteText} numberOfLines={1}>"{log.note}"</Text> : null}
    </PressableCard>
  );
}

function LogDetail({ log, photo, onBack }: { log: LogEntry; photo?: string | null; onBack: () => void }) {
  const { colors, spacing, radius, typography } = useTheme();
  const styles = makeStyles(colors, spacing, radius);
  const lineCount = log.destinations.reduce((s, d) => s + d.items.length, 0);
  const units = log.destinations.reduce((s, d) => s + d.items.reduce((a, it) => a + it.quantity, 0), 0);

  return (
    <Screen noPadding>
      <ScrollView contentContainerStyle={styles.detailContent}>
        <TouchableOpacity onPress={onBack} style={styles.backRow}><Text style={styles.backText}>‹ Καταγραφές</Text></TouchableOpacity>

        <View style={styles.detailHeader}>
          <Avatar name={log.movedBy?.name} photo={photo} size={46} colors={colors} />
          <View style={{ flex: 1, minWidth: 0, marginLeft: spacing.md }}>
            <Text style={styles.detailName} numberOfLines={1}>{log.movedBy?.name || 'Άγνωστος'}</Text>
            <Text style={typography.caption} numberOfLines={2}>
              {log.movedBy?.role ? `${ROLE_LABELS[log.movedBy.role] || log.movedBy.role} · ` : ''}{formatFullDate(log.createdAt)}
            </Text>
          </View>
        </View>

        <Text style={styles.summaryText}>{lineCount} {lineCount === 1 ? 'αντικείμενο' : 'αντικείμενα'} · {units} τεμ.</Text>

        {log.destinations.map((dest, di) => {
          const badge = badgeFor(dest, colors);
          return (
            <View key={`${dest.location.id}-${di}`} style={[styles.detailDest, { borderLeftColor: badge.color }]}>
              <View style={styles.detailDestHeader}>
                <View style={[styles.badgeLg, { backgroundColor: badge.soft, borderColor: badge.color }]}>
                  <AppIcon icon={badge.icon} size={BADGE_ICON_LG} color={badge.color} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.kindLabel}>{badge.kindLabel}</Text>
                  <Text style={styles.destName} numberOfLines={2}>{dest.location.name}</Text>
                  {dest.event ? <Text style={styles.eventLine} numberOfLines={1}>{dest.event.name}</Text> : null}
                </View>
                {dest.isTemporary && !dest.isDamage ? (
                  <View style={styles.tempPill}><Text style={styles.tempPillText}>προσωρινά</Text></View>
                ) : null}
              </View>

              {dest.items.map((it, idx) => (
                <View key={idx} style={styles.detailItemRow}>
                  <Text style={styles.detailItemQty}>{it.quantity}×</Text>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.detailItemName} numberOfLines={2}>{it.name}</Text>
                    {!dest.isDamage && !dest.isRepair ? (
                      <Text style={typography.caption} numberOfLines={1}>{it.fromLocation ? `από ${it.fromLocation.name}` : 'Εισαγωγή'}</Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          );
        })}

        {log.note ? (
          <View style={styles.noteBox}>
            <Text style={styles.noteLabel}>Σημείωση</Text>
            <Text style={styles.noteBody}>{log.note}</Text>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function makeStyles(colors: any, spacing: any, radius: any) {
  return StyleSheet.create({
    headerArea: { paddingHorizontal: spacing.xl, paddingTop: spacing.md },
    input: { borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: spacing.lg, fontSize: 15, color: colors.ink, backgroundColor: colors.card, marginBottom: spacing.sm },
    listContent: { paddingHorizontal: spacing.xl, paddingBottom: 48 },
    stickyHeader: { backgroundColor: colors.ink, paddingVertical: 8, paddingHorizontal: spacing.md, borderRadius: radius.sm, marginTop: spacing.md, marginBottom: spacing.sm, alignSelf: 'flex-start' },
    stickyHeaderText: { color: colors.paper, fontSize: 12, fontWeight: '700' },
    emptyText: { textAlign: 'center', color: colors.muted, marginTop: spacing.xxl },

    batchCard: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: spacing.lg, marginBottom: spacing.lg },
    batchHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
    moverRow: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0, marginRight: spacing.sm },
    moverName: { fontSize: 15, fontWeight: '700', color: colors.ink, flexShrink: 1 },
    cardChevron: { fontSize: 20, color: colors.muted, marginLeft: spacing.sm, flexShrink: 0 },
    destBox: { backgroundColor: colors.paper, borderRadius: radius.sm, padding: spacing.md, marginBottom: spacing.sm },
    destHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    badge: { width: BADGE, height: BADGE, borderRadius: BADGE / 2, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm, flexShrink: 0 },
    destTitle: { fontSize: 14, fontWeight: '700', flex: 1, minWidth: 0 },
    itemLineRow: { flexDirection: 'row', marginTop: 3, paddingLeft: BADGE + spacing.sm },
    itemLineQty: { fontFamily: 'monospace', fontSize: 12, color: colors.ink2, fontWeight: '600', marginRight: 6, minWidth: 28, flexShrink: 0 },
    itemLineName: { fontSize: 13, color: colors.ink, flex: 1, minWidth: 0 },
    moreText: { fontSize: 12, color: colors.muted, fontWeight: '600', marginTop: 4, paddingLeft: BADGE + spacing.sm },
    noteText: { fontSize: 12, color: colors.muted, fontStyle: 'italic', marginTop: spacing.xs },

    backRow: { marginBottom: spacing.md },
    backText: { fontSize: 14, color: colors.petrol, fontWeight: '600' },
    detailContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: 48 },
    detailHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
    detailName: { fontSize: 18, fontWeight: '700', color: colors.ink },
    summaryText: { fontSize: 13, color: colors.ink2, fontWeight: '600', marginBottom: spacing.lg },
    detailDest: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, borderLeftWidth: 3, padding: spacing.lg, marginBottom: spacing.lg },
    detailDestHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
    badgeLg: { width: BADGE_LG, height: BADGE_LG, borderRadius: BADGE_LG / 2, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md, flexShrink: 0 },
    kindLabel: { fontSize: 11, fontWeight: '600', color: colors.muted },
    destName: { fontSize: 16, fontWeight: '700', color: colors.ink },
    eventLine: { fontSize: 12, fontWeight: '600', color: colors.petrol, marginTop: 1 },
    tempPill: { backgroundColor: colors.amberSoft, borderRadius: radius.pill, paddingVertical: 3, paddingHorizontal: 9, marginLeft: spacing.sm, flexShrink: 0 },
    tempPillText: { fontSize: 11, fontWeight: '700', color: colors.amber },
    detailItemRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: spacing.sm + 2, borderTopWidth: 1, borderTopColor: colors.paper },
    detailItemQty: { fontFamily: 'monospace', fontSize: 14, fontWeight: '700', color: colors.ink, width: 44, flexShrink: 0 },
    detailItemName: { fontSize: 15, color: colors.ink },
    noteBox: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: spacing.lg },
    noteLabel: { fontSize: 11, fontWeight: '600', color: colors.muted, marginBottom: 4 },
    noteBody: { fontSize: 14, color: colors.ink, fontStyle: 'italic' },
  });
}
