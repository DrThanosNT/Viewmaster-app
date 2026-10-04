export type Mover = { id: string; name: string; role?: string; photoUrl?: string | null };

export type DestinationGroup = {
  location: { id: string; name: string };
  event?: { name: string } | null;
  isDamage?: boolean;
  isRepair?: boolean;
  isTemporary?: boolean;
  items: { name: string; quantity: number; fromLocation: { name: string } | null }[];
};

export type LogEntry = {
  id: string;
  movedBy: Mover | null;
  createdAt: string;
  note: string | null;
  destinations: DestinationGroup[];
};

export const ROLE_LABELS: Record<string, string> = { ADMIN: 'Διαχειριστής', MANAGER: 'Υπεύθυνος', WORKER: 'Εργαζόμενος' };

export function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });
}

export function formatFullDate(iso: string) {
  const d = new Date(iso);
  const date = capitalize(d.toLocaleDateString('el-GR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
  return `${date} · ${formatTime(iso)}`;
}

// Visual identity for one destination block: the symbol/colors for its
// badge, a short label for list cards, and the "kind" caption (Προς /
// Ζημιά / Επισκευή) used on the detail page.
export function badgeFor(dest: DestinationGroup, colors: any) {
  if (dest.isDamage) {
    return { symbol: '!', color: colors.rust, soft: colors.rustSoft, kindLabel: 'Ζημιά', listLabel: `Ζημιά — ${dest.location.name}` };
  }
  if (dest.isRepair) {
    return { symbol: '✓', color: colors.moss, soft: colors.mossSoft, kindLabel: 'Επισκευή', listLabel: `Επισκευή — ${dest.location.name}` };
  }
  return { symbol: '→', color: colors.petrol, soft: colors.petrolSoft, kindLabel: 'Προς', listLabel: dest.location.name };
}
