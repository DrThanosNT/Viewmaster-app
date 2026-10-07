import React from 'react';
import { View, Text, TextInput, TextInputProps, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../context/ThemeContext';

type Props = Omit<TextInputProps, 'placeholder' | 'style' | 'multiline' | 'placeholderTextColor'> & {
  placeholder: string;
  containerStyle?: StyleProp<ViewStyle>;
};

// A single-line input whose placeholder always fits on ONE line: it is drawn
// as a Text that shrinks to fit (down to 60%) instead of wrapping or running
// past the edge of the box the way a native placeholder can.
export default function FitInput({ placeholder, containerStyle, value, ...rest }: Props) {
  const { colors, spacing, radius } = useTheme();

  return (
    <View
      style={[
        {
          minHeight: 50,
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: colors.lineStrong,
          borderRadius: radius.md,
          backgroundColor: colors.card,
          paddingHorizontal: spacing.lg,
        },
        containerStyle,
      ]}
    >
      {!value ? (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: spacing.lg, right: spacing.lg, top: 0, bottom: 0, justifyContent: 'center' }}
        >
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ fontSize: 15, color: colors.muted }}>
            {placeholder}
          </Text>
        </View>
      ) : null}
      <TextInput
        {...rest}
        value={value}
        multiline={false}
        accessibilityLabel={rest.accessibilityLabel ?? placeholder}
        style={{ fontSize: 15, color: colors.ink, padding: 0, paddingVertical: 12 }}
      />
    </View>
  );
}
