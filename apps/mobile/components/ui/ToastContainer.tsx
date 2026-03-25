import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radius } from '../../constants/theme';
import { Toast } from '../../hooks/useToast';

interface Props {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

export default function ToastContainer({ toasts }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { top: insets.top + 12 }]} pointerEvents="none">
      {toasts.map(t => (
        <View key={t.id} style={[styles.toast, styles[t.type]]}>
          <Text style={styles.text}>{t.message}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    gap: 8,
  },
  toast: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: Radius.md,
    borderLeftWidth: 4,
  },
  success: {
    backgroundColor: '#0f2a1c',
    borderLeftColor: Colors.gold,
  },
  error: {
    backgroundColor: '#2a0f0f',
    borderLeftColor: Colors.error,
  },
  info: {
    backgroundColor: '#0f1a2a',
    borderLeftColor: Colors.info,
  },
  text: {
    color: Colors.offWhite,
    fontSize: 14,
    fontWeight: '500',
  },
});
