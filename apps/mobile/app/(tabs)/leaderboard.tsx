import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, Animated, Share, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { useEvents, useEventLeaderboard } from '../../hooks/useQueries';
import { useLeaderboardSocket } from '../../hooks/useSocket';
import { Event } from '@the-caddy/shared';
import AvatarRing from '../../components/ui/AvatarRing';
import GlassCard from '../../components/ui/GlassCard';
import SkeletonLoader from '../../components/ui/SkeletonLoader';
import { Colors, Radius, Spacing } from '../../constants/theme';

export default function LeaderboardTab() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const [mode, setMode] = useState<'net' | 'gross'>('net');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [showEventPicker, setShowEventPicker] = useState(false);
  const refreshAnim = useRef(new Animated.Value(0)).current;

  // ─── Queries ─────────────────────────────────────────────────────────────
  const { data: events = [], isLoading: eventsLoading } = useEvents();
  const eventList = events as Event[];

  // Auto-select active event or first event
  useEffect(() => {
    if (eventList.length > 0 && !selectedEventId) {
      const active = eventList.find(e => e.isActive) || eventList[0];
      setSelectedEventId(active.id);
    }
  }, [eventList]);

  const {
    data: leaderboard = [],
    isLoading: lbLoading,
    error: lbError,
    refetch: refetchLb,
  } = useEventLeaderboard(selectedEventId ?? '');

  const selectedEvent = eventList.find(e => e.id === selectedEventId) ?? null;
  const loading = eventsLoading || lbLoading;

  // ─── Socket live updates ──────────────────────────────────────────────────
  useLeaderboardSocket(selectedEventId, () => {
    qc.invalidateQueries({ queryKey: ['leaderboard', selectedEventId] });
    Animated.sequence([
      Animated.timing(refreshAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(refreshAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  });

  // ─── Pull-to-refresh ─────────────────────────────────────────────────────
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['events'] }),
      qc.invalidateQueries({ queryKey: ['leaderboard', selectedEventId] }),
    ]);
    setRefreshing(false);
  };

  const sorted = [...(leaderboard as any[])].sort((a, b) =>
    mode === 'net' ? a.netScore - b.netScore : a.grossScore - b.grossScore
  ).map((e, i) => ({ ...e, displayRank: i + 1 }));

  const scoreColor = (score: number) =>
    score < 0 ? Colors.gold : score > 0 ? Colors.warning : Colors.textSecondary;

  const formatScore = (score: number) =>
    score === 0 ? 'E' : score > 0 ? `+${score}` : `${score}`;

  const posIcon = (change: string) => {
    if (change === 'up') return <Ionicons name="chevron-up" size={12} color={Colors.lime} />;
    if (change === 'down') return <Ionicons name="chevron-down" size={12} color={Colors.warning} />;
    return <View style={{ width: 12 }} />;
  };

  const [top1, top2, top3, ...rest] = sorted;

  // Spec: Share button — native share with leaderboard text
  async function handleShare() {
    try {
      const lines = sorted.slice(0, 5).map((e, i) =>
        `${i + 1}. ${e.user.name} — ${formatScore(mode === 'net' ? e.netScore : e.grossScore)}`
      );
      await Share.share({
        title: selectedEvent?.name ?? 'Leaderboard',
        message: [
          selectedEvent?.name ?? 'Leaderboard',
          `(${mode.toUpperCase()})`,
          '',
          ...lines,
          '',
          'Powered by The Caddy',
        ].join('\n'),
      });
    } catch {
      // user dismissed
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text style={styles.pageTitle}>LEADERBOARD</Text>
          {/* Event selector */}
          {eventList.length > 1 ? (
            <TouchableOpacity
              style={styles.eventPicker}
              onPress={() => setShowEventPicker(v => !v)}
            >
              <Text style={styles.eventName} numberOfLines={1}>
                {selectedEvent?.name ?? 'Select event'}
              </Text>
              <Ionicons name="chevron-down" size={14} color={Colors.textSecondary} />
            </TouchableOpacity>
          ) : selectedEvent ? (
            <Text style={styles.eventName} numberOfLines={1}>{selectedEvent.name}</Text>
          ) : null}
        </View>

        {/* Share button */}
        <TouchableOpacity
          onPress={handleShare}
          style={styles.shareBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="share-outline" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>

        {/* NET | GROSS toggle with gradient on active */}
        <View style={styles.modeToggle}>
          {(['net', 'gross'] as const).map(m => (
            <TouchableOpacity
              key={m}
              style={styles.modeBtnWrap}
              onPress={() => setMode(m)}
            >
              {mode === m ? (
                <LinearGradient
                  colors={['#F0C866', '#C4912A']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.modeBtnActive}
                >
                  <Text style={styles.modeBtnTextActive}>{m.toUpperCase()}</Text>
                </LinearGradient>
              ) : (
                <View style={styles.modeBtn}>
                  <Text style={styles.modeBtnText}>{m.toUpperCase()}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Event picker dropdown */}
      {showEventPicker && eventList.length > 1 && (
        <GlassCard style={styles.dropdown} padding={8}>
          {eventList.map(e => (
            <TouchableOpacity
              key={e.id}
              style={[styles.dropdownItem, selectedEventId === e.id && styles.dropdownItemActive]}
              onPress={() => { setSelectedEventId(e.id); setShowEventPicker(false); }}
            >
              <Text style={[styles.dropdownText, selectedEventId === e.id && styles.dropdownTextActive]}>
                {e.name}
              </Text>
              {e.isActive && <View style={styles.activeDot} />}
            </TouchableOpacity>
          ))}
        </GlassCard>
      )}

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />
        }
      >
        {/* Empty state when no event selected */}
        {!selectedEventId && !loading && (
          <View style={styles.emptyState}>
            <Ionicons name="trophy-outline" size={40} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No event selected</Text>
            <Text style={styles.emptySub}>Select an event above to view its leaderboard.</Text>
          </View>
        )}

        {loading ? (
          <View style={{ gap: 12, padding: Spacing.md }}>
            {[1,2,3,4,5].map(i => <SkeletonLoader key={i} height={60} borderRadius={Radius.lg} />)}
          </View>
        ) : lbError ? (
          <View style={styles.emptyState}>
            <Ionicons name="alert-circle-outline" size={40} color={Colors.error} />
            <Text style={styles.emptyTitle}>Failed to load leaderboard</Text>
            <TouchableOpacity onPress={() => refetchLb()} style={styles.retryBtn}>
              <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : sorted.length === 0 && selectedEventId ? (
          <View style={styles.emptyState}>
            <Ionicons name="trophy-outline" size={40} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No scores yet</Text>
            <Text style={styles.emptySub}>Scores will appear here once the round starts.</Text>
          </View>
        ) : (
          <>
            {/* Podium — top 3 */}
            {top1 && (
              <View style={styles.podiumSection}>
                {/* #1 hero card — full width, gold border */}
                <TouchableOpacity
                  style={styles.firstCard}
                  onPress={() => router.push(`/profile/${top1.user.id}` as any)}
                  activeOpacity={0.85}
                >
                  <LinearGradient colors={['#1A2340', '#0F1420']} style={styles.firstCardInner}>
                    <View style={styles.firstGlow} />
                    <View style={styles.firstLeft}>
                      <Ionicons name="trophy" size={28} color={Colors.gold} />
                      <AvatarRing
                        uri={top1.user.avatar}
                        name={top1.user.name}
                        size={52}
                        ring="lime"
                        ringWidth={2}
                      />
                      <View>
                        <Text style={styles.firstName}>{top1.user.name}</Text>
                        {top1.user.handicap != null && (
                          <Text style={styles.firstHcp}>HCP {top1.user.handicap}</Text>
                        )}
                      </View>
                    </View>
                    <View style={styles.firstRight}>
                      <Text style={[styles.firstScore, { color: scoreColor(mode === 'net' ? top1.netScore : top1.grossScore) }]}>
                        {formatScore(mode === 'net' ? top1.netScore : top1.grossScore)}
                      </Text>
                      <Text style={styles.firstScoreLabel}>{mode === 'net' ? 'NET' : 'GROSS'}</Text>
                      {top1.birdies != null && (
                        <View style={styles.birdieChip}>
                          <Text style={styles.birdieText}>🐦 {top1.birdies}</Text>
                        </View>
                      )}
                    </View>
                  </LinearGradient>
                </TouchableOpacity>

                {/* #2 and #3 side by side */}
                {(top2 || top3) && (
                  <View style={styles.podiumRow}>
                    {[top2, top3].filter(Boolean).map((entry, i) => entry && (
                      <TouchableOpacity
                        key={entry.user.id}
                        style={styles.podiumCard}
                        onPress={() => router.push(`/profile/${entry.user.id}` as any)}
                        activeOpacity={0.8}
                      >
                        <GlassCard padding={14} style={styles.podiumInner}>
                          <Text style={[styles.podiumMedal, { color: i === 0 ? '#C0C0C0' : '#CD7F32' }]}>{i === 0 ? '2' : '3'}</Text>
                          <AvatarRing uri={entry.user.avatar} name={entry.user.name} size={38} />
                          <Text style={styles.podiumName} numberOfLines={1}>{entry.user.name.split(' ')[0]}</Text>
                          <Text style={[styles.podiumScore, { color: scoreColor(mode === 'net' ? entry.netScore : entry.grossScore) }]}>
                            {formatScore(mode === 'net' ? entry.netScore : entry.grossScore)}
                          </Text>
                          {entry.birdies != null && (
                            <Text style={styles.podiumBirdies}>🐦 {entry.birdies}</Text>
                          )}
                        </GlassCard>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Rest of leaderboard */}
            {rest.length > 0 && (
              <GlassCard style={styles.listCard} padding={0}>
                {/* Column headers */}
                <View style={styles.tableHeader}>
                  <Text style={[styles.headerCell, { width: 40 }]}>#</Text>
                  <Text style={[styles.headerCell, { flex: 1 }]}>PLAYER</Text>
                  <Text style={[styles.headerCell, { width: 44, textAlign: 'right' }]}>
                    {mode === 'net' ? 'NET' : 'GROSS'}
                  </Text>
                  <Text style={[styles.headerCell, { width: 36, textAlign: 'right' }]}>BRD</Text>
                  <Text style={[styles.headerCell, { width: 36, textAlign: 'right' }]}>HLS</Text>
                </View>

                {rest.map((entry, i) => (
                  <Animated.View
                    key={entry.user.id}
                    style={{ opacity: refreshAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.5] }) }}
                  >
                    <TouchableOpacity
                      style={[styles.listRow, i < rest.length - 1 && styles.listRowBorder]}
                      onPress={() => router.push(`/profile/${entry.user.id}` as any)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.rankWrap}>
                        {posIcon(entry.positionChange)}
                        <Text style={styles.rankText}>{entry.displayRank}</Text>
                      </View>
                      <AvatarRing uri={entry.user.avatar} name={entry.user.name} size={34} />
                      <View style={styles.playerInfo}>
                        <Text style={styles.playerName}>{entry.user.name}</Text>
                        {entry.user.handicap != null && (
                          <Text style={styles.playerHcp}>HCP {entry.user.handicap}</Text>
                        )}
                      </View>
                      <Text style={[styles.scoreCell, { color: scoreColor(mode === 'net' ? entry.netScore : entry.grossScore) }]}>
                        {formatScore(mode === 'net' ? entry.netScore : entry.grossScore)}
                      </Text>
                      <Text style={styles.birdiesCell}>{entry.birdies ?? '–'}</Text>
                      <Text style={styles.holesCell}>{entry.holesPlayed}</Text>
                    </TouchableOpacity>
                  </Animated.View>
                ))}
              </GlassCard>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },

  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 16,
  },
  pageTitle: {
    color: Colors.gold,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 2,
  },
  eventName: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  eventPicker: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },

  dropdown: { marginHorizontal: Spacing.md, marginBottom: 8, zIndex: 10 },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownItemActive: { backgroundColor: Colors.goldDim },
  dropdownText: { color: Colors.textSecondary, fontSize: 14 },
  dropdownTextActive: { color: Colors.gold, fontWeight: '600' },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.gold },

  shareBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 8,
  },

  // Mode toggle — gold gradient on active
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.pill,
    padding: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modeBtnWrap: {},
  modeBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: Radius.pill },
  modeBtnActive: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: Radius.pill },
  modeBtnText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
  modeBtnTextActive: { color: Colors.bg, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },

  scroll: { paddingHorizontal: Spacing.md },

  emptyState: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyTitle: { color: Colors.textSecondary, fontSize: 16, fontWeight: '600' },
  emptySub: { color: Colors.textMuted, fontSize: 13, textAlign: 'center', paddingHorizontal: 40 },
  retryBtn: {
    backgroundColor: Colors.goldDim,
    borderRadius: Radius.pill,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.gold + '40',
  },
  retryText: { color: Colors.gold, fontSize: 13, fontWeight: '600' },

  // Podium
  podiumSection: { marginBottom: 16, gap: 10 },
  firstCard: {},
  firstCardInner: {
    borderRadius: Radius.xl,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    overflow: 'hidden',
  },
  firstGlow: {
    position: 'absolute',
    top: -30,
    left: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.gold,
    opacity: 0.07,
  },
  firstLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  firstName: { color: Colors.textPrimary, fontSize: 16, fontWeight: '600' },
  firstHcp: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  firstRight: { alignItems: 'flex-end', gap: 4 },
  firstScore: { fontSize: 32, fontWeight: '700', letterSpacing: -1 },
  firstScoreLabel: { color: Colors.textSecondary, fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginTop: 2 },
  birdieChip: {
    backgroundColor: Colors.goldDim,
    borderRadius: Radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.gold + '40',
    marginTop: 4,
  },
  birdieText: { color: Colors.gold, fontSize: 11, fontWeight: '600' },

  podiumRow: { flexDirection: 'row', gap: 10 },
  podiumCard: { flex: 1 },
  podiumInner: { alignItems: 'center', gap: 6 },
  podiumMedal: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  podiumName: { color: Colors.textPrimary, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  podiumScore: { fontSize: 20, fontWeight: '700', letterSpacing: -0.5 },
  podiumBirdies: { color: Colors.gold, fontSize: 11 },

  // List
  listCard: { marginBottom: 16 },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerCell: { color: Colors.textMuted, fontSize: 10, fontWeight: '600', letterSpacing: 0.8 },

  listRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  listRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  rankWrap: { width: 40, flexDirection: 'row', alignItems: 'center', gap: 2 },
  rankText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '500' },
  playerInfo: { flex: 1, marginLeft: 4 },
  playerName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  playerHcp: { color: Colors.textMuted, fontSize: 11, marginTop: 1 },
  scoreCell: { width: 44, textAlign: 'right', fontSize: 16, fontWeight: '600' },
  birdiesCell: { width: 36, textAlign: 'right', color: Colors.gold, fontSize: 13 },
  holesCell: { width: 36, textAlign: 'right', color: Colors.textMuted, fontSize: 13 },
});
