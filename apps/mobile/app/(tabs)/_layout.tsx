import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  House, Compass, Plus, Trophy, User, Ellipsis,
} from 'lucide-react-native';
import { Colors } from '../../constants/theme';

// ─── Tab config ──────────────────────────────────────────────────────────────

type TabConfig = {
  name: string;
  label: string;
  Icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
  isCreate?: boolean;
};

const TABS: TabConfig[] = [
  { name: 'home',        label: 'Home',        Icon: House },
  { name: 'social',      label: 'Explore',     Icon: Compass },
  { name: 'create',      label: '',            Icon: Plus, isCreate: true },
  { name: 'leaderboard', label: 'Leaderboard', Icon: Trophy },
  { name: 'profile',     label: 'Profile',     Icon: User },
  { name: 'more',        label: 'More',        Icon: Ellipsis },
];

// ─── Bar height constant ──────────────────────────────────────────────────────

const BAR_HEIGHT = 68;
const CREATE_SIZE = 54;

// ─── Custom Tab Bar ──────────────────────────────────────────────────────────

function CustomTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 8);

  return (
    <View
      style={[
        styles.outerWrapper,
        { paddingBottom: bottomPad, height: BAR_HEIGHT + bottomPad },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.bar}>
        {TABS.map((tab, index) => {
          const focused = state.index === index;

          const onPress = () => {
            const route = state.routes[index];
            if (!route) return;
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          // ── Create button (center) ──────────────────────────────────────────
          if (tab.isCreate) {
            return (
              <TouchableOpacity
                key={tab.name}
                onPress={onPress}
                activeOpacity={0.8}
                style={styles.createWrap}
              >
                <View style={styles.createCircle}>
                  <Plus size={24} color={Colors.bg} strokeWidth={2.8} />
                </View>
              </TouchableOpacity>
            );
          }

          // ── Regular tab ────────────────────────────────────────────────────
          const iconColor = focused ? Colors.lime : Colors.textSecondary;

          return (
            <TouchableOpacity
              key={tab.name}
              onPress={onPress}
              activeOpacity={0.7}
              style={styles.tab}
            >
              {/* Lime glow dot above icon when active */}
              {focused && <View style={styles.glowDot} />}

              <tab.Icon
                size={21}
                color={iconColor}
                strokeWidth={focused ? 2.2 : 1.7}
              />

              <Text
                style={[
                  styles.label,
                  { color: iconColor, fontWeight: focused ? '700' : '400' },
                ]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Layout ──────────────────────────────────────────────────────────────────

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="social" />
      <Tabs.Screen name="create" />
      <Tabs.Screen name="leaderboard" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="more" />
      {/* Hidden legacy screens — still routable, not shown in nav */}
      <Tabs.Screen name="schedule"  options={{ href: null }} />
      <Tabs.Screen name="itinerary" options={{ href: null }} />
      <Tabs.Screen name="history"   options={{ href: null }} />
    </Tabs>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  outerWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: 12,
    justifyContent: 'flex-end',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: BAR_HEIGHT,
    backgroundColor: '#13131A',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 4,
    // Shadow
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.55,
        shadowRadius: 18,
      },
      android: { elevation: 20 },
    }),
  },

  // ── Regular tab
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 4,
    position: 'relative',
  },
  glowDot: {
    position: 'absolute',
    top: 4,
    width: 20,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.lime,
    // glow
    ...Platform.select({
      ios: {
        shadowColor: Colors.lime,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 6,
      },
      android: { elevation: 0 },
    }),
  },
  label: {
    fontSize: 10,
    letterSpacing: 0.1,
  },

  // ── Create button
  createWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createCircle: {
    width: CREATE_SIZE,
    height: CREATE_SIZE,
    borderRadius: CREATE_SIZE / 2,
    backgroundColor: Colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -14, // elevate above bar
    // Glow
    ...Platform.select({
      ios: {
        shadowColor: Colors.lime,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.7,
        shadowRadius: 12,
      },
      android: { elevation: 12 },
    }),
  },
});
