import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { api } from '../api/client';
import { useTheme } from '../context/ThemeContext';
import LocationsScreen from './LocationsScreen';
import Screen from '../components/Screen';
import PressableCard from '../components/PressableCard';
import AppIcon, { ion } from '../components/AppIcon';
import { LogEntry, badgeFor } from '../utils/logHelpers';
import { dueInfo, formatDue, compareDue } from '../utils/dateTime';
import useTick from '../utils/useTick';

const TEMP_PREVIEW = 3;

type TemporaryRow = { id: string; temporaryQuantity: number; expectedReturnAt?: string | null; item: { name: string }; location: { name: string }; event?: { name: string } | null; updatedAt: string };

function daysAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return 'σήμερα';
  if (days === 1) return '1 μέρα';
  return `${days} μέρες`;
}

function shortSummary(log: LogEntry) {
  const dest = log.destinations[0];
  if (!dest) return '';
  const itemCount = log.destinations.reduce((sum, d) => sum + d.items.length, 0);
  const what = itemCount === 1 ? dest.items[0]?.name : `${itemCount} αντικείμενα`;
  const where = dest.isDamage ? 'σήμανση ζημιάς' : dest.isRepair ? 'επισκευή' : `→ ${dest.location.name}`;
  return `${what} · ${where}`;
}

export default function OverviewScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const styles = makeStyles(colors, spacing, radius);
  const navigation = useNavigation<any>();
  // Re-renders while the screen is open so an item turns red the moment it is late.
  useTick();

  const [view, setView] = useState<'dashboard' | 'allItems'>('dashboard');
  const [allItemsStart, setAllItemsStart] = useState<'damaged' | 'temporary' | undefined>(undefined);
  const [temporary, setTemporary] = useState<TemporaryRow[]>([]);
  const [recentLogs, setRecentLogs] = useState<LogEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    api.getTemporaryStock().then(setTemporary).catch(() => {});
    api.getLogs(5).then(setRecentLogs).catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => { if (view === 'dashboard') load(); }, [view, load]));

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([
      api.getTemporaryStock().then(setTemporary).catch(() => {}),
      api.getLogs(5).then(setRecentLogs).catch(() => {}),
    ]);
    setRefreshing(false);
  }

  if (view === 'allItems') {
    return <LocationsScreen initialList={allItemsStart} onBack={() => { setView('dashboard'); setAllItemsStart(undefined); }} />;
  }

  // Late ones first (their deadlines are the earliest), undated ones last.
  const sortedTemporary = [...temporary].sort((a, b) => compareDue(a.expectedReturnAt, b.expectedReturnAt));
  const lateCount = temporary.filter((r) => r.expectedReturnAt && dueInfo(r.expectedReturnAt).overdue).length;
  const accent = lateCount > 0 ? colors.rust : colors.amber;

  const temporaryInner = (
    <>
      <View style={styles.cardHeader}>
        <View style={[styles.dot, { backgroundColor: accent }]} />
        <Text style={[typography.sectionTitle, { flex: 1 }]}>Προσωρινά σε εκκρεμότητα</Text>
        {temporary.length > 0 && <Text style={styles.chevronSmall}>›</Text>}
      </View>
      {lateCount > 0 && (
        <View style={styles.lateBanner}>
          <AppIcon icon={ion('alert-circle')} size={17} color={colors.rust} />
          <Text style={styles.lateBannerText}>
            {lateCount === 1 ? '1 είδος ξεπέρασε την προθεσμία επιστροφής' : `${lateCount} είδη ξεπέρασαν την προθεσμία επιστροφής`}
          </Text>
        </View>
      )}
      {temporary.length === 0 ? (
        <Text style={styles.emptyText}>Τίποτα προσωρινό αυτή τη στιγμή.</Text>
      ) : (
        <>
          {sortedTemporary.slice(0, TEMP_PREVIEW).map((r) => {
            const due = r.expectedReturnAt ? dueInfo(r.expectedReturnAt) : null;
            const late = !!due && due.overdue;
            return (
              <View key={r.id} style={[styles.row, late && styles.rowLate]}>
                <View style={styles.rowTextCol}>
                  <Text style={[typography.body, late && { color: colors.rust, fontWeight: '700' }]} numberOfLines={1}>{r.item.name}</Text>
                  <Text style={typography.caption} numberOfLines={1}>
                    {r.location.name}{r.event ? ` (${r.event.name})` : ''}
                    {!due ? ` · ${daysAgo(r.updatedAt)}` : !late ? ` · έως ${formatDue(r.expectedReturnAt!)}` : ''}
                  </Text>
                  {late && due ? (
                    <View style={styles.lateLine}>
                      <AppIcon icon={ion('alert-circle')} size={13} color={colors.rust} />
                      <Text style={styles.lateText} numberOfLines={1}>{due.phrase}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={[styles.warningNumber, late && { color: colors.rust }]}>{r.temporaryQuantity}</Text>
              </View>
            );
          })}
          {temporary.length > TEMP_PREVIEW && <Text style={styles.moreText}>+{temporary.length - TEMP_PREVIEW} ακόμα</Text>}
        </>
      )}
    </>
  );

  return (
    <Screen noPadding>
      <ScrollView contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <Text style={[typography.title, { marginBottom: spacing.lg }]}>Επισκόπηση</Text>

        {temporary.length > 0 ? (
          <PressableCard
            style={[styles.card, { borderLeftWidth: 3, borderLeftColor: accent }]}
            onPress={() => { setAllItemsStart('temporary'); setView('allItems'); }}
          >
            {temporaryInner}
          </PressableCard>
        ) : (
          <View style={styles.card}>{temporaryInner}</View>
        )}

        <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: colors.petrol }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.dot, { backgroundColor: colors.petrol }]} />
            <Text style={typography.sectionTitle}>Πρόσφατη δραστηριότητα</Text>
          </View>
          {recentLogs.length === 0 ? (
            <Text style={styles.emptyText}>Καμία πρόσφατη δραστηριότητα.</Text>
          ) : (
            recentLogs.map((log) => {
              const dest = log.destinations[0];
              const badge = dest ? badgeFor(dest, colors) : null;
              return (
                <PressableCard key={log.id} style={styles.activityRow} onPress={() => navigation.navigate('Καταγραφές', { openLog: log })}>
                  {badge && (
                    <View style={[styles.miniBadge, { backgroundColor: badge.soft, borderColor: badge.color }]}>
                      <AppIcon icon={badge.icon} size={17} color={badge.color} />
                    </View>
                  )}
                  <View style={styles.rowTextCol}>
                    <Text style={typography.body} numberOfLines={2}>
                      <Text style={{ fontWeight: '700' }}>{log.movedBy?.name || 'Άγνωστος'}</Text> {shortSummary(log)}
                    </Text>
                  </View>
                  <Text style={typography.caption}>{daysAgo(log.createdAt)}</Text>
                </PressableCard>
              );
            })
          )}
        </View>

        <TouchableOpacity style={styles.browseButton} onPress={() => { setAllItemsStart(undefined); setView('allItems'); }}>
          <Text style={styles.browseButtonText}>Δες όλα τα αντικείμενα</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </ScrollView>
    </Screen>
  );
}

