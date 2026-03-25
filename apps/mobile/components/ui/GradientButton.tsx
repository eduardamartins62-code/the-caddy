import React from 'react';
import {
  TouchableOpacity, Text, StyleSheet, ActivityIndicator,
  ViewStyle, TextStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Radius } from '../../constants/theme';

interface Props {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'gradient' | 'lime' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export default function GradientButton({
  label, onPress, loading, disabled,
  variant = 'gradient', size = 'md', style, textStyle,
}: Props) {
  const heights = { sm: 36, md: 48, lg: 56 };
  const fontSizes = { sm: 13, md: 15, lg: 17 };

  const isOutline = variant === 'outline';
  const isGhost   = variant === 'ghost';
  const isLime    = variant === 'lime';

  if (isOutline || isGhost) {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled || loading}
        activeOpacity={0.75}
        style={[
          styles.base,
          { height: heights[size] },
          isOutline && { borderWidth: 1.5, borderColor: Colors.lime },
          isGhost && { backgroundColor: Colors.limeDim },
          (disabled || loading) && { opacity: 0.5 },
          style,
        ]}
      >
        {loading
          ? <ActivityIndicator color={Colors.lime} />
          : <Text style={[styles.text, { fontSize: fontSizes[size], color: Colors.lime }, textStyle]}>{label}</Text>
        }
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[{ borderRadius: Radius.pill, overflow: 'hidden' }, (disabled || loading) && { opacity: 0.5 }, style]}
    >
      <LinearGradient
        colors={isLime ? [Colors.lime, Colors.lime] : ['#C9F31D', '#7B61FF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.base, { height: heights[size] }]}
      >
        {loading
          ? <ActivityIndicator color={Colors.bg} />
          : <Text style={[styles.text, { fontSize: fontSizes[size], color: Colors.bg, fontWeight: '700' }, textStyle]}>{label}</Text>
        }
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  text: {
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
