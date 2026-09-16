import React, { useState } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet } from 'react-native';
import { api } from '../api/client';

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);

  async function handleSearch(text: string) {
    setQuery(text);
    if (text.length < 2) {
      setResults([]);
      return;
    }
    const items = await api.searchItems(text);
    setResults(items);
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Search an item..."
        value={query}
        onChangeText={handleSearch}
      />
      <FlatList
        data={results}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.itemName}>{item.name}</Text>
            {item.stock?.length ? (
              item.stock.map((s: any) => (
                <Text key={s.id} style={styles.locationLine}>
                  {s.quantity} at {s.location.name}
                </Text>
              ))
            ) : (
              <Text style={styles.locationLine}>No stock recorded yet</Text>
            )}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, marginBottom: 12 },
  card: { padding: 14, borderRadius: 10, backgroundColor: '#f7f7f7', marginBottom: 10 },
  itemName: { fontWeight: '700', fontSize: 16, marginBottom: 4 },
  locationLine: { color: '#555' },
});
