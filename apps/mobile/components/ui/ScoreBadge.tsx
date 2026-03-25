import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Radius } from '../../constants/theme';
import { getScoreType } from '@the-caddy/shared';

interface Props {
  strokes: number;
  par: number;
  size?: 'sm' | 'md';
}

const colorMap = {
  eagle:        Colors.eagle,
  birdie:       Colors.birdie,
  par:          Colors.par,
  bogey:        Colors.bogey,
  double_bogey: Colors.doubleBogey,
  other:        Colors.doubleBogey,
};

export default function ScoreBadge({ strokes, par, size = 'md' }: Props) {
  const type = getScoreType(strokes, par);
  const color = colorMap[type];
  const isPar = type === 'par';
  const isSmall = size === 'sm';
  const dim = isSmall ? 28 : 36;

  return (
    <View style={[
      styles.badge,
      {
        width: dim,
        height: dim,
        backgroundColor: isPar ? 'rgba(255,255,255,0.06)' : color + '22',
        borderColor: isPar ? 'rgba(255,255,255,0.15)' : color,
      },
    ]}>
      <Text style={[styles.text, { color, fontSize: isSmall ? 12 : 15 }]}>
        {strokes}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: Radius.xs,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '700',
  },
});
