import React from 'react';
import { View, ViewStyle, useWindowDimensions, Platform, StatusBar } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { MAX_CONTENT_WIDTH } from '../theme';

const TOP_INSET = Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 47;

export default function Screen({ children, style, noPadding = false }: { children: React.ReactNode; style?: ViewStyle; noPadding?: boolean }) {
  const { colors, spacing } = useTheme();
  const { width } = useWindowDimensions();
  const isWide = width > MAX_CONTENT_WIDTH;

  return (
    <View style={[{ flex: 1, backgroundColor: colors.paper, paddingTop: TOP_INSET }, style]}>
      <View style={{ flex: 1, alignItems: 'center' }}>
        <View
          style={[
            { flex: 1, width: '100%' },
            !noPadding && { paddingHorizontal: spacing.xl, paddingTop: spacing.md },
            isWide && { maxWidth: MAX_CONTENT_WIDTH, width: MAX_CONTENT_WIDTH },
          ]}
        >
          {children}
        </View>
      </View>
    </View>
  );
}
