import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, Modal, TextInput, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { eventsApi, roundsApi, scoresApi } from '../../services/api';
import AvatarRing from '../../components/ui/AvatarRing';
import GlassCard from '../../components/ui/GlassCard';
import SkeletonLoader from '../../components/ui/SkeletonLoader';
import { Colors, Radius, Spacing } from '../../constants/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

interface HoleInfo {
  holeNumber: number;
  par: number;
}

interface ScoreEntry {
  holeNumber: number;
  strokes: number;
}

interface Player {
  id: string;
  name: string;
  avatar?: string | null;
}

interface Scorecard {
  holes: HoleInfo[];
  players: Player[];
  scores: Record<string, ScoreEntry[]>;
}

interface Round {
  id: string;
  courseName?: string;
  date: string;
  status?: string;
}

interface Event {
  id: string;
  name: string;
  isActive?: boolean;
  rounds?: Round[];
}

// ─── Score coloring ───────────────────────────────────────────────────────────

function scoreColor(strokes: number, par: number): string {
  const diff = strokes - par;
  if (diff <= -2) return Colors.eagle;   // Eagle or better → purple
  if (diff === -1) return Colors.birdie; // Birdie          → lime
  if (diff === 0)  return Colors.par;    // Par             → white
  if (diff === 1)  return Colors.bogey;  // Bogey           → orange
  return Colors.doubleBogey;             // Double+         → red
}

function scoreBackground(strokes: number, par: number): string {
  const diff = strokes - par;
  if (diff <= -2) return Colors.eagle + '33';
  if (diff === -1) return Colors.birdie + '22';
  if (diff === 0)  return Colors.bgTertiary;
  if (diff === 1)  return Colors.bogey + '22';
  return Colors.doubleBogey + '22';
}

// ─── Score input modal ────────────────────────────────────────────────────────

interface ScoreInputModalProps {
  visible: boolean;
  playerName: string;
  holeNumber: number;
  par: number;
  currentStrokes?: number;
  onClose: () => void;
  onSubmit: (strokes: number) => void;
  submitting: boolean;
}

