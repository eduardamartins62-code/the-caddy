import React from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/theme';

interface Props {
  uri?: string | null;
  name?: string;
  size?: number;
  ring?: 'lime' | 'purple' | 'none';
  ringWidth?: number;
}

export default function AvatarRing({ uri, name, size = 40, ring = 'none', ringWidth = 2 }: Props) {
  const ringColor =
    ring === 'lime' ? Colors.lime :
    ring === 'purple' ? Colors.purple : 'transparent';

  const initials = name
    ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  const totalSize = ring !== 'none' ? size + ringWidth * 2 + 4 : size;

  return (
    <View style={[
      styles.ring,
      {
        width: totalSize,
        height: totalSize,
        borderRadius: totalSize / 2,
        borderWidth: ring !== 'none' ? ringWidth : 0,
        borderColor: ringColor,
        padding: ring !== 'none' ? 2 : 0,
      },
    ]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      ) : (
        <View style={[styles.placeholder, { width: size, height: size, borderRadius: size / 2 }]}>
          <Text style={[styles.initials, { fontSize: size * 0.35 }]}>{initials}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    backgroundColor: Colors.bgTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: Colors.lime,
    fontWeight: '700',
  },
});
