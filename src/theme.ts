import { Platform } from 'react-native';

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 };
export const radius = { sm: 6, md: 10, lg: 14, pill: 999 };
export const fonts = { mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) };

const sharedAccents = { amber: '#E0932E', rust: '#C85A42', moss: '#5C8F63', petrol: '#3B98A1', plum: '#8B6BC2' };

export const lightColors = {
  ink: '#14161A', ink2: '#3A3D44', paper: '#F3F3F1', card: '#FFFFFF',
  line: '#E4E3DF', lineStrong: '#D3D2CC', muted: '#8B8D85',
  ...sharedAccents,
  amberSoft: '#FBEFDC', rustSoft: '#F7E7E3', mossSoft: '#E8F0E6', petrolSoft: '#E6F0F0', plumSoft: '#EEE9F7',
  pressOverlay: 'rgba(20,22,26,0.07)',
};

export const darkColors = {
  ink: '#F2F1EE', ink2: '#C9C7C0', paper: '#121314', card: '#1C1E20',
  line: '#2C2E30', lineStrong: '#3A3D40', muted: '#8B8D85',
  ...sharedAccents,
  amberSoft: '#3A2B14', rustSoft: '#3A1E18', mossSoft: '#1E2E20', petrolSoft: '#14282A', plumSoft: '#2A2140',
  pressOverlay: 'rgba(0,0,0,0.3)',
};

export function buildTypography(c: typeof lightColors) {
  return {
    title: { fontSize: 25, fontWeight: '700' as const, color: c.ink, letterSpacing: -0.3 },
    sectionTitle: { fontSize: 15, fontWeight: '700' as const, color: c.ink },
    label: { fontSize: 13, fontWeight: '600' as const, color: c.ink2 },
    body: { fontSize: 15, color: c.ink },
    bodyMuted: { fontSize: 13, color: c.ink2 },
    caption: { fontSize: 12, color: c.muted },
    mono: { fontFamily: fonts.mono, fontSize: 15, color: c.ink, fontWeight: '700' as const },
    monoLg: { fontFamily: fonts.mono, fontSize: 19, color: c.ink, fontWeight: '700' as const },
    monoSm: { fontFamily: fonts.mono, fontSize: 12, color: c.ink2, fontWeight: '600' as const },
  };
}

export const MAX_CONTENT_WIDTH = 560;
