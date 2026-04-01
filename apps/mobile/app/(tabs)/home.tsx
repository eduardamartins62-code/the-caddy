import React, { useCallback, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { useEvents, useEventLeaderboard, useUnreadCount, useConversations } from '../../hooks/useQueries';
import { Event } from '@the-caddy/shared';
import { SkeletonCard } from '../../components/ui/SkeletonLoader';
import AvatarRing from '../../components/ui/AvatarRing';
import GlassCard from '../../components/ui/GlassCard';
import { Colors, Radius, Spacing } from '../../constants/theme';

// ─── Quick Actions ────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { label: 'Friends',     icon: 'people-outline',    route: '/friends',            color: Colors.teal },
  { label: 'Tournaments', icon: 'trophy-outline',    route: '/event/create',       color: Colors.gold },
  { label: 'Messages',    icon: 'chatbubble-outline', route: '/messages',           color: '#6C8BF5' },
  { label: 'Courses',     icon: 'flag-outline',      route: '/(tabs)/courses',     color: '#C17B2E' },
] as const;

function QuickActionsGrid() {
  const router = useRouter();
  return (
    <View style={qaStyles.grid}>
      {QUICK_ACTIONS.map(({ label, icon, route, color }) => (
        <TouchableOpacity
          key={label}
          style={qaStyles.cell}
          onPress={() => router.push(route as any)}
          activeOpacity={0.75}
        >
          <View style={[qaStyles.iconBox, { borderColor: color + '30' }]}>
            <Ionicons name={icon as any} size={22} color={color} />
          </View>
          <Text style={qaStyles.label}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const qaStyles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  cell: {
    width: '47%',
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgTertiary,
    borderWidth: 1,
  },
  label: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontFamily: 'DMSans_500Medium',
  },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const livePulse = useRef(new Animated.Value(1)).current;

  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'SCOREKEEPER';

  const { data: events = [], isLoading: eventsLoading, error: eventsError, refetch: refetchEvents } = useEvents();
  const activeEvent = (events as Event[]).find(e => e.isActive) || (events as Event[])[0] || null;

  const { data: leaderboard = [], isLoading: lbLoading, refetch: refetchLb } =
    useEventLeaderboard(activeEvent?.id ?? '');

  const { data: unreadData } = useUnreadCount();
  const unread = unreadData?.count ?? 0;

  const { data: conversations = [] } = useConversations();
  const unreadMessages = (conversations as any[]).filter(
    (c: any) => c.lastMessage && !c.lastMessage.isRead && c.lastMessage.senderId !== user?.id
  ).length;

  const top3 = (leaderboard as any[]).slice(0, 3);
  const loading = eventsLoading;

  // Live pulse animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(livePulse, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        Animated.timing(livePulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['events'] }),
      qc.invalidateQueries({ queryKey: ['leaderboard'] }),
      qc.invalidateQueries({ queryKey: ['unreadCount'] }),
      qc.invalidateQueries({ queryKey: ['conversations'] }),
    ]);
    setRefreshing(false);
  }, [qc]);

  const scoreColor = (score: number) =>
    score < 0 ? Colors.gold : score > 0 ? Colors.warning : Colors.textSecondary;

  const formatScore = (score: number) =>
    score === 0 ? 'E' : score > 0 ? `+${score}` : `${score}`;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 120 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── Top Bar ── */}
        <View style={styles.topBar}>
          <Text style={styles.brandName}>THE CADDY</Text>
          <View style={styles.topBarRight}>
            {isAdmin && (
              <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/admin/index' as any)}>
                <Ionicons name="settings-outline" size={20} color={Colors.gold} />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/messages' as any)}>
              <Ionicons
                name="chatbubble-outline"
                size={20}
                color={unreadMessages > 0 ? Colors.gold : Colors.textSecondary}
              />
              {unreadMessages > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadMessages > 9 ? '9+' : unreadMessages}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/notifications' as any)}>
              <Ionicons
                name="notifications-outline"
                size={20}
                color={unread > 0 ? Colors.gold : Colors.textSecondary}
              />
              {unread > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Quick Actions ── */}
        <QuickActionsGrid />

        {/* ── Hero Event Card ── */}
        {loading ? (
          <SkeletonCard />
        ) : eventsError ? (
          <GlassCard style={styles.noEventCard}>
            <Text style={styles.noEventText}>Failed to load events.</Text>
            <TouchableOpacity onPress={() => refetchEvents()} style={styles.retryBtn}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </GlassCard>
        ) : !activeEvent ? (
          <GlassCard style={styles.noEventCard}>
            <Text style={styles.noEventText}>No active events — create one!</Text>
            {isAdmin && (
              <TouchableOpacity onPress={() => router.push('/event/create' as any)} style={styles.retryBtn}>
                <Text style={styles.retryText}>Create Event</Text>
              </TouchableOpacity>
            )}
          </GlassCard>
        ) : (
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={() => router.push(`/event/${activeEvent.id}` as any)}
            style={styles.heroWrap}
          >
            <LinearGradient colors={['#1A2340', '#0F1420']} style={styles.heroCard}>
              {/* Faint radial gold glow */}
              <View style={styles.heroGoldGlow} />

              <View style={styles.heroBadgeRow}>
                <View style={styles.typeBadge}>
                  <Text style={styles.typeBadgeText}>{activeEvent.type}</Text>
                </View>
                {(activeEvent as any).recurrence && (
                  <View style={styles.recurrenceBadge}>
                    <Text style={styles.recurrenceBadgeText}>{(activeEvent as any).recurrence}</Text>
                  </View>
                )}
                <View style={styles.livePill}>
                  <Animated.View style={[styles.liveDot, { opacity: livePulse }]} />
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
              </View>

              <Text style={styles.heroTitle}>{activeEvent.name}</Text>

              <View style={styles.heroMeta}>
                <Ionicons name="location-outline" size={13} color={Colors.textSecondary} />
                <Text style={styles.heroMetaText}>{activeEvent.location}</Text>
                <Text style={styles.heroDot}>·</Text>
                <Ionicons name="calendar-outline" size={13} color={Colors.textSecondary} />
                <Text style={styles.heroMetaText}>
                  {new Date(activeEvent.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.heroCta}
                onPress={() => router.push('/(tabs)/leaderboard' as any)}
              >
                <LinearGradient
                  colors={['#F0C866', '#C4912A']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.heroCtaGrad}
                >
                  <Text style={styles.heroCtaText}>View Leaderboard →</Text>
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* ── Leaderboard Podium ── */}
        {top3.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>LEADERBOARD</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/leaderboard' as any)}>
                <Text style={styles.seeAll}>See all →</Text>
              </TouchableOpacity>
            </View>

            {/* #1 full-width */}
            {top3[0] && (
              <TouchableOpacity
                style={styles.podiumFirst}
                onPress={() => router.push(`/profile/${top3[0].user.id}` as any)}
                activeOpacity={0.85}
              >
                <LinearGradient colors={['#1A2340', '#0F1420']} style={styles.podiumFirstInner}>
                  <View style={styles.podiumFirstGlow} />
                  <View style={styles.podiumFirstLeft}>
                    <Text style={styles.rankGold}>1</Text>
                    <AvatarRing uri={top3[0].user.avatar} name={top3[0].user.name} size={48} ring="lime" ringWidth={2} />
                    <View>
                      <Text style={styles.podiumFirstName}>{top3[0].user.name}</Text>
                      {top3[0].user.handicap != null && (
                        <Text style={styles.podiumHcp}>HCP {top3[0].user.handicap}</Text>
                      )}
                    </View>
                  </View>
                  <Text style={[styles.podiumFirstScore, { color: scoreColor(top3[0].netScore) }]}>
                    {formatScore(top3[0].netScore)}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            )}

            {/* #2 + #3 side by side */}
            {(top3[1] || top3[2]) && (
              <View style={styles.podiumRow}>
                {[top3[1], top3[2]].filter(Boolean).map((entry: any, i: number) => (
                  <TouchableOpacity
                    key={entry.user.id}
                    style={styles.podiumCard}
                    onPress={() => router.push(`/profile/${entry.user.id}` as any)}
                    activeOpacity={0.8}
                  >
                    <GlassCard padding={12} style={styles.podiumCardInner}>
                      <Text style={[styles.podiumRank, { color: i === 0 ? '#C0C0C0' : '#CD7F32' }]}>
                        {i + 2}
                      </Text>
                      <AvatarRing uri={entry.user.avatar} name={entry.user.name} size={36} />
                      <Text style={styles.podiumName} numberOfLines={1}>{entry.user.name.split(' ')[0]}</Text>
                      <Text style={[styles.podiumScore, { color: scoreColor(entry.netScore) }]}>
                        {formatScore(entry.netScore)}
                      </Text>
                    </GlassCard>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  scroll: { paddingHorizontal: Spacing.md },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  brandName: {
    color: Colors.gold,
    fontSize: 20,
    fontFamily: 'CormorantGaramond_700Bold',
    letterSpacing: 3,
  },
  topBarRight: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: Colors.bg,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  // Hero
  heroWrap: { marginBottom: 24 },
  heroCard: {
    borderRadius: Radius.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  heroGoldGlow: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: Colors.gold,
    opacity: 0.05,
  },
  heroBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  typeBadge: {
    backgroundColor: Colors.goldDim,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.gold + '40',
  },
  typeBadgeText: {
    color: Colors.gold,
    fontSize: 10,
    fontFamily: 'DMSans_500Medium',
    letterSpacing: 1,
  },
  recurrenceBadge: {
    backgroundColor: Colors.tealDim,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.teal + '40',
  },
  recurrenceBadgeText: {
    color: Colors.teal,
    fontSize: 10,
    fontFamily: 'DMSans_500Medium',
    letterSpacing: 1,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.error + '22',
    borderRadius: Radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.error },
  liveText: { color: Colors.error, fontSize: 10, fontFamily: 'DMSans_500Medium', letterSpacing: 0.5 },
  heroTitle: {
    color: Colors.textPrimary,
    fontSize: 26,
    fontFamily: 'CormorantGaramond_700Bold',
    marginBottom: 10,
  },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 16 },
  heroMetaText: { color: Colors.textSecondary, fontSize: 13, fontFamily: 'DMSans_400Regular' },
  heroDot: { color: Colors.textMuted, marginHorizontal: 2 },
  heroCta: { alignSelf: 'flex-start', borderRadius: Radius.pill, overflow: 'hidden' },
  heroCtaGrad: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  heroCtaText: { color: Colors.bg, fontFamily: 'DMSans_500Medium', fontSize: 13 },

  // No event
  noEventCard: { marginBottom: 24, alignItems: 'center', gap: 12 },
  noEventText: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 8,
    fontFamily: 'DMSans_400Regular',
  },
  retryBtn: {
    backgroundColor: Colors.goldDim,
    borderRadius: Radius.pill,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.gold + '40',
  },
  retryText: { color: Colors.gold, fontSize: 13, fontFamily: 'DMSans_500Medium' },

  // Section
  section: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontFamily: 'DMSans_500Medium',
    letterSpacing: 1.5,
  },
  seeAll: { color: Colors.gold, fontSize: 13, fontFamily: 'DMSans_400Regular' },

  // Podium
  podiumFirst: { marginBottom: 10 },
  podiumFirstInner: {
    borderRadius: Radius.xl,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    overflow: 'hidden',
  },
  podiumFirstGlow: {
    position: 'absolute',
    top: -30,
    left: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.gold,
    opacity: 0.07,
  },
  podiumFirstLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rankGold: {
    color: Colors.gold,
    fontSize: 22,
    fontFamily: 'DMMono_400Regular',
  },
  podiumFirstName: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontFamily: 'DMSans_500Medium',
  },
  podiumHcp: { color: Colors.textSecondary, fontSize: 12, fontFamily: 'DMSans_400Regular', marginTop: 2 },
  podiumFirstScore: {
    fontSize: 32,
    fontFamily: 'DMMono_400Regular',
    letterSpacing: -1,
  },
  podiumRow: { flexDirection: 'row', gap: 10 },
  podiumCard: { flex: 1 },
  podiumCardInner: { alignItems: 'center', gap: 6 },
  podiumRank: { fontSize: 18, fontFamily: 'DMMono_400Regular', textAlign: 'center' },
  podiumName: { color: Colors.textPrimary, fontSize: 12, fontFamily: 'DMSans_500Medium', textAlign: 'center' },
  podiumScore: { fontSize: 20, fontFamily: 'DMMono_400Regular', letterSpacing: -0.5 },
});
