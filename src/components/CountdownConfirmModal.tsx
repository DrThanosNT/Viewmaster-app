import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import AppIcon, { IconSpec, ion } from './AppIcon';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  seconds?: number;
  busy?: boolean;
  icon?: IconSpec;
  onConfirm: () => void;
  onCancel: () => void;
};

// A confirmation that can't be tapped by accident: the confirm button stays
// locked while a visible countdown runs, and unlocks only when it reaches 0.
// Cancel is always available. The countdown restarts every time it opens.
export default function CountdownConfirmModal({
  visible, title, message, confirmLabel, cancelLabel = 'Ακύρωση', seconds = 5, busy = false, icon, onConfirm, onCancel,
}: Props) {
  const { colors, spacing, radius } = useTheme();
  const [left, setLeft] = useState(seconds);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    setLeft(seconds);
    progress.setValue(0);
    const bar = Animated.timing(progress, { toValue: 1, duration: seconds * 1000, easing: Easing.linear, useNativeDriver: false });
    bar.start();
    const startedAt = Date.now();
    // Measured against the clock (not by counting ticks), so it stays right
    // even if the app was briefly in the background.
    const timer = setInterval(() => {
      const remaining = Math.max(Math.ceil(seconds - (Date.now() - startedAt) / 1000), 0);
      setLeft(remaining);
      if (remaining === 0) clearInterval(timer);
    }, 100);
    return () => { clearInterval(timer); bar.stop(); };
  }, [visible, seconds]);

  const ready = left === 0 && !busy;
  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <View style={[styles.backdrop, { padding: spacing.xl }]}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.xl }]}>
          <View style={styles.headerRow}>
            <View style={[styles.iconTile, { backgroundColor: colors.amberSoft, borderRadius: radius.md }]}>
              <AppIcon icon={icon ?? ion('warning')} size={22} color={colors.amber} />
            </View>
            <Text style={[styles.title, { color: colors.ink }]} numberOfLines={2}>{title}</Text>
          </View>

          <Text style={[styles.message, { color: colors.ink2 }]}>{message}</Text>

          <View style={[styles.timerBox, { backgroundColor: colors.paper, borderRadius: radius.md, borderColor: colors.line }]}>
            <View style={styles.timerRow}>
              <AppIcon icon={ion('time-outline')} size={18} color={left === 0 ? colors.moss : colors.amber} />
              <Text style={[styles.timerText, { color: left === 0 ? colors.moss : colors.ink2 }]}>
                {left === 0 ? 'Μπορείς να επιβεβαιώσεις' : `Η επιβεβαίωση ενεργοποιείται σε ${left} δευτ.`}
              </Text>
              <Text style={[styles.timerNumber, { color: left === 0 ? colors.moss : colors.amber }]}>{left}</Text>
            </View>
            <View style={[styles.track, { backgroundColor: colors.line }]}>
              <Animated.View style={[styles.fill, { width, backgroundColor: left === 0 ? colors.moss : colors.amber }]} />
            </View>
          </View>

          <View style={styles.buttons}>
            <TouchableOpacity
              onPress={onCancel}
              disabled={busy}
              style={[styles.button, { borderColor: colors.lineStrong, borderWidth: 1, borderRadius: radius.md, backgroundColor: colors.card }]}
            >
              <Text style={[styles.buttonText, { color: colors.ink }]}>{cancelLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onConfirm}
              disabled={!ready}
              style={[styles.button, { borderRadius: radius.md, backgroundColor: ready ? colors.ink : colors.lineStrong }]}
            >
              <Text style={[styles.buttonText, { color: ready ? colors.paper : colors.muted }]} numberOfLines={1}>
                {busy ? 'Αποθήκευση...' : left > 0 ? `${confirmLabel} (${left})` : confirmLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  card: { width: '100%', maxWidth: 420, borderWidth: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  iconTile: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginRight: 12, flexShrink: 0 },
  title: { fontSize: 18, fontWeight: '700', flex: 1, minWidth: 0 },
  message: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  timerBox: { borderWidth: 1, padding: 12, marginBottom: 18 },
  timerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  timerText: { flex: 1, minWidth: 0, fontSize: 13, fontWeight: '600', marginLeft: 8, marginRight: 8 },
  timerNumber: { fontSize: 22, fontWeight: '800', minWidth: 22, textAlign: 'right' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  buttons: { flexDirection: 'row', gap: 10 },
  button: { flex: 1, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 15, fontWeight: '700' },
});
