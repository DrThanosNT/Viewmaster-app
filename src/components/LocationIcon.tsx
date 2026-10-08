import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import AppIcon, { IconSpec, mci } from './AppIcon';

// The icon used for events everywhere (venues, and the event headings
// inside a location).
export const EVENT_ICON = mci('calendar-star');

// One look per kind of place: storages are warehouses, vehicles are
// trucks, and everything else ("Άλλο" - the venues events happen at) gets
// the event icon.
export function locationVisual(type: string, colors: any): { icon: IconSpec; color: string; soft: string } {
  if (type === 'STORAGE') return { icon: mci('warehouse'), color: colors.petrol, soft: colors.petrolSoft };
  if (type === 'VEHICLE') return { icon: mci('truck'), color: colors.moss, soft: colors.mossSoft };
  return { icon: EVENT_ICON, color: colors.plum, soft: colors.plumSoft };
}

export default function LocationIcon({ type, size = 40 }: { type: string; size?: number }) {
  const { colors } = useTheme();
  const v = locationVisual(type, colors);
  return (
    <View style={{ width: size, height: size, borderRadius: Math.round(size * 0.3), backgroundColor: v.soft, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <AppIcon icon={v.icon} size={Math.round(size * 0.56)} color={v.color} />
    </View>
  );
}
