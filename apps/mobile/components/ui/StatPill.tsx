import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Radius } from '../../constants/theme';

interface Props {
  label: string;
  value: string | number;
  accent?: 'lime' | 'purple' | 'neutral';
}

export default function StatPill({ label, value, accent = 'neutral' }: Props) {
  const accentColor =
    accent === 'lime' ? Colors.lime :
    accent === 'purple' ? Colors.purple : Colors.textSecondary;

  return (
    <View style={[styles.pill, { borderColor: accentColor + '30' }]}>
      <Text style={[styles.value, { color: accentColor }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.lg,
    borderWidth: 1,
    backgroundColor: Colors.bgSecondary,
    minWidth: 64,
  },
  value: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  label: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: '500',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