function makeStyles(colors: any, spacing: any, radius: any) {
  return StyleSheet.create({
    container: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: 48 },
    card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: spacing.lg, marginBottom: spacing.lg },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
    dot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.sm },
    chevronSmall: { fontSize: 20, color: colors.muted, marginLeft: spacing.sm },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.paper },
    rowTextCol: { flex: 1, minWidth: 0, marginRight: spacing.sm },
    activityRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radius.sm, marginTop: 2 },
    miniBadge: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm, flexShrink: 0 },
    rowLate: { backgroundColor: colors.rustSoft, borderRadius: radius.sm, paddingHorizontal: spacing.sm, marginTop: 2 },
    lateLine: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
    lateText: { fontSize: 12, fontWeight: '700', color: colors.rust, marginLeft: 4, flexShrink: 1 },
    lateBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.rustSoft, borderRadius: radius.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
    lateBannerText: { fontSize: 13, fontWeight: '700', color: colors.rust, marginLeft: spacing.sm, flex: 1, minWidth: 0 },
    moreText: { fontSize: 12, color: colors.muted, fontWeight: '600', marginTop: spacing.xs },
    emptyText: { fontSize: 13, color: colors.muted, fontStyle: 'italic' },
    warningNumber: { fontFamily: 'monospace', fontSize: 15, color: colors.amber, fontWeight: '700', flexShrink: 0 },
    browseButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.ink, borderRadius: radius.lg, paddingVertical: spacing.lg, paddingHorizontal: spacing.lg, marginTop: spacing.sm },
    browseButtonText: { color: colors.paper, fontWeight: '700', fontSize: 15 },
    chevron: { color: colors.paper, fontSize: 20 },
  });
}
