import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightColors, darkColors, buildTypography, spacing, radius, fonts } from '../theme';

type Mode = 'light' | 'dark';

type ThemeContextType = {
  mode: Mode;
  colors: typeof lightColors;
  typography: ReturnType<typeof buildTypography>;
  spacing: typeof spacing;
  radius: typeof radius;
  fonts: typeof fonts;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<Mode>(systemScheme === 'dark' ? 'dark' : 'light');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('themeMode')
      .then((saved) => { if (saved === 'light' || saved === 'dark') setModeState(saved); })
      .finally(() => setLoaded(true));
  }, []);

  function toggle() {
    setModeState((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      AsyncStorage.setItem('themeMode', next).catch(() => {});
      return next;
    });
  }

  const colors = mode === 'dark' ? darkColors : lightColors;
  const typography = useMemo(() => buildTypography(colors), [mode]);

  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={{ mode, colors, typography, spacing, radius, fonts, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
