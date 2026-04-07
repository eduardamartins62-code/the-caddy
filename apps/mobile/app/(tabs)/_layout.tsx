import React, { useState, useEffect, useRef } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Animated, Modal, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius } from '../../constants/theme';
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

const BAR_HEIGHT = 68;
const CREATE_SIZE = 56;

// ─── Create Action Sheet ─────────────────────────────────────────────────────

interface CreateActionSheetProps {
  visible: boolean;
  onClose: () => void;
  onSharePost: () => void;
}

function CreateActionSheet({ visible, onClose, onSharePost }: CreateActionSheetProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const actions = [
    {
      label: 'Create Event',
      icon: 'trophy-outline' as const,
      color: Colors.gold,
      onPress: () => { onClose(); router.push('/event/create' as any); },
    },
    {
      label: 'Share a Post',
      icon: 'create-outline' as const,
      color: Colors.teal,
      onPress: () => { onClose(); onSharePost(); },
    },
    {
      label: 'Start a Round',
      icon: 'golf-outline' as const,
      color: '#6C8BF5',
      onPress: () => { onClose(); router.push('/admin/rounds' as any); },
    },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={sheetStyles.overlay} onPress={onClose}>
        <Pressable style={[sheetStyles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={sheetStyles.handle} />
          <Text style={sheetStyles.title}>What would you like to do?</Text>
          {actions.map(action => (
            <TouchableOpacity
              key={action.label}
              style={sheetStyles.action}
              onPress={action.onPress}
              activeOpacity={0.75}
            >
              <View style={[sheetStyles.iconWrap, { backgroundColor: action.color + '20' }]}>
                <Ionicons name={action.icon} size={22} color={action.color} />
              </View>
              <Text style={sheetStyles.actionLabel}>{action.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={sheetStyles.cancelBtn} onPress={onClose}>
            <Text style={sheetStyles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const sheetStyles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.bgSecondary,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, gap: 4,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 12,
  },
  title: {
    color: Colors.textSecondary, fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    letterSpacing: 0.5, textAlign: 'center', marginBottom: 8,
  },
  action: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 16, borderRadius: Radius.lg,
    backgroundColor: Colors.bgTertiary,
    borderWidth: 1, borderColor: Colors.border,
    marginVertical: 4,
  },
  iconWrap: {
    width: 42, height: 42, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  actionLabel: {
    flex: 1, color: Colors.textPrimary, fontSize: 16,
    fontFamily: 'DMSans_500Medium',
  },
  cancelBtn: {
    marginTop: 8, padding: 16, alignItems: 'center',
    borderRadius: Radius.lg, backgroundColor: Colors.bgTertiary,
    borderWidth: 1, borderColor: Colors.border,
  },
  cancelText: { color: Colors.textSecondary, fontSize: 15, fontFamily: 'DMSans_500Medium' },
});

// ─── Custom Tab Bar ──────────────────────────────────────────────────────────

function CustomTabBar({ state, navigation, onCreatePress }: any) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const bottomPad = Math.max(insets.bottom, 8);

  return (
    <View
      style={[tabBarStyles.outerWrapper, { paddingBottom: bottomPad, height: BAR_HEIGHT + bottomPad }]}
      pointerEvents="box-none"
    >
      {/* Dark background */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.bgSecondary }]} />

      {/* Gold top border line */}
      <View style={tabBarStyles.topBorder} />

      <View style={tabBarStyles.row} pointerEvents="box-none">
        {TABS.map((tab, index) => {
          // Compare by route name so hidden screens don't break the active state
          const focused = state.routes[state.index]?.name === tab.name;

          const onPress = () => {
            if (tab.isCreate) {
              // Spec: open bottom action sheet instead of direct navigate
              onCreatePress?.();
              return;
            }
            // Look up route by name so hidden screens (leaderboard etc.) don't shift indices
            const route = state.routes.find((r: any) => r.name === tab.name);
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

function TabBarWithRoundBar(props: any) {
  return (
    <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
      <ActiveRoundBar />
      <CustomTabBar {...props} />
    </View>
  );
}

export default function TabsLayout() {
  const [showActionSheet, setShowActionSheet] = useState(false);
  // PostCreationModal trigger — social tab can subscribe via context if needed
  // For now, just open social tab which has its own compose button
  const router = useRouter();

  function handleSharePost() {
    // Navigate to social tab — the compose button is there
    router.push('/(tabs)/social' as any);
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Spec: bottom action sheet for [+] button */}
      <CreateActionSheet
        visible={showActionSheet}
        onClose={() => setShowActionSheet(false)}
        onSharePost={handleSharePost}
      />
      <Tabs
        tabBar={(props) => (
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
            <ActiveRoundBar />
            <CustomTabBar {...props} onCreatePress={() => setShowActionSheet(true)} />
          </View>
        )}
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
    left: 0,
    right: 0,
    overflow: 'visible',
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
