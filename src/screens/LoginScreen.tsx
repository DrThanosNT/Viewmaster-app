import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin() {
    if (!phone || !password) {
      Alert.alert('Missing info', 'Enter your phone and password.');
      return;
    }
    setSubmitting(true);
    try {
      await login(phone, password);
    } catch (err: any) {
      Alert.alert('Login failed', err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Viewmaster Events</Text>

      <Text style={styles.label}>Phone number</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 6900000000"
        placeholderTextColor="#999"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
        autoCapitalize="none"
      />

      <Text style={styles.label}>Password</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your password"
        placeholderTextColor="#999"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        autoCapitalize="none"
        textContentType="password"
      />

      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={submitting}>
        <Text style={styles.buttonText}>{submitting ? 'Logging in...' : 'Log In'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 26, fontWeight: '700', marginBottom: 32, textAlign: 'center', color: '#1a1a1a' },
  label: { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 6, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
    fontSize: 16,
    color: '#111',        // <- explicit text color fixes invisible input text
    backgroundColor: '#fff',
  },
  button: { backgroundColor: '#1a1a1a', padding: 16, borderRadius: 10, marginTop: 8 },
  buttonText: { color: '#fff', textAlign: 'center', fontWeight: '600', fontSize: 16 },
});