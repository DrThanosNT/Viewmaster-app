import React from 'react';
import { View } from 'react-native';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';

function ThemedRoot() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <RootNavigator />
    </View>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ThemedRoot />
      </AuthProvider>
    </ThemeProvider>
  );
}