const tintColorLight = '#1A1A1A';
const tintColorDark = '#1A1A1A';

export const Colors = {
  light: {
    text: '#1A1A1A',
    background: '#F5F5F5',
    tint: tintColorLight,
    icon: '#687076',
    // 2026-09-17: darkened slightly (#687076 -> #5B6167) — inactive bottom
    // tab icons/labels read as too faint on a real device. Still a warm-
    // neutral gray, same family, not the accent color.
    tabIconDefault: '#5B6167',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};
