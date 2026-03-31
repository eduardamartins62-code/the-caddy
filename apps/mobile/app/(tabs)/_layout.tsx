import React, { useState, useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  House, Compass, Trophy, User, Flag,
} from 'lucide-react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { roundsApi } from '../../services/api';

// ─── Active Round Bar ─────────────────────────────────────────────────────────

function ActiveRoundBar() {
  const [activeRound, setActiveRound] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const check = async () => {
      try {
        const data = await roundsApi.getActive();
        setActiveRound(data);
      } catch { setActiveRound(null); }
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!activeRound) return null;

  return (
    <TouchableOpacity
      style={activeRoundBarStyles.container}
      onPress={() => router.push(`/round/${activeRound.round.id}` as any)}
      activeOpacity={0.9}
    >
      <View style={activeRoundBarStyles.info}>
        <Text style={activeRoundBarStyles.label}>Thru {activeRound.holesPlayed}</Text>
        <Text style={activeRoundBarStyles.label}>
          To Par {activeRound.toPar >= 0 ? '+' : ''}{activeRound.toPar}
        </Text>
        <Text style={activeRoundBarStyles.label}>Gross {activeRound.gross}</Text>
      </View>
      <TouchableOpacity
        style={activeRoundBarStyles.finishBtn}
        onPress={() => router.push(`/round/${activeRound.round.id}` as any)}
      >
        <Text style={activeRoundBarStyles.finishText}>Finish Round</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const activeRoundBarStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A1A2E',
    borderTopWidth: 1,
    borderTopColor: '#C9F31D33',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  info: { flexDirection: 'row', gap: 20 },
  label: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  finishBtn: {
    backgroundColor: '#C9F31D',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  finishText: { color: '#0A0A0F', fontSize: 13, fontWeight: '700' },
});

// ─── Tab config ──────────────────────────────────────────────────────────────

type TabConfig = {
  name: string;
  label: string;
  Icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
  isCreate?: boolean;
};

const TABS: TabConfig[] = [
  { name: 'home',        label: 'Home',    Icon: House },
  { name: 'social',      label: 'Explore', Icon: Compass },
  { name: 'create',      label: '',        Icon: House, isCreate: true },
  { name: 'courses',     label: 'Courses', Icon: Flag },
  { name: 'leaderboard', label: 'Leader',  Icon: Trophy },
  { name: 'profile',     label: 'Profile', Icon: User },
];

// ─── Bar height constant ──────────────────────────────────────────────────────

const BAR_HEIGHT = 68;
const CREATE_SIZE = 54;

// ─── Custom Tab Bar ──────────────────────────────────────────────────────────

function CustomTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
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

          // ── Create / Start Game button (center) ────────────────────────────
          if (tab.isCreate) {
            return (
              <TouchableOpacity
                key={tab.name}
                onPress={() => router.push('/event/create' as any)}
                activeOpacity={0.8}
                style={styles.createWrap}
              >
                <View style={styles.createCircle}>
                  <Ionicons name="golf-outline" size={26} color={Colors.bg} />
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
    <View style={{ flex: 1 }}>
      <Tabs
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="home" />
        <Tabs.Screen name="social" />
        <Tabs.Screen name="create" />
        <Tabs.Screen name="courses" />
        <Tabs.Screen name="leaderboard" />
        <Tabs.Screen name="profile" />
        {/* Hidden legacy screens — still routable, not shown in nav */}
        <Tabs.Screen name="more"      options={{ href: null }} />
        <Tabs.Screen name="schedule"  options={{ href: null }} />
        <Tabs.Screen name="itinerary" options={{ href: null }} />
        <Tabs.Screen name="history"   options={{ href: null }} />
      </Tabs>
      <ActiveRoundBar />
    </View>
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
