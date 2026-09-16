import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { api } from '../api/client';

export default function EventsScreen() {
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    api.getEvents().then(setEvents).catch(() => {});
  }, []);

  return (
    <View style={styles.container}>
      <FlatList
        data={events}
        keyExtractor={(e) => e.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.date}>
              {new Date(item.startDate).toLocaleDateString()} — {item.status}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  card: { padding: 14, borderRadius: 10, backgroundColor: '#f7f7f7', marginBottom: 10 },
  name: { fontWeight: '700', fontSize: 16 },
  date: { color: '#555', marginTop: 4 },
});
