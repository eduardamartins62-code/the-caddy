import React, { useCallback, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Bell, Settings, MapPin, Calendar, ArrowRight, Flag, Map, Trophy, UserPlus, MessageCircle } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { useEvents, useEventLeaderboard, useUnreadCount, useConversations } from '../../hooks/useQueries';
import { Event } from '@the-caddy/shared';
import { SkeletonCard } from '../../components/ui/SkeletonLoader';
import AvatarRing from '../../components/ui/AvatarRing';
import GlassCard from '../../components/ui/GlassCard';
import { Colors, Radius, Spacing } from '../../constants/theme';

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const livePulse = useRef(new Animated.Value(1)).current;

  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'SCOREKEEPER';

  // ─── Queries ─────────────────────────────────────────────────────────────
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

  // ─── Live pulse animation ─────────────────────────────────────────────────
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(livePulse, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        Animated.timing(livePulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // ─── Pull-to-refresh ─────────────────────────────────────────────────────
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
    score < 0 ? Colors.lime : score > 0 ? Colors.orange : Colors.textSecondary;

  const formatScore = (score: number) =>
    score === 0 ? 'E' : score > 0 ? `+${score}` : `${score}`;

  const loading = eventsLoading;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 100 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.lime} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Bar */}
        <View style={styles.topBar}>
          <View>
            <Text style={styles.brandName}>THE CADDY</Text>
          </View>
          <View style={styles.topBarRight}>
            {isAdmin && (
              <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/admin/index' as any)}>
                <Settings size={20} color={Colors.lime} strokeWidth={2} />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/messages' as any)}>
              <MessageCircle size={20} color={unreadMessages > 0 ? Colors.lime : Colors.textSecondary} strokeWidth={2} />
              {unreadMessages > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadMessages > 9 ? '9+' : unreadMessages}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/notifications' as any)}>
              <Bell size={20} color={unread > 0 ? Colors.lime : Colors.textSecondary} strokeWidth={2} />
              {unread > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Hero Event Card */}
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
            <LinearGradient
              colors={['#1A1A2E', '#0A0A0F']}
              style={styles.heroCard}
            >
              {/* Glow accent */}
              <View style={styles.heroGlowTop} />

              <View style={styles.heroBadgeRow}>
                <View style={styles.typeBadge}>
                  <Text style={styles.typeBadgeText}>{activeEvent.type}</Text>
                </View>
                <View style={styles.livePill}>
                  <Animated.View style={[styles.liveDot, { opacity: livePulse }]} />
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
              </View>

              <Text style={styles.heroTitle}>{activeEvent.name}</Text>

              <View style={styles.heroMeta}>
                <MapPin size={13} color={Colors.textSecondary} strokeWidth={2} />
                <Text style={styles.heroMetaText}>{activeEvent.location}</Text>
                <Text style={styles.heroDot}>·</Text>
                <Calendar size={13} color={Colors.textSecondary} strokeWidth={2} />
                <Text style={styles.heroMetaText}>
                  {new Date(activeEvent.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.heroCta}
                onPress={() => router.push('/(tabs)/leaderboard' as any)}
              >
                <LinearGradient colors={['#C9F31D', '#7B61FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.heroCtaGrad}>
                  <Text style={styles.heroCtaText}>View Leaderboard</Text>
                  <ArrowRight size={14} color={Colors.bg} strokeWidth={2.5} />
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Live Leaderboard Mini */}
        {top3.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Top 3</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/leaderboard' as any)}>
                <Text style={styles.seeAll}>See all →</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.podiumRow}>
              {top3.map((entry: any, i: number) => {
                const isPodiumFirst = i === 0;
                return (
                  <TouchableOpacity
                    key={entry.user.id}
                    style={[styles.podiumCard, isPodiumFirst && styles.podiumCardFirst]}
                    onPress={() => router.push(`/profile/${entry.user.id}` as any)}
                    activeOpacity={0.8}
                  >
                    <GlassCard glow={isPodiumFirst ? 'lime' : 'none'} padding={12} style={styles.podiumInner}>
                      <Text style={[
                        styles.podiumRank,
                        isPodiumFirst && styles.podiumRankFirst,
                        { color: i === 0 ? Colors.lime : i === 1 ? '#C0C0C0' : '#CD7F32' },
                      ]}>
                        {i + 1}
                      </Text>
                      <AvatarRing
                        uri={entry.user.avatar}
                        name={entry.user.name}
                        size={isPodiumFirst ? 44 : 36}
                        ring={isPodiumFirst ? 'lime' : 'none'}
                      />
                      <Text style={styles.podiumName} numberOfLines={1}>
                        {entry.user.name.split(' ')[0]}
                      </Text>
                      <Text style={[styles.podiumScore, { color: scoreColor(entry.netScore) }]}>
                        {formatScore(entry.netScore)}
                      </Text>
                    </GlassCard>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Quick Access */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Access</Text>
          <View style={styles.quickGrid}>
            {([
              { Icon: Flag,     label: 'Schedule', route: '/(tabs)/schedule' as const, color: Colors.lime },
              { Icon: Map,      label: 'Itinerary', route: '/itinerary' as const, color: Colors.purple },
              { Icon: Trophy,   label: 'History', route: '/history' as const, color: Colors.orange },
              { Icon: UserPlus, label: 'Invite', route: (activeEvent ? `/event/${activeEvent.id}` : '/home') as any, color: Colors.success },
            ] as { Icon: any; label: string; route: any; color: string }[]).map(item => (
              <TouchableOpacity
                key={item.label}
                activeOpacity={0.75}
                onPress={() => router.push(item.route)}
                style={styles.quickItem}
              >
                <GlassCard padding={16} style={styles.quickCard}>
                  <View style={[styles.quickIcon, { backgroundColor: item.color + '20' }]}>
                    <item.Icon size={22} color={item.color} strokeWidth={2} />
                  </View>
                  <Text style={styles.quickLabel}>{item.label}</Text>
                </GlassCard>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: Colors.bg },
  scroll:       { paddingHorizontal: Spacing.md },

  // Top bar
  topBar:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16 },
  brandName:    { color: Colors.lime, fontSize: 16, fontWeight: '900', letterSpacing: 4 },
  topBarRight:  { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.bgSecondary, borderWidth: 1, borderColor: Colors.cardBorder,
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  badge: {
    position: 'absolute', top: -2, right: -2,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3, borderWidth: 1.5, borderColor: Colors.bg,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  // Hero
  heroWrap:   { marginBottom: 24 },
  heroCard:   {
    borderRadius: Radius.xl, padding: 20,
    borderWidth: 1, borderColor: Colors.glassBorder, overflow: 'hidden',
  },
  heroGlowTop: {
    position: 'absolute', top: -40, right: -40,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: Colors.lime, opacity: 0.06,
  },
  heroBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  typeBadge:    {
    backgroundColor: Colors.limeDim, borderRadius: Radius.pill,
    paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: Colors.lime + '40',
  },
  typeBadgeText: { color: Colors.lime, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  livePill:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.error + '22', borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 4 },
  liveDot:      { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.error },
  liveText:     { color: Colors.error, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  heroTitle:    { color: Colors.textPrimary, fontSize: 22, fontWeight: '800', letterSpacing: -0.5, marginBottom: 10 },
  heroMeta:     { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 16 },
  heroMetaText: { color: Colors.textSecondary, fontSize: 13 },
  heroDot:      { color: Colors.textMuted, marginHorizontal: 2 },
  heroCta:      { alignSelf: 'flex-start', borderRadius: Radius.pill, overflow: 'hidden' },
  heroCtaGrad:  { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10 },
  heroCtaText:  { color: Colors.bg, fontWeight: '700', fontSize: 13 },

  // No event / error
  noEventCard: { marginBottom: 24, alignItems: 'center', gap: 12 },
  noEventText: { color: Colors.textSecondary, fontSize: 14, textAlign: 'center', paddingVertical: 8 },
  retryBtn: {
    backgroundColor: Colors.limeDim, borderRadius: Radius.pill,
    paddingHorizontal: 20, paddingVertical: 8,
    borderWidth: 1, borderColor: Colors.lime + '40',
  },
  retryText: { color: Colors.lime, fontSize: 13, fontWeight: '700' },

  // Section
  section:       { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle:  { color: Colors.textPrimary, fontSize: 17, fontWeight: '700' },
  seeAll:        { color: Colors.lime, fontSize: 13 },

  // Podium
  podiumRow:       { flexDirection: 'row', gap: 10 },
  podiumCard:      { flex: 1 },
  podiumCardFirst: { flex: 1.2 },
  podiumInner:     { alignItems: 'center', gap: 6 },
  podiumRank:      { fontSize: 18 },
  podiumRankFirst: { fontSize: 22 },
  podiumName:      { color: Colors.textPrimary, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  podiumScore:     { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },

  // Quick grid
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickItem: { width: '47.5%' },
  quickCard: { alignItems: 'center', gap: 10 },
  quickIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { color: Colors.textPrimary, fontSize: 13, fontWeight: '600' },
});