function ScoreInputModal({
  visible, playerName, holeNumber, par,
  currentStrokes, onClose, onSubmit, submitting,
}: ScoreInputModalProps) {
  const [value, setValue] = useState(currentStrokes?.toString() ?? '');
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) setValue(currentStrokes?.toString() ?? '');
  }, [visible, currentStrokes]);

  function handleSubmit() {
    const n = parseInt(value, 10);
    if (isNaN(n) || n < 1 || n > 20) {
      Alert.alert('Invalid', 'Enter a stroke count between 1 and 20.'); return;
    }
    onSubmit(n);
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={mStyles.overlay}>
        <View style={[mStyles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={mStyles.title}>Hole {holeNumber} · Par {par}</Text>
          <Text style={mStyles.sub}>{playerName}</Text>
          <TextInput
            style={mStyles.input}
            value={value}
            onChangeText={setValue}
            keyboardType="number-pad"
            maxLength={2}
            autoFocus
            selectTextOnFocus
            placeholder="0"
            placeholderTextColor={Colors.textMuted}
          />
          {/* Quick buttons */}
          <View style={mStyles.quickRow}>
            {[-1, 0, 1, 2].map(offset => {
              const strokes = par + offset;
              const label = offset < 0 ? `${strokes} (${offset})` : offset === 0 ? `${strokes} (E)` : `${strokes} (+${offset})`;
              return (
                <TouchableOpacity
                  key={offset}
                  style={[mStyles.quickBtn, { backgroundColor: scoreBackground(strokes, par), borderColor: scoreColor(strokes, par) + '66' }]}
                  onPress={() => setValue(strokes.toString())}
                >
                  <Text style={[mStyles.quickBtnText, { color: scoreColor(strokes, par) }]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={mStyles.btnRow}>
            <TouchableOpacity style={mStyles.cancelBtn} onPress={onClose}>
              <Text style={mStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[mStyles.submitBtn, submitting && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting
                ? <ActivityIndicator color={Colors.bg} size="small" />
                : <Text style={mStyles.submitText}>Save Score</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const mStyles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.bgSecondary,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: Spacing.md, paddingTop: 24,
    gap: 12,
  },
  title: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  sub:   { color: Colors.textSecondary, fontSize: 13, textAlign: 'center', marginBottom: 4 },
  input: {
    backgroundColor: Colors.bg, borderWidth: 2, borderColor: Colors.lime + '66',
    borderRadius: Radius.md, paddingVertical: 14, paddingHorizontal: 20,
    color: Colors.textPrimary, fontSize: 32, fontWeight: '800',
    textAlign: 'center',
  },
  quickRow: { flexDirection: 'row', gap: 8 },
  quickBtn: {
    flex: 1, borderRadius: Radius.md, paddingVertical: 10,
    alignItems: 'center', borderWidth: 1,
  },
  quickBtnText: { fontSize: 12, fontWeight: '700' },
  btnRow: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: Radius.md,
    alignItems: 'center', backgroundColor: Colors.bgTertiary,
  },
  cancelText: { color: Colors.textSecondary, fontSize: 15, fontWeight: '600' },
  submitBtn: {
    flex: 2, paddingVertical: 14, borderRadius: Radius.md,
    alignItems: 'center', backgroundColor: Colors.lime,
  },
  submitText: { color: Colors.bg, fontSize: 15, fontWeight: '800' },
});

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminScoresScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedRoundId, setSelectedRoundId] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Score input modal state
  const [scoreModal, setScoreModal] = useState<{
    visible: boolean;
    playerId: string;
    playerName: string;
    holeNumber: number;
    par: number;
    currentStrokes?: number;
  }>({ visible: false, playerId: '', playerName: '', holeNumber: 1, par: 4 });

  // ── Data ──────────────────────────────────────────────────────────────────

  const { data: events = [], isLoading: eventsLoading, error: eventsError, refetch: refetchEvents } = useQuery<Event[]>({
    queryKey: ['score-events'],
    queryFn: () => eventsApi.list() as Promise<Event[]>,
  });

  // Set initial selections
  useEffect(() => {
    if (events.length > 0 && !selectedEventId) {
      const active = events.find(e => e.isActive) ?? events[0];
      setSelectedEventId(active.id);
      const rounds = active.rounds ?? [];
      if (rounds.length > 0) setSelectedRoundId(rounds[0].id);
    }
  }, [events]);

  // When event changes, set first round
  const selectedEvent = events.find(e => e.id === selectedEventId);
  const rounds: Round[] = (selectedEvent as any)?.rounds ?? [];

  useEffect(() => {
    if (rounds.length > 0 && !rounds.find(r => r.id === selectedRoundId)) {
      setSelectedRoundId(rounds[0].id);
    }
  }, [selectedEventId, rounds]);

  const { data: scorecard, isLoading: scorecardLoading, refetch: refetchScorecard } = useQuery<Scorecard>({
    queryKey: ['scorecard', selectedRoundId],
    queryFn: () => roundsApi.scorecard(selectedRoundId) as Promise<Scorecard>,
    enabled: !!selectedRoundId,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchEvents(), refetchScorecard()]);
    setRefreshing(false);
  }, [refetchEvents, refetchScorecard]);

  // ── Submit score ──────────────────────────────────────────────────────────

  const submitMutation = useMutation({
    mutationFn: (data: { roundId: string; userId: string; holeNumber: number; strokes: number }) =>
      scoresApi.submit(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scorecard', selectedRoundId] });
      setScoreModal(prev => ({ ...prev, visible: false }));
    },
    onError: () => Alert.alert('Error', 'Failed to save score. Please try again.'),
  });

  function openScoreModal(player: Player, hole: HoleInfo, currentStrokes?: number) {
    setScoreModal({
      visible: true,
      playerId: player.id,
      playerName: player.name,
      holeNumber: hole.holeNumber,
      par: hole.par,
      currentStrokes,
    });
  }

  function handleScoreSubmit(strokes: number) {
    submitMutation.mutate({
      roundId: selectedRoundId,
      userId: scoreModal.playerId,
      holeNumber: scoreModal.holeNumber,
      strokes,
    });
  }

  // ── Derived totals ────────────────────────────────────────────────────────

  function getPlayerTotal(playerId: string): number {
    const playerScores = scorecard?.scores[playerId] ?? [];
    return playerScores.reduce((sum, s) => sum + (s.strokes ?? 0), 0);
  }

  function getHoleTotal(holeNumber: number): number {
    if (!scorecard) return 0;
    return scorecard.players.reduce((sum, player) => {
      const playerScores = scorecard.scores[player.id] ?? [];
      const hs = playerScores.find(s => s.holeNumber === holeNumber);
      return sum + (hs?.strokes ?? 0);
    }, 0);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const isLoading = eventsLoading || scorecardLoading;
  const selectedRound = rounds.find(r => r.id === selectedRoundId);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Score Entry</Text>
        {isLoading && <ActivityIndicator color={Colors.lime} size="small" />}
      </View>

      <ScrollView
        contentContainerStyle={styles.outerContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.lime} />
        }
      >
        {/* Error */}
        {eventsError && (
          <GlassCard style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={20} color={Colors.error} />
            <Text style={styles.errorText}>Failed to load events.</Text>
            <TouchableOpacity onPress={() => refetchEvents()}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </GlassCard>
        )}

        {/* Event selector */}
        <Text style={styles.sectionLabel}>EVENT</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          {events.map(e => (
            <TouchableOpacity
              key={e.id}
              style={[styles.chip, selectedEventId === e.id && styles.chipActive]}
              onPress={() => setSelectedEventId(e.id)}
            >
              <Text style={[styles.chipText, selectedEventId === e.id && styles.chipTextActive]}>
                {e.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Round selector */}
        {rounds.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>ROUND</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {rounds.map(r => (
                <TouchableOpacity
                  key={r.id}
                  style={[styles.chip, selectedRoundId === r.id && styles.chipActive]}
                  onPress={() => setSelectedRoundId(r.id)}
                >
                  <Text style={[styles.chipText, selectedRoundId === r.id && styles.chipTextActive]}>
                    {r.courseName ?? 'Round'} ·{' '}
                    {new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {/* Score grid */}
        {scorecardLoading && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={Colors.lime} />
            <Text style={styles.loadingText}>Loading scorecard...</Text>
          </View>
        )}

        {scorecard && !scorecardLoading && (
          <>
            <Text style={styles.sectionLabel}>SCORECARD</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false}>
              <View>
                {/* Header row */}
                <View style={styles.gridRow}>
                  {/* Player column header */}
                  <View style={[styles.playerCol, styles.gridHeaderCell]}>
                    <Text style={styles.gridHeaderText}>Player</Text>
                  </View>
                  {/* Hole headers */}
                  {scorecard.holes.map(h => (
                    <View key={h.holeNumber} style={[styles.holeCol, styles.gridHeaderCell]}>
                      <Text style={styles.gridHeaderText}>{h.holeNumber}</Text>
                      <Text style={styles.parLabel}>p{h.par}</Text>
                    </View>
                  ))}
                  {/* Total */}
                  <View style={[styles.totalCol, styles.gridHeaderCell]}>
                    <Text style={styles.gridHeaderText}>TOT</Text>
                  </View>
                </View>

                {/* Player rows */}
                {scorecard.players.map((player, pIdx) => {
                  const playerScores = scorecard.scores[player.id] ?? [];
                  const total = getPlayerTotal(player.id);
                  return (
                    <View
                      key={player.id}
                      style={[styles.gridRow, pIdx % 2 === 1 && styles.gridRowAlt]}
                    >
                      {/* Player cell */}
                      <View style={styles.playerCol}>
                        <AvatarRing uri={player.avatar} name={player.name} size={22} ring="none" />
                        <Text style={styles.playerCellName} numberOfLines={1}>
                          {player.name.split(' ')[0]}
                        </Text>
                      </View>

                      {/* Score cells */}
                      {scorecard.holes.map(hole => {
                        const scoreEntry = playerScores.find(s => s.holeNumber === hole.holeNumber);
                        const strokes = scoreEntry?.strokes;
                        const hasScore = strokes != null;

                        return (
                          <TouchableOpacity
                            key={hole.holeNumber}
                            style={[
                              styles.holeCol,
                              styles.scoreCellBtn,
                              hasScore && {
                                backgroundColor: scoreBackground(strokes!, hole.par),
                              },
                            ]}
                            onPress={() => openScoreModal(player, hole, strokes)}
                            activeOpacity={0.7}
                          >
                            {hasScore ? (
                              <Text style={[
                                styles.scoreCellText,
                                { color: scoreColor(strokes!, hole.par) },
                              ]}>
                                {strokes}
                              </Text>
                            ) : (
                              <Ionicons name="add" size={14} color={Colors.textMuted} />
                            )}
                          </TouchableOpacity>
                        );
                      })}

                      {/* Total cell */}
                      <View style={[styles.totalCol, styles.totalCell]}>
                        <Text style={styles.totalCellText}>{total > 0 ? total : '—'}</Text>
                      </View>
                    </View>
                  );
                })}

                {/* Totals row (sum per hole) */}
                <View style={[styles.gridRow, styles.totalsRow]}>
                  <View style={styles.playerCol}>
                    <Text style={styles.totalsLabel}>FIELD</Text>
                  </View>
                  {scorecard.holes.map(hole => {
                    const total = getHoleTotal(hole.holeNumber);
                    return (
                      <View key={hole.holeNumber} style={[styles.holeCol, styles.totalCell]}>
                        <Text style={styles.totalCellText}>{total > 0 ? total : '—'}</Text>
                      </View>
                    );
                  })}
                  <View style={[styles.totalCol, styles.totalCell]}>
                    <Text style={styles.totalsLabel}>—</Text>
                  </View>
                </View>
              </View>
            </ScrollView>

            {/* Color legend */}
            <View style={styles.legendWrap}>
              <Text style={styles.legendTitle}>LEGEND</Text>
              <View style={styles.legendRow}>
                {[
                  { label: 'Eagle', color: Colors.eagle },
                  { label: 'Birdie', color: Colors.birdie },
                  { label: 'Par', color: Colors.par },
                  { label: 'Bogey', color: Colors.bogey },
                  { label: 'Double+', color: Colors.doubleBogey },
                ].map(item => (
                  <View key={item.label} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                    <Text style={styles.legendLabel}>{item.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}

        {!scorecardLoading && !scorecard && selectedRoundId && (
          <GlassCard style={styles.emptyCard}>
            <Ionicons name="clipboard-outline" size={36} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No scorecard data</Text>
            <Text style={styles.emptySub}>Scorecard will appear once players are assigned to this round.</Text>
          </GlassCard>
        )}
      </ScrollView>

      {/* Score input modal */}
      <ScoreInputModal
        visible={scoreModal.visible}
        playerName={scoreModal.playerName}
        holeNumber={scoreModal.holeNumber}
        par={scoreModal.par}
        currentStrokes={scoreModal.currentStrokes}
        onClose={() => setScoreModal(prev => ({ ...prev, visible: false }))}
        onSubmit={handleScoreSubmit}
        submitting={submitMutation.isPending}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const PLAYER_COL_W = 110;
const HOLE_COL_W = 44;
const TOTAL_COL_W = 52;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: Spacing.md, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.cardBorder,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.bgSecondary,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { flex: 1, color: Colors.textPrimary, fontSize: 18, fontWeight: '800' },

  errorCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 12,
    backgroundColor: Colors.error + '11', borderColor: Colors.error + '33',
  },
  errorText: { flex: 1, color: Colors.error, fontSize: 13 },
  retryText:  { color: Colors.lime, fontSize: 13, fontWeight: '700' },

  outerContent: { paddingHorizontal: Spacing.md, paddingBottom: 120 },

  sectionLabel: {
    color: Colors.textSecondary, fontSize: 11, fontWeight: '700',
    letterSpacing: 1, marginBottom: 8, marginTop: 16,
  },

  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: Radius.pill, borderWidth: 1.5, borderColor: Colors.cardBorder,
    backgroundColor: Colors.bgSecondary, marginRight: 8,
  },
  chipActive:     { backgroundColor: Colors.lime + '22', borderColor: Colors.lime + '66' },
  chipText:       { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: Colors.lime },

  loadingWrap: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  loadingText: { color: Colors.textSecondary, fontSize: 13 },

  // Grid
  gridRow: {
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: Colors.cardBorder + '55',
  },
  gridRowAlt: { backgroundColor: Colors.bgSecondary + '55' },

  gridHeaderCell: {
    backgroundColor: Colors.bgTertiary,
    paddingVertical: 8, alignItems: 'center', justifyContent: 'center',
  },
  gridHeaderText: { color: Colors.lime, fontSize: 10, fontWeight: '700' },
  parLabel:       { color: Colors.textMuted, fontSize: 9, marginTop: 1 },

  playerCol: {
    width: PLAYER_COL_W, flexDirection: 'row',
    alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 6,
  },
  playerCellName: {
    color: Colors.textPrimary, fontSize: 11, fontWeight: '600', flex: 1,
  },

  holeCol: { width: HOLE_COL_W, alignItems: 'center', justifyContent: 'center' },

  scoreCellBtn: {
    height: 36, width: HOLE_COL_W, alignItems: 'center', justifyContent: 'center',
    borderRadius: 4,
  },
  scoreCellText: { fontSize: 14, fontWeight: '800' },

  totalCol: { width: TOTAL_COL_W, alignItems: 'center', justifyContent: 'center' },
  totalCell: { paddingVertical: 6 },
  totalCellText: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },

  totalsRow: { backgroundColor: Colors.bgSecondary },
  totalsLabel: { color: Colors.textSecondary, fontSize: 10, fontWeight: '700' },

  // Legend
  legendWrap: { marginTop: 20 },
  legendTitle: { color: Colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  legendRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:   { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { color: Colors.textSecondary, fontSize: 11 },

  // Empty
  emptyCard: { alignItems: 'center', gap: 8, paddingVertical: 32 },
  emptyText: { color: Colors.textSecondary, fontSize: 15, fontWeight: '600' },
  emptySub:  { color: Colors.textMuted, fontSize: 12, textAlign: 'center', paddingHorizontal: 16 },
});
