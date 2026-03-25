import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { eventsApi, roundsApi } from '../../services/api';
import { Event, Round, Scorecard } from '@the-caddy/shared';
import ScoreBadge from '../../components/ui/ScoreBadge';
import AvatarRing from '../../components/ui/AvatarRing';
import GlassCard from '../../components/ui/GlassCard';
import BottomSheet from '../../components/ui/BottomSheet';
import { SkeletonCard } from '../../components/ui/SkeletonLoader';
import { Colors, Radius, Spacing } from '../../constants/theme';

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [scorecards, setScorecards] = useState<Record<string, Scorecard>>({});
  const [sheetRoundId, setSheetRoundId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      const events = await eventsApi.list();
      const active = events.find((e: Event) => e.isActive) || events[0] || null;
      setEvent(active);
    } catch { } finally { setLoading(false); }
  }

  async function openScorecard(roundId: string) {
    if (!scorecards[roundId]) {
      try {
        const sc = await roundsApi.scorecard(roundId);
        setScorecards(prev => ({ ...prev, [roundId]: sc }));
      } catch { }
    }
    setSheetRoundId(roundId);
  }

  useEffect(() => { load(); }, []);
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, []);

  const rounds: Round[] = (event as any)?.rounds || [];
  const activeScorecard = sheetRoundId ? scorecards[sheetRoundId] : null;
  const activeRound = rounds.find(r => r.id === sheetRoundId);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.pageTitle}>Schedule</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 100 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.lime} />}
        showsVerticalScrollIndicator={false}
      >
        {event && (
          <View style={styles.eventInfo}>
            <Text style={styles.eventName}>{event.name}</Text>
            <Text style={styles.eventSub}>{rounds.length} round{rounds.length !== 1 ? 's' : ''} · {event.location}</Text>
          </View>
        )}

        {loading ? (
          [1, 2].map(i => <SkeletonCard key={i} />)
        ) : rounds.length === 0 ? (
          <GlassCard>
            <Text style={styles.empty}>No rounds scheduled yet.</Text>
          </GlassCard>
        ) : rounds.map(round => {
          const isComplete = round.isComplete;
          return (
            <TouchableOpacity
              key={round.id}
              activeOpacity={0.85}
              onPress={() => openScorecard(round.id)}
              style={styles.roundCard}
            >
              {/* Course photo background */}
              {round.coursePhoto ? (
                <Image source={{ uri: round.coursePhoto }} style={styles.cardBg} />
              ) : (
                <LinearGradient colors={['#1A1A2E', '#0A0A0F']} style={styles.cardBg} />
              )}
              <LinearGradient
                colors={['rgba(10,10,15,0)', 'rgba(10,10,15,0.97)']}
                style={styles.cardOverlay}
              />

              {/* Status badge */}
              <View style={[styles.statusBadge, isComplete ? styles.statusBadgeComplete : styles.statusBadgeLive]}>
                {!isComplete && <View style={styles.statusDot} />}
                <Text style={[styles.statusText, isComplete ? { color: Colors.lime } : { color: Colors.warning }]}>
                  {isComplete ? 'Complete' : 'In Progress'}
                </Text>
              </View>

              {/* Info */}
              <View style={styles.cardContent}>
                <Text style={styles.courseName}>{round.courseName}</Text>
                <View style={styles.cardMeta}>
                  <Ionicons name="calendar-outline" size={12} color={Colors.textSecondary} />
                  <Text style={styles.cardMetaText}>
                    {new Date(round.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </Text>
                  <Text style={styles.cardDot}>·</Text>
                  <Text style={styles.cardMetaText}>Round {rounds.indexOf(round) + 1}</Text>
                </View>
                <View style={styles.cardAction}>
                  <Text style={styles.cardActionText}>View Scorecard</Text>
                  <Ionicons name="chevron-forward" size={14} color={Colors.lime} />
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Scorecard bottom sheet */}
      <BottomSheet
        visible={!!sheetRoundId}
        onClose={() => setSheetRoundId(null)}
        snapHeight={600}
      >
        {activeRound && (
          <View style={styles.sheetContent}>
            <Text style={styles.sheetTitle}>{activeRound.courseName}</Text>
            <Text style={styles.sheetSub}>
              {new Date(activeRound.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </Text>

            {activeScorecard ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View>
                  {/* Hole header */}
                  <View style={styles.scRow}>
                    <View style={styles.scPlayerCol}>
                      <Text style={styles.scHeaderCell}>Player</Text>
                    </View>
                    {activeScorecard.holes.map(h => (
                      <View key={h.holeNumber} style={styles.scHoleCol}>
                        <Text style={styles.scHeaderCell}>{h.holeNumber}</Text>
                        <Text style={styles.scParCell}>p{h.par}</Text>
                      </View>
                    ))}
                    <View style={styles.scTotalCol}>
                      <Text style={styles.scHeaderCell}>TOT</Text>
                    </View>
                  </View>

                  {/* Player rows */}
                  {activeScorecard.players.map(player => {
                    const pScores = activeScorecard.scores[player.id] || [];
                    const total = pScores.reduce((s, sc) => s + sc.strokes, 0);
                    return (
                      <View key={player.id} style={[styles.scRow, styles.scRowBorder]}>
                        <View style={styles.scPlayerCol}>
                          <AvatarRing uri={player.avatar} name={player.name} size={22} />
                          <Text style={styles.scPlayerName} numberOfLines={1}>
                            {player.name.split(' ')[0]}
                          </Text>
                        </View>
                        {activeScorecard.holes.map(h => {
                          const score = pScores.find(s => s.holeNumber === h.holeNumber);
                          return (
                            <View key={h.holeNumber} style={styles.scHoleCol}>
                              {score ? (
                                <ScoreBadge strokes={score.strokes} par={h.par} size="sm" />
                              ) : (
                                <Text style={styles.scEmpty}>–</Text>
                              )}
                            </View>
                          );
                        })}
                        <View style={styles.scTotalCol}>
                          <Text style={styles.scTotal}>{total || '–'}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            ) : (
              <View style={styles.loadingSheet}>
                <Ionicons name="golf-outline" size={28} color={Colors.textMuted} />
                <Text style={styles.loadingText}>Loading scorecard...</Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.fullScorecardBtn}
              onPress={() => { setSheetRoundId(null); router.push(`/round/${sheetRoundId}` as any); }}
            >
              <Text style={styles.fullScorecardText}>Open Full Scorecard</Text>
              <Ionicons name="expand-outline" size={15} color={Colors.lime} />
            </TouchableOpacity>
          </View>
        )}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },

  header:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: 16 },
  backBtn:  { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.bgSecondary, borderWidth: 1, borderColor: Colors.cardBorder, alignItems: 'center', justifyContent: 'center' },
  pageTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700' },

  scroll:     { padding: Spacing.md },
  eventInfo:  { marginBottom: 20 },
  eventName:  { color: Colors.textPrimary, fontSize: 20, fontWeight: '800' },
  eventSub:   { color: Colors.textSecondary, fontSize: 13, marginTop: 4 },
  empty:      { color: Colors.textSecondary, textAlign: 'center', paddingVertical: 12 },

  // Round cards
  roundCard: {
    height: 200, borderRadius: Radius.xl, overflow: 'hidden',
    marginBottom: 14, position: 'relative',
  },
  cardBg:      { ...StyleSheet.absoluteFillObject, resizeMode: 'cover' } as any,
  cardOverlay: { ...StyleSheet.absoluteFillObject },
  statusBadge: {
    position: 'absolute', top: 14, right: 14,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: 'rgba(10,10,15,0.7)', borderWidth: 1, borderColor: Colors.cardBorder,
  },
  statusBadgeComplete: { borderColor: Colors.lime + '40' },
  statusBadgeLive:     { borderColor: Colors.warning + '40' },
  statusDot:   { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.warning },
  statusText:  { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  cardContent: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16 },
  courseName:  { color: Colors.textPrimary, fontSize: 18, fontWeight: '800', marginBottom: 6 },
  cardMeta:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  cardMetaText: { color: Colors.textSecondary, fontSize: 12 },
  cardDot:     { color: Colors.textMuted },
  cardAction:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardActionText: { color: Colors.lime, fontSize: 13, fontWeight: '600' },

  // Bottom sheet
  sheetContent: { paddingHorizontal: 16, paddingBottom: 8 },
  sheetTitle:   { color: Colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 4 },
  sheetSub:     { color: Colors.textSecondary, fontSize: 13, marginBottom: 20 },

  scRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  scRowBorder: { borderTopWidth: 1, borderTopColor: Colors.cardBorder },
  scPlayerCol: { width: 90, flexDirection: 'row', alignItems: 'center', gap: 6 },
  scHoleCol:   { width: 34, alignItems: 'center', marginHorizontal: 2 },
  scTotalCol:  { width: 40, alignItems: 'center' },
  scHeaderCell: { color: Colors.lime, fontSize: 10, fontWeight: '700' },
  scParCell:    { color: Colors.textMuted, fontSize: 9 },
  scPlayerName: { color: Colors.textPrimary, fontSize: 12, flex: 1 },
  scEmpty:      { color: Colors.textMuted, fontSize: 12 },
  scTotal:      { color: Colors.lime, fontWeight: '700', fontSize: 14 },

  loadingSheet: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  loadingText:  { color: Colors.textSecondary, fontSize: 14 },

  fullScorecardBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 16, borderRadius: Radius.pill,
    borderWidth: 1, borderColor: Colors.lime + '40',
    paddingVertical: 12,
  },
  fullScorecardText: { color: Colors.lime, fontSize: 14, fontWeight: '600' },
});
