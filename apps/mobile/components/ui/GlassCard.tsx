import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Radius } from '../../constants/theme';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  glow?: 'lime' | 'purple' | 'none';
  padding?: number;
}

export default function GlassCard({ children, style, glow = 'none', padding = 16 }: Props) {
  const glowColor =
    glow === 'lime' ? Colors.lime :
    glow === 'purple' ? Colors.purple : 'transparent';

  return (
    <View style={[
      styles.card,
      { padding },
      glow !== 'none' && {
        borderColor: glowColor + '33',
        shadowColor: glowColor,
        shadowOpacity: 0.2,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 0 },
        elevation: 8,
      },
      style,
    ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: 'hidden',
  },
});
