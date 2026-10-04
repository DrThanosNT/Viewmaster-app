import React from 'react';
import { Pressable, StyleSheet, View, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../context/ThemeContext';

// A tappable surface that darkens slightly while pressed. The overlay is a
// translucent dark layer rather than a fixed color, so the effect works the
// same on a white card in light mode and a dark card in dark mode.
export default function PressableCard({
  children,
  onPress,
  style,
  disabled = false,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const borderRadius = (StyleSheet.flatten(style) as ViewStyle | undefined)?.borderRadius ?? 0;

  return (
    <Pressable onPress={onPress} disabled={disabled} style={style}>
      {({ pressed }) => (
        <>
          {children}
          {pressed && !disabled ? (
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.pressOverlay, borderRadius }]} />
          ) : null}
        </>
      )}
    </Pressable>
  );
}
