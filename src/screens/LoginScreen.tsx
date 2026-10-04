import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import Screen from '../components/Screen';

export default function LoginScreen() {
  const { login } = useAuth();
  const { colors, spacing, radius } = useTheme();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const styles = makeStyles(colors, spacing, radius);

  async function handleLogin() {
    if (!phone || !password) {
      Alert.alert('Λείπουν στοιχεία', 'Συμπλήρωσε τηλέφωνο και κωδικό.');
      return;
    }
    setSubmitting(true);
    try {
      await login(phone, password);
    } catch (err: any) {
      Alert.alert('Αποτυχία σύνδεσης', err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen noPadding>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Viewmaster Events</Text>

          <Text style={styles.label}>Τηλέφωνο</Text>
          <TextInput style={styles.input} placeholder="π.χ. 6900000000" placeholderTextColor={colors.muted} keyboardType="phone-pad" value={phone} onChangeText={setPhone} autoCapitalize="none" />

          <Text style={styles.label}>Κωδικός</Text>
          <TextInput style={styles.input} placeholder="Ο κωδικός σου" placeholderTextColor={colors.muted} secureTextEntry value={password} onChangeText={setPassword} autoCapitalize="none" textContentType="password" />

          <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={submitting}>
            <Text style={styles.buttonText}>{submitting ? 'Σύνδεση...' : 'Σύνδεση'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function makeStyles(colors: any, spacing: any, radius: any) {
  return StyleSheet.create({
    flex: { flex: 1 },
    scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.xxl },
    title: { fontSize: 26, fontWeight: '700', marginBottom: spacing.xxl, textAlign: 'center', color: colors.ink },
    label: { fontSize: 13, fontWeight: '600', color: colors.ink2, marginBottom: spacing.sm, marginTop: spacing.sm },
    input: { borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radius.md, padding: 14, marginBottom: spacing.md, fontSize: 16, color: colors.ink, backgroundColor: colors.card },
    button: { backgroundColor: colors.ink, padding: spacing.lg, borderRadius: radius.lg, marginTop: spacing.sm },
    buttonText: { color: '#fff', textAlign: 'center', fontWeight: '600', fontSize: 16 },
  });
}
