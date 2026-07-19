import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { type StyleProp, type TextStyle } from 'react-native';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

/** SF Symbol–style names mapped to Ionicons (used by tab bar). */
const MAPPING: Record<string, IoniconName> = {
  'house.fill': 'home',
  house: 'home-outline',
};

type IconSymbolProps = {
  name: string;
  size?: number;
  color: string;
  style?: StyleProp<TextStyle>;
};

export function IconSymbol({ name, size = 24, color, style }: IconSymbolProps) {
  const ionName = MAPPING[name] ?? 'ellipse';
  return <Ionicons name={ionName} size={size} color={color} style={style} />;
}
