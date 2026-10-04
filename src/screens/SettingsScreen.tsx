import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { api } from '../api/client';
import Screen from '../components/Screen';

const ROLE_LABELS: Record<string, string> = { ADMIN: 'Διαχειριστής', MANAGER: 'Υπεύθυνος', WORKER: 'Εργαζόμενος' };

export default function SettingsScreen() {
  const { user, logout, updateUser } = useAuth();
  const { colors, spacing, radius, typography, mode, toggle } = useTheme();
  const [uploading, setUploading] = useState(false);
  const styles = makeStyles(colors, spacing, radius);

  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Άδεια', 'Χρειάζεται πρόσβαση στις φωτογραφίες.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.4,
      base64: true,
    });
    if (result.canceled || !result.assets?.[0]?.base64) return;
    setUploading(true);
    try {
      const dataUri = `data:image/jpeg;base64,${result.assets[0].base64}`;
      await api.updateMyPhoto(dataUri);
      await updateUser({ photoUrl: dataUri });
    } catch (err: any) {
      Alert.alert('Αποτυχία', err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Screen>
      <Text style={[typography.title, { marginBottom: spacing.lg }]}>Ρυθμίσεις</Text>

      <View style={styles.profileRow}>
        <TouchableOpacity onPress={pickPhoto} style={styles.avatarWrap}>
          {user?.photoUrl ? (
            <Image source={{ uri: user.photoUrl }} style={styles.avatarImg} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarFallbackText}>{user?.name?.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.avatarEditBadge}>
            <Text style={styles.avatarEditText}>✎</Text>
          </View>
        </TouchableOpacity>
        <View>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.role}>{ROLE_LABELS[user?.role || ''] || user?.role}</Text>
        </View>
      </View>
      {uploading && <Text style={styles.uploadingText}>Μεταφόρτωση...</Text>}

      <View style={styles.section}>
        <Text style={[typography.label, { marginBottom: spacing.sm }]}>Εμφάνιση</Text>
        <TouchableOpacity style={styles.row} onPress={toggle}>
          <Text style={styles.rowLabel}>Σκοτεινό θέμα</Text>
          <View style={[styles.switchTrack, mode === 'dark' && styles.switchTrackActive]}>
            <View style={[styles.switchThumb, mode === 'dark' && styles.switchThumbActive]} />
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={[typography.label, { marginBottom: spacing.sm }]}>Ειδοποιήσεις</Text>
        <View style={styles.row}>
          <Text style={styles.emptyText}>Έρχεται σύντομα.</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutText}>Αποσύνδεση</Text>
      </TouchableOpacity>
    </Screen>
  );
}

function makeStyles(colors: any, spacing: any, radius: any) {
  return StyleSheet.create({
    profileRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xl },
    avatarWrap: { marginRight: spacing.lg },
    avatarImg: { width: 72, height: 72, borderRadius: 36 },
    avatarFallback: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
    avatarFallbackText: { color: colors.paper, fontSize: 28, fontWeight: '700' },
    avatarEditBadge: { position: 'absolute', bottom: -2, right: -2, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.petrol, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.paper },
    avatarEditText: { color: '#fff', fontSize: 12 },
    name: { fontSize: 18, fontWeight: '700', color: colors.ink },
    role: { fontSize: 13, color: colors.ink2, marginTop: 2 },
    uploadingText: { fontSize: 12, color: colors.muted, marginBottom: spacing.md },
    section: { marginBottom: spacing.xl },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.lg },
    rowLabel: { fontSize: 15, color: colors.ink },
    emptyText: { fontSize: 13, color: colors.muted, fontStyle: 'italic' },
    switchTrack: { width: 44, height: 26, borderRadius: 13, backgroundColor: colors.lineStrong, padding: 2, justifyContent: 'center' },
    switchTrackActive: { backgroundColor: colors.ink },
    switchThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },
    switchThumbActive: { alignSelf: 'flex-end' },
    logoutButton: { borderWidth: 1, borderColor: colors.rust, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.lg },
    logoutText: { color: colors.rust, fontWeight: '700', fontSize: 15 },
  });
}
