import React, { useState, useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { roundsApi } from '../../services/api';

// ─── Active Round Bar ─────────────────────────────────────────────────────────

function ActiveRoundBar() {
  const [activeRound, setActiveRound] = useState<any>(null);
  const router = useRouter();
  const pulse = React.useRef(new Animated.Value(1)).current;

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

  useEffect(() => {
    if (!activeRound) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, [activeRound]);

  if (!activeRound) return null;

  return (
    <TouchableOpacity
      style={activeRoundBarStyles.container}
      onPress={() => router.push(`/round/${activeRound.round.id}` as any)}
      activeOpacity={0.9}
    >
      <View style={activeRoundBarStyles.left}>
        <Animated.View style={[activeRoundBarStyles.liveDot, { opacity: pulse }]} />
        <Text style={activeRoundBarStyles.liveText}>LIVE</Text>
        <Text style={activeRoundBarStyles.label}>
          Thru {activeRound.holesPlayed} · {activeRound.toPar >= 0 ? '+' : ''}{activeRound.toPar} · Gross {activeRound.gross}
        </Text>
      </View>
      <TouchableOpacity
        style={activeRoundBarStyles.scoreBtn}
        onPress={() => router.push(`/round/${activeRound.round.id}` as any)}
      >
        <Text style={activeRoundBarStyles.scoreBtnText}>Score →</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const activeRoundBarStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.bgSecondary,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.gold,
  },
  liveText: {
    color: Colors.gold,
    fontSize: 10,
    fontFamily: 'DMSans_500Medium',
    letterSpacing: 1.5,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
  },
  scoreBtn: {
    backgroundColor: Colors.goldDim,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.gold + '50',
  },
  scoreBtnText: {
    color: Colors.gold,
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
  },
});

// ─── Tab definitions ──────────────────────────────────────────────────────────

type TabDef = {
  name: string;
  label: string;
  icon: string;
  iconFocused: string;
  isCreate?: boolean;
};

const TABS: TabDef[] = [
  { name: 'home',     label: 'HOME',    icon: 'home-outline',   iconFocused: 'home' },
  { name: 'social',   label: 'SOCIAL',  icon: 'people-outline', iconFocused: 'people' },
  { name: 'create',   label: '',        icon: 'add',            iconFocused: 'add', isCreate: true },
  { name: 'courses',  label: 'COURSES', icon: 'flag-outline',   iconFocused: 'flag' },
  { name: 'profile',  label: 'PROFILE', icon: 'person-outline', iconFocused: 'person' },
];

// ─── Bar constants ────────────────────────────────────────────────────────────

const BAR_HEIGHT = 72;
const CREATE_SIZE = 52;

// ─── Custom Tab Bar ──────────────────────────────────────────────────────────

function CustomTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const bottomPad = Math.max(insets.bottom, 8);

  return (
    <View
      style={[tabBarStyles.outerWrapper, { paddingBottom: bottomPad, height: BAR_HEIGHT + bottomPad }]}
      pointerEvents="box-none"
    >
      {/* Gold top border line */}
      <View style={tabBarStyles.topBorder} />

      <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />

      <View style={tabBarStyles.row} pointerEvents="box-none">
        {TABS.map((tab, index) => {
          const focused = state.index === index;

          const onPress = () => {
            if (tab.isCreate) {
              router.push('/event/create' as any);
              return;
            }
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

          // ── Create button (gold gradient circle) ──────────────────────────
          if (tab.isCreate) {
            return (
              <TouchableOpacity
                key={tab.name}
                onPress={onPress}
                activeOpacity={0.8}
                style={tabBarStyles.createWrap}
              >
                <LinearGradient
                  colors={['#F0C866', '#C4912A']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={tabBarStyles.createCircle}
                >
                  <Ionicons name="add" size={28} color={Colors.bg} />
                </LinearGradient>
              </TouchableOpacity>
            );
          }

          // ── Regular tab ───────────────────────────────────────────────────
          const iconColor = focused ? Colors.gold : Colors.textMuted;

          return (
            <TouchableOpacity
              key={tab.name}
              onPress={onPress}
              activeOpacity={0.7}
              style={tabBarStyles.tab}
            >
              {focused && <View style={tabBarStyles.activeUnderline} />}

              <Ionicons
                name={(focused ? tab.iconFocused : tab.icon) as any}
                size={22}
                color={iconColor}
              />

              {tab.label ? (
                <Text style={[tabBarStyles.label, { color: iconColor }]} numberOfLines={1}>
                  {tab.label}
                </Text>
              ) : null}
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
      <ActiveRoundBar />
      <Tabs
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="home"        options={{ title: 'Home' }} />
        <Tabs.Screen name="social"      options={{ title: 'Social' }} />
        <Tabs.Screen name="create"      options={{ title: '' }} />
        <Tabs.Screen name="courses"     options={{ title: 'Courses' }} />
        <Tabs.Screen name="leaderboard" options={{ title: 'Leaderboard' }} />
        <Tabs.Screen name="profile"     options={{ title: 'Profile' }} />
        {/* Hidden legacy screens */}
        <Tabs.Screen name="more"      options={{ href: null }} />
        <Tabs.Screen name="schedule"  options={{ href: null }} />
        <Tabs.Screen name="itinerary" options={{ href: null }} />
        <Tabs.Screen name="history"   options={{ href: null }} />
      </Tabs>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const tabBarStyles = StyleSheet.create({
  outerWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  topBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(212,168,67,0.20)',
    zIndex: 1,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 10,
    gap: 3,
    position: 'relative',
  },
  activeUnderline: {
    position: 'absolute',
    top: 0,
    width: 24,
    height: 2,
    borderRadius: 1,
    backgroundColor: Colors.gold,
    ...Platform.select({
      ios: {
        shadowColor: Colors.gold,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 4,
      },
    }),
  },
  label: {
    fontSize: 10,
    fontFamily: 'DMSans_500Medium',
    letterSpacing: 1,
  },
  createWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createCircle: {
    width: CREATE_SIZE,
    height: CREATE_SIZE,
    borderRadius: CREATE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -14,
    ...Platform.select({
      ios: {
        shadowColor: Colors.gold,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.6,
        shadowRadius: 12,
      },
      android: { elevation: 12 },
    }),
  },
});
