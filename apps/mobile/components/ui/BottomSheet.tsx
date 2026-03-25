import React, { useEffect, useRef } from 'react';
import {
  Modal, View, Animated, TouchableOpacity, StyleSheet,
  Dimensions, PanResponder, ScrollView,
} from 'react-native';
import { Colors, Radius } from '../../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SCREEN_HEIGHT = Dimensions.get('window').height;

interface Props {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxHeight?: number;
  snapHeight?: number;
}

export default function BottomSheet({ visible, onClose, children, snapHeight }: Props) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: SCREEN_HEIGHT, duration: 280, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: (_, { dy }) => {
      if (dy > 0) translateY.setValue(dy);
    },
    onPanResponderRelease: (_, { dy }) => {
      if (dy > 80) { onClose(); }
      else { Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start(); }
    },
  })).current;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      <Animated.View style={[
        styles.sheet,
        snapHeight ? { height: snapHeight } : {},
        { transform: [{ translateY }], paddingBottom: insets.bottom + 16 },
      ]}>
        <View style={styles.handle} {...panResponder.panHandlers} />
        <ScrollView showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,10,15,0.7)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.bgSecondary,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: Colors.glassBorder,
    minHeight: 200,
    maxHeight: SCREEN_HEIGHT * 0.92,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.textMuted,
    marginVertical: 12,
  },
});
