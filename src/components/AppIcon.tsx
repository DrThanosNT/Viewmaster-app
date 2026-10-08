import React from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

type IonName = React.ComponentProps<typeof Ionicons>['name'];
type McName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

// An icon from either set. Ionicons has no truck or warehouse, so those
// come from MaterialCommunityIcons; everything else uses Ionicons.
export type IconSpec = { set: 'ion'; name: IonName } | { set: 'mci'; name: McName };

export const ion = (name: IonName): IconSpec => ({ set: 'ion', name });
export const mci = (name: McName): IconSpec => ({ set: 'mci', name });

export default function AppIcon({ icon, size = 20, color }: { icon: IconSpec; size?: number; color: string }) {
  return icon.set === 'ion'
    ? <Ionicons name={icon.name} size={size} color={color} />
    : <MaterialCommunityIcons name={icon.name} size={size} color={color} />;
}
