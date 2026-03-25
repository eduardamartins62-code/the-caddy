import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Radius } from '../../constants/theme';

interface Props {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export default function SkeletonLoader({ width = '100%', height = 16, borderRadius = Radius.sm, style }: Props) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.6] });

  return (
    <Animated.View style={[{ width: width as number, height, borderRadius, backgroundColor: Colors.bgTertiary, opacity }, style]} />
  );
}

export function SkeletonCard() {
  return (
    <View style={sStyles.card}>
      <View style={sStyles.row}>
        <SkeletonLoader width={44} height={44} borderRadius={22} />
        <View style={{ flex: 1, marginLeft: 12, gap: 8 }}>
          <SkeletonLoader height={14} width="60%" />
          <SkeletonLoader height={12} width="40%" />
        </View>
      </View>
      <SkeletonLoader height={180} borderRadius={Radius.md} style={{ marginTop: 12 }} />
      <SkeletonLoader height={12} width="80%" style={{ marginTop: 12 }} />
      <SkeletonLoader height={12} width="60%" style={{ marginTop: 8 }} />
    </View>
  );
}

const sStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 16,
    marginBottom: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
});
