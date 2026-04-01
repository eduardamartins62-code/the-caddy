import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Modal, RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useRound, useScorecard } from '../../hooks/useQueries';
import { scoresApi, roundsApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import AvatarRing from '../../components/ui/AvatarRing';
import GlassCard from '../../components/ui/GlassCard';
import SkeletonLoader from '../../components/ui/SkeletonLoader';
import { Colors, Radius, Spacing } from '../../constants/theme';

// ─── Socket placeholder ────────────────────────────────────────────────────────
// TODO: import { socket } from '../../services/socket';

// ─── Score color helpers (per spec) ──────────────────────────────────────────

function holeScoreBgSolid(strokes: number, par: number): string {
  if (strokes === 0) return 'transparent';
  const rel = strokes - par;
  if (rel <= -2) return '#FFD700'; // eagle or better — gold
  if (rel === -1) return '#E8365D'; // birdie — red/pink
  if (rel === 0)  return '#3A3A4A'; // par — light grey
  if (rel === 1)  return '#4A90D9'; // bogey — light blue
  if (rel === 2)  return '#2C5F8A'; // double bogey — dark blue
  return '#1A1A2E';                 // triple+ — dark brown/dark
}

function holeScoreTextColor(strokes: number, par: number): string {
  if (strokes === 0) return Colors.textMuted;
  const rel = strokes - par;
  if (rel <= -2) return '#1A1A2E'; // dark text on gold
  if (rel === -1) return '#FFFFFF';
  if (rel === 0)  return Colors.textPrimary;
  return '#FFFFFF';
}

// Legacy color helper used in summary + number pad
function holeScoreColor(strokes: number, par: number): string {
  if (strokes === 0) return Colors.textMuted;
  const rel = strokes - par;
  if (rel <= -2) return Colors.eagle;
  if (rel === -1) return Colors.birdie;
  if (rel === 0)  return Colors.par;
  if (rel === 1)  return Colors.bogey;
  return Colors.doubleBogey;
}

function holeScoreBgLegacy(strokes: number, par: number): string {
  if (strokes === 0) return 'transparent';
  const rel = strokes - par;
  if (rel <= -2) return Colors.purple + '28';
  if (rel === -1) return Colors.lime + '22';
  if (rel === 0)  return 'transparent';
  if (rel === 1)  return Colors.bogey + '22';
  return Colors.doubleBogey + '22';
}

function relLabel(diff: number) {
  if (diff === 0) return 'E';
  return diff > 0 ? `+${diff}` : `${diff}`;
}

function fmt(d: string | Date | undefined | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function statusColors(status: string) {
  if (status === 'LIVE')      return { bg: '#EF444422', text: Colors.error };
  if (status === 'COMPLETED') return { bg: Colors.limeDim, text: Colors.lime };
  return { bg: Colors.purpleDim, text: Colors.purple };
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton({ insetTop }: { insetTop: number }) {
  return (
    <View style={[styles.screen, { paddingTop: insetTop }]}>
      <View style={styles.header}>
        <SkeletonLoader width={36} height={36} borderRadius={18} />
        <SkeletonLoader width={140} height={16} style={{ flex: 1 }} />
        <SkeletonLoader width={60} height={24} borderRadius={Radius.full} />
      </View>
      <View style={styles.infoCard}>
        {[1, 2].map((i) => <SkeletonLoader key={i} height={14} width="65%" style={{ marginBottom: 8 }} />)}
      </View>
      <View style={{ padding: Spacing.md, gap: 8 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <SkeletonLoader key={i} height={46} borderRadius={Radius.md} />
        ))}
      </View>
    </View>
  );
}

// ─── Number pad ───────────────────────────────────────────────────────────────

interface PadState {
  holeNumber:  number;
  par:         number;
  userId:      string;
  playerName:  string;
  current:     number;
}

interface ScoreExtras {
  fairwayHit?: boolean | null;
  greenInReg?: boolean;
  putts?:      number;
}

interface NumberPadProps extends PadState {
  visible:    boolean;
  onClose:    () => void;
  onSubmit:   (strokes: number, extras: ScoreExtras) => void;
  submitting: boolean;
}

function NumberPad({ visible, holeNumber, par, current, playerName, onClose, onSubmit, submitting }: NumberPadProps) {
  const [sel, setSel]             = useState(current || par);
  const [phase, setPhase]         = useState<'score' | 'extras'>('score');
  const [fairwayHit, setFairwayHit] = useState<boolean | null>(null);
  const [greenInReg, setGreenInReg] = useState<boolean | null>(null);
  const [putts, setPutts]         = useState(2);

  React.useEffect(() => {
    if (visible) {
      setSel(current || par);
      setPhase('score');
      setFairwayHit(null);
      setGreenInReg(null);
      setPutts(2);
    }
  }, [visible, current, par]);

  const color = holeScoreColor(sel, par);
  const rel   = sel > 0 ? sel - par : 0;
  const showFir = par >= 4; // FIR only for par 4 and 5

  function handleScoreSave() {
    if (sel === 0) return;
    setPhase('extras');
  }

  function handleExtrasSave() {
    onSubmit(sel, {
      fairwayHit: showFir ? fairwayHit ?? undefined : undefined,
      greenInReg: greenInReg ?? undefined,
      putts,
    });
  }

  function handleSkipExtras() {
    onSubmit(sel, {});
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={np.overlay}>
        <View style={np.sheet}>
          <View style={np.handle} />

          {phase === 'score' ? (
            <>
              <Text style={np.holeName}>Hole {holeNumber}</Text>
              <Text style={np.parText}>Par {par}  ·  {playerName}</Text>

              <View style={[np.scoreBox, { borderColor: color + '66' }]}>
                <Text style={[np.scoreNum, { color }]}>{sel || '—'}</Text>
                {sel > 0 && <Text style={[np.scoreRel, { color }]}>{relLabel(rel)}</Text>}
              </View>

              <View style={np.grid}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => {
                  const c  = holeScoreColor(n, par);
                  const bg = holeScoreBgLegacy(n, par);
                  const isActive = sel === n;
                  return (
                    <TouchableOpacity
                      key={n}
                      style={[np.numBtn, { backgroundColor: isActive ? c + '30' : bg }, isActive && { borderColor: c, borderWidth: 2 }]}
                      onPress={() => setSel(n)}
                      activeOpacity={0.7}
                    >
                      <Text style={[np.numText, { color: c }]}>{n}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={np.actions}>
                <TouchableOpacity style={np.cancelBtn} onPress={onClose}>
                  <Text style={np.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[np.saveBtn, (submitting || sel === 0) && { opacity: 0.55 }]}
                  onPress={handleScoreSave}
                  disabled={submitting || sel === 0}
                  activeOpacity={0.8}
                >
                  <Text style={np.saveText}>Next →</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={np.holeName}>Hole {holeNumber} — Quick Stats</Text>
              <Text style={np.parText}>Score: {sel} ({relLabel(rel)})  ·  Optional</Text>

              {/* FIR — only for par 4/5 */}
              {showFir && (
                <View style={np.extrasRow}>
                  <Text style={np.extrasLabel}>Fairway Hit (FIR)</Text>
                  <View style={np.btnPair}>
                    <TouchableOpacity
                      style={[np.toggleBtn, fairwayHit === true && np.toggleBtnActive]}
                      onPress={() => setFairwayHit(fairwayHit === true ? null : true)}
                    >
                      <Text style={[np.toggleText, fairwayHit === true && np.toggleTextActive]}>✓</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[np.toggleBtn, fairwayHit === false && np.toggleBtnDanger]}
                      onPress={() => setFairwayHit(fairwayHit === false ? null : false)}
                    >
                      <Text style={[np.toggleText, fairwayHit === false && np.toggleTextActive]}>✗</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* GIR — all holes */}
              <View style={np.extrasRow}>
                <Text style={np.extrasLabel}>Green in Reg (GIR)</Text>
                <View style={np.btnPair}>
                  <TouchableOpacity
                    style={[np.toggleBtn, greenInReg === true && np.toggleBtnActive]}
                    onPress={() => setGreenInReg(greenInReg === true ? null : true)}
                  >
                    <Text style={[np.toggleText, greenInReg === true && np.toggleTextActive]}>✓</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[np.toggleBtn, greenInReg === false && np.toggleBtnDanger]}
                    onPress={() => setGreenInReg(greenInReg === false ? null : false)}
                  >
                    <Text style={[np.toggleText, greenInReg === false && np.toggleTextActive]}>✗</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Putts stepper */}
              <View style={np.extrasRow}>
                <Text style={np.extrasLabel}>Putts</Text>
                <View style={np.stepper}>
                  <TouchableOpacity
                    style={np.stepBtn}
                    onPress={() => setPutts(Math.max(0, putts - 1))}
                  >
                    <Text style={np.stepText}>−</Text>
                  </TouchableOpacity>
                  <Text style={np.stepValue}>{putts}</Text>
                  <TouchableOpacity
                    style={np.stepBtn}
                    onPress={() => setPutts(Math.min(6, putts + 1))}
                  >
                    <Text style={np.stepText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={[np.actions, { marginTop: 20 }]}>
                <TouchableOpacity style={np.cancelBtn} onPress={handleSkipExtras}>
                  <Text style={np.cancelText}>Skip</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[np.saveBtn, submitting && { opacity: 0.55 }]}
                  onPress={handleExtrasSave}
                  disabled={submitting}
                  activeOpacity={0.8}
                >
                  {submitting
                    ? <ActivityIndicator size="small" color={Colors.bg} />
                    : <Text style={np.saveText}>Save Score</Text>
                  }
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const np = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  sheet:     { backgroundColor: Colors.bgSecondary, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  handle:    { width: 40, height: 4, backgroundColor: Colors.cardBorder, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  holeName:  { color: Colors.textPrimary, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  parText:   { color: Colors.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 4, marginBottom: 18 },
  scoreBox:  { borderWidth: 2, borderRadius: Radius.lg, paddingVertical: 14, paddingHorizontal: 28, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  scoreNum:  { fontSize: 48, fontWeight: '900' },
  scoreRel:  { fontSize: 22, fontWeight: '700', marginTop: 10 },
  grid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20, justifyContent: 'center' },
  numBtn:    { width: 64, height: 52, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  numText:   { fontSize: 20, fontWeight: '800' },
  actions:   { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, height: 50, borderRadius: Radius.pill, borderWidth: 1.5, borderColor: Colors.cardBorder, alignItems: 'center', justifyContent: 'center' },
  cancelText:{ color: Colors.textSecondary, fontSize: 15, fontWeight: '600' },
  saveBtn:   { flex: 2, height: 50, borderRadius: Radius.pill, backgroundColor: Colors.lime, alignItems: 'center', justifyContent: 'center' },
  saveText:  { color: Colors.bg, fontSize: 15, fontWeight: '800' },
  // extras
  extrasRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  extrasLabel:   { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  btnPair:       { flexDirection: 'row', gap: 8 },
  toggleBtn:     { width: 44, height: 36, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.cardBorder, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgTertiary },
  toggleBtnActive: { backgroundColor: Colors.lime + '30', borderColor: Colors.lime },
  toggleBtnDanger: { backgroundColor: Colors.error + '30', borderColor: Colors.error },
  toggleText:    { color: Colors.textSecondary, fontSize: 16, fontWeight: '700' },
  toggleTextActive: { color: Colors.textPrimary },
  stepper:       { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn:       { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.bgTertiary, borderWidth: 1.5, borderColor: Colors.cardBorder, alignItems: 'center', justifyContent: 'center' },
  stepText:      { color: Colors.lime, fontSize: 20, fontWeight: '700', lineHeight: 22 },
  stepValue:     { color: Colors.textPrimary, fontSize: 22, fontWeight: '800', minWidth: 28, textAlign: 'center' },
});

// ─── Skins table ──────────────────────────────────────────────────────────────

function SkinsTable({ skins }: { skins: any[] }) {
  if (!skins?.length) {
    return (
      <View style={betStyles.empty}>
        <Text style={betStyles.emptyText}>No skins data available</Text>
      </View>
    );
  }
  return (
    <View style={betStyles.skinsTable}>
      <View style={betStyles.skinsHeader}>
        <Text style={[betStyles.skinsCell, betStyles.skinsCellHole]}>Hole</Text>
        <Text style={[betStyles.skinsCell, betStyles.skinsCellWinner]}>Winner</Text>
        <Text style={[betStyles.skinsCell, betStyles.skinsCellScore]}>Score</Text>
        <Text style={[betStyles.skinsCell, betStyles.skinsCellSkins]}>Skins</Text>
      </View>
      {skins.map((s: any, idx: number) => {
        const isCarry = !s.winner;
        return (
          <View
            key={idx}
            style={[
              betStyles.skinsRow,
              isCarry && betStyles.skinsRowCarry,
              idx % 2 === 0 && betStyles.skinsRowAlt,
            ]}
          >
            <Text style={[betStyles.skinsCell, betStyles.skinsCellHole, betStyles.skinsCellData]}>{s.holeNumber ?? idx + 1}</Text>
            <Text style={[betStyles.skinsCell, betStyles.skinsCellWinner, betStyles.skinsCellData, isCarry && betStyles.carryText]}>
              {isCarry ? '⚡ Carry' : (s.winner?.name ?? s.winnerName ?? '–')}
            </Text>
            <Text style={[betStyles.skinsCell, betStyles.skinsCellScore, betStyles.skinsCellData]}>{s.score ?? '–'}</Text>
            <Text style={[betStyles.skinsCell, betStyles.skinsCellSkins, betStyles.skinsCellData, !isCarry && { color: Colors.lime }]}>
              {s.skinsWon ?? (isCarry ? 'Carry' : 1)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Nassau cards ─────────────────────────────────────────────────────────────

function NassauCards({ nassau }: { nassau: any }) {
  if (!nassau) {
    return (
      <View style={betStyles.empty}>
        <Text style={betStyles.emptyText}>No Nassau data available</Text>
      </View>
    );
  }
  const cards = [
    { label: 'Front 9',  winner: nassau.front9Winner,   score: nassau.front9Score   },
    { label: 'Back 9',   winner: nassau.back9Winner,    score: nassau.back9Score    },
    { label: 'Overall',  winner: nassau.overallWinner,  score: nassau.overallScore  },
  ];
  return (
    <View style={betStyles.nassauRow}>
      {cards.map((c) => (
        <View key={c.label} style={betStyles.nassauCard}>
          <Text style={betStyles.nassauLabel}>{c.label}</Text>
          <Text style={betStyles.nassauWinner} numberOfLines={1}>{c.winner?.name ?? c.winner ?? '–'}</Text>
          {c.score != null && <Text style={betStyles.nassauScore}>{c.score > 0 ? `+${c.score}` : c.score}</Text>}
        </View>
      ))}
    </View>
  );
}

const betStyles = StyleSheet.create({
  empty:        { paddingVertical: 20, alignItems: 'center' },
  emptyText:    { color: Colors.textMuted, fontSize: 13 },
  skinsTable:   { borderRadius: Radius.md, overflow: 'hidden', borderWidth: 1, borderColor: Colors.cardBorder },
  skinsHeader:  { flexDirection: 'row', backgroundColor: Colors.bgTertiary, paddingVertical: 8 },
  skinsRow:     { flexDirection: 'row', paddingVertical: 8 },
  skinsRowAlt:  { backgroundColor: Colors.bg },
  skinsRowCarry:{ backgroundColor: Colors.purple + '12' },
  skinsCell:    { paddingHorizontal: 8, fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
  skinsCellHole:    { width: 44, textAlign: 'center' },
  skinsCellWinner:  { flex: 1 },
  skinsCellScore:   { width: 50, textAlign: 'center' },
  skinsCellSkins:   { width: 50, textAlign: 'center' },
  skinsCellData:    { color: Colors.textPrimary, fontWeight: '500', fontSize: 13 },
  carryText:        { color: Colors.purple, fontWeight: '700' },
  nassauRow:    { flexDirection: 'row', gap: 8 },
  nassauCard:   { flex: 1, backgroundColor: Colors.bgTertiary, borderRadius: Radius.md, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: Colors.cardBorder },
  nassauLabel:  { color: Colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6 },
  nassauWinner: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  nassauScore:  { color: Colors.lime, fontSize: 11, fontWeight: '600', marginTop: 2 },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

type RoundTab = 'scorecard' | 'bets' | 'skins';

export default function RoundDetailScreen() {
  const { id }   = useLocalSearchParams<{ id: string }>();
  const insets   = useSafeAreaInsets();
  const router   = useRouter();
  const { user } = useAuth();
  const qc       = useQueryClient();

  const { data: round, isLoading: roundLoading, isError: roundError, refetch: refetchRound } = useRound(id);
  const { data: scorecard, isLoading: scLoading, refetch: refetchSc } = useScorecard(id);

  const [refreshing, setRefreshing]   = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [pad, setPad]                 = useState<PadState | null>(null);
  const [padOpen, setPadOpen]         = useState(false);
  const [activeTab, setActiveTab]     = useState<RoundTab>('scorecard');

  const [addSkinsLoading, setAddSkinsLoading] = useState(false);

  // Bets queries — lazy, only when Bets tab is active
  const { data: skinsData, isLoading: skinsLoading } = useQuery({
    queryKey: ['skins', id],
    queryFn: () => (roundsApi as any).getSkins(id),
    enabled: !!id && activeTab === 'bets',
    retry: false,
  });
  const { data: nassauData, isLoading: nassauLoading } = useQuery({
    queryKey: ['nassau', id],
    queryFn: () => (roundsApi as any).getNassau(id),
    enabled: !!id && activeTab === 'bets',
    retry: false,
  });

  // Skins game query — lazy, only when Skins tab is active
  const { data: skinsGameApiData, isLoading: skinsGameApiLoading, refetch: refetchSkinsGame } = useQuery({
    queryKey: ['skinsGame', id],
    queryFn: () => (roundsApi as any).getSkinsGame ? (roundsApi as any).getSkinsGame(id) : Promise.resolve(null),
    enabled: !!id && activeTab === 'skins',
    retry: false,
  });

  async function handleAddSkinsGame() {
    setAddSkinsLoading(true);
    try {
      const { skinsApi } = await import('../../services/api');
      await skinsApi.create(id, { betPerHole: 1 });
      refetchSkinsGame();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to create skins game');
    } finally {
      setAddSkinsLoading(false);
    }
  }

  function computeSkinsPayouts(holesData: any[]) {
    const payouts: Record<string, number> = {};
    holesData.forEach((h: any) => {
      if (h.winner) {
        const name = h.winner?.name ?? h.winnerName ?? 'Unknown';
        payouts[name] = (payouts[name] ?? 0) + (h.skinsWon ?? 1);
      }
    });
    return payouts;
  }

  const isAdmin = user?.role === 'SCOREKEEPER' || user?.role === 'SUPER_ADMIN';

  const players: any[] = useMemo(() => {
    if (scorecard?.players?.length)  return scorecard.players;
    if (round?.participants?.length) return round.participants;
    return [];
  }, [scorecard, round]);

  const holes: any[] = useMemo(() => {
    if (scorecard?.holes?.length) return scorecard.holes;
    return Array.from({ length: 18 }, (_, i) => ({
      holeNumber: i + 1,
      par:        4,
      yardage:    null,
    }));
  }, [scorecard]);

  const scoreMap = useMemo(() => {
    const map: Record<number, Record<string, number>> = {};
    ((scorecard?.scores as any) ?? []).forEach((s: any) => {
      if (!map[s.holeNumber]) map[s.holeNumber] = {};
      map[s.holeNumber][s.userId] = s.strokes;
    });
    return map;
  }, [scorecard]);

  const par = useMemo(() => holes.reduce((s, h) => s + (h.par ?? 4), 0), [holes]);

  function playerGross(userId: string) {
    return holes.reduce((s, h) => s + (scoreMap[h.holeNumber]?.[userId] ?? 0), 0);
  }
  function playerNet(userId: string, handicap: number) {
    const g = playerGross(userId);
    return g > 0 ? g - handicap : 0;
  }

  // Running total vs par — how many holes have been played by the current user
  const myId = user?.id ?? '';
  const myHolesPlayed = useMemo(() => holes.filter((h) => (scoreMap[h.holeNumber]?.[myId] ?? 0) > 0), [holes, scoreMap, myId]);
  const myGrossThru   = useMemo(() => myHolesPlayed.reduce((s, h) => s + (scoreMap[h.holeNumber]?.[myId] ?? 0), 0), [myHolesPlayed, scoreMap, myId]);
  const myParThru     = useMemo(() => myHolesPlayed.reduce((s, h) => s + (h.par ?? 4), 0), [myHolesPlayed]);
  const myRelThru     = myGrossThru - myParThru;

  // ─── Score pad ────────────────────────────────────────────────────────

  function openPad(holeNumber: number, holePar: number, userId: string, playerName: string) {
    if (!isAdmin && userId !== user?.id) return;
    setPad({
      holeNumber,
      par:     holePar,
      userId,
      playerName,
      current: scoreMap[holeNumber]?.[userId] ?? 0,
    });
    setPadOpen(true);
  }

  async function submitScore(strokes: number, extras: ScoreExtras) {
    if (!pad) return;
    setSubmitting(true);
    try {
      await scoresApi.submit({
        roundId: id,
        userId: pad.userId,
        holeNumber: pad.holeNumber,
        strokes,
        ...(extras.fairwayHit !== undefined && { fairwayHit: extras.fairwayHit }),
        ...(extras.greenInReg !== undefined && { greenInReg: extras.greenInReg }),
        ...(extras.putts      !== undefined && { putts: extras.putts }),
      } as any);
      qc.invalidateQueries({ queryKey: ['scorecard', id] });
      setPadOpen(false);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to save score');
    } finally {
      setSubmitting(false);
    }
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchRound(), refetchSc()]);
    setRefreshing(false);
  }, [refetchRound, refetchSc]);

  // ─── Loading / Error ────────────────────────────────────────────────────

  if (roundLoading || scLoading) return <LoadingSkeleton insetTop={insets.top} />;

  if (roundError || !round) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top, alignItems: 'center' }]}>
        <TouchableOpacity style={[styles.backBtn, { margin: Spacing.md }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.error} style={{ marginTop: 40 }} />
        <Text style={styles.errorText}>Failed to load round</Text>
        <TouchableOpacity onPress={() => refetchRound()} style={styles.retryBtn}>
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const sc       = statusColors(round.status ?? 'UPCOMING');
  const front9   = holes.filter((h) => h.holeNumber <= 9);
  const back9    = holes.filter((h) => h.holeNumber > 9);
  const isComplete = round.status === 'COMPLETED' || round.status === 'COMPLETE' || round.isComplete;

  // ─── Grid components ────────────────────────────────────────────────────

  const HoleHeader = ({ list }: { list: any[] }) => (
    <View style={styles.gridRow}>
      <View style={styles.playerCol}>
        <Text style={styles.colHeaderText}>Player</Text>
      </View>
      {list.map((h) => (
        <View key={h.holeNumber} style={styles.holeCol}>
          <Text style={styles.holeNum}>{h.holeNumber}</Text>
          <Text style={styles.holePar}>p{h.par ?? 4}</Text>
        </View>
      ))}
      <View style={styles.totalCol}>
        <Text style={styles.colHeaderText}>Tot</Text>
      </View>
    </View>
  );

  const PlayerRow = ({ player, list }: { player: any; list: any[] }) => {
    const uid      = player.userId ?? player.id;
    const name     = player.user?.name ?? player.name ?? 'Unknown';
    const avatar   = player.user?.avatar ?? player.avatar;
    const handicap = player.user?.handicap ?? player.handicap ?? 0;
    const canEdit  = isAdmin || uid === user?.id;
    const gross    = playerGross(uid);
    const net      = playerNet(uid, handicap);
    const rel      = gross > 0 ? gross - par : null;

    return (
      <View style={styles.gridRow}>
        <View style={styles.playerCol}>
          <AvatarRing uri={avatar} name={name} size={24} ring="none" />
          <View style={styles.playerMeta}>
            <Text style={styles.playerName} numberOfLines={1}>{name}</Text>
            {handicap > 0 && <Text style={styles.playerHdcp}>HCP {handicap}</Text>}
          </View>
        </View>

        {list.map((h) => {
          const strokes = scoreMap[h.holeNumber]?.[uid] ?? 0;
          const bgColor  = holeScoreBgSolid(strokes, h.par ?? 4);
          const txtColor = holeScoreTextColor(strokes, h.par ?? 4);
          return (
            <TouchableOpacity
              key={h.holeNumber}
              style={[
                styles.holeCol,
                styles.holeCellBtn,
                { backgroundColor: bgColor },
                !canEdit && { opacity: 0.45 },
              ]}
              onPress={() => openPad(h.holeNumber, h.par ?? 4, uid, name)}
              disabled={!canEdit}
              activeOpacity={0.7}
            >
              <Text style={[styles.holeScore, { color: txtColor }]}>
                {strokes > 0 ? strokes : '·'}
              </Text>
            </TouchableOpacity>
          );
        })}

        <View style={styles.totalCol}>
          {gross > 0 ? (
            <>
              <Text style={[styles.totalGross, { color: rel === 0 ? Colors.par : rel! < 0 ? Colors.birdie : Colors.bogey }]}>
                {relLabel(rel!)}
              </Text>
              <Text style={styles.totalNet}>N{net}</Text>
            </>
          ) : (
            <Text style={styles.totalDash}>—</Text>
          )}
        </View>
      </View>
    );
  };

  const NineSection = ({ label, list }: { label: string; list: any[] }) => {
    if (list.length === 0) return null;
    const sPar = list.reduce((s, h) => s + (h.par ?? 4), 0);
    return (
      <View style={styles.nineWrap}>
        <View style={styles.nineHeader}>
          <Text style={styles.nineLabel}>{label}</Text>
          <Text style={styles.ninePar}>Par {sPar}</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <HoleHeader list={list} />
            {players.map((p) => (
              <PlayerRow key={p.userId ?? p.id} player={p} list={list} />
            ))}
          </View>
        </ScrollView>
      </View>
    );
  };

  // ─── Main render ────────────────────────────────────────────────────────

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {round.courseName ?? `Round ${round.roundNumber ?? ''}`}
        </Text>
        <View style={[styles.statusPill, { backgroundColor: sc.bg }]}>
          <Text style={[styles.statusText, { color: sc.text }]}>{round.status ?? 'UPCOMING'}</Text>
        </View>
      </View>

      {/* Info card */}
      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={13} color={Colors.textSecondary} />
          <Text style={styles.infoText}>{fmt(round.date)}</Text>
          {round.coursePar && (
            <>
              <Text style={styles.infoDot}>·</Text>
              <Ionicons name="golf-outline" size={13} color={Colors.textSecondary} />
              <Text style={styles.infoText}>Par {round.coursePar}</Text>
            </>
          )}
          {round.format && (
            <>
              <Text style={styles.infoDot}>·</Text>
              <Text style={styles.infoText}>{round.format}</Text>
            </>
          )}
        </View>
        {round.event?.name && (
          <View style={styles.infoRow}>
            <Ionicons name="trophy-outline" size={13} color={Colors.lime} />
            <Text style={[styles.infoText, { color: Colors.lime }]}>{round.event.name}</Text>
          </View>
        )}
        {round.courseRating && (
          <View style={styles.infoRow}>
            <Ionicons name="star-outline" size={13} color={Colors.textSecondary} />
            <Text style={styles.infoText}>Rating {round.courseRating} / Slope {round.courseSlope ?? '—'}</Text>
          </View>
        )}
        <View style={styles.infoRow}>
          <Ionicons
            name={isAdmin ? 'create-outline' : 'information-circle-outline'}
            size={13}
            color={isAdmin ? Colors.lime : Colors.textMuted}
          />
          <Text style={[styles.infoText, { color: isAdmin ? Colors.lime : Colors.textMuted, fontSize: 11 }]}>
            {isAdmin ? 'Tap any cell to enter scores' : 'Tap your scores to edit'}
          </Text>
        </View>
      </View>

      {/* Tab switcher */}
      <View style={styles.tabBar}>
        {(['scorecard', 'bets', 'skins'] as RoundTab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, activeTab === t && styles.tabBtnActive]}
            onPress={() => setActiveTab(t)}
          >
            <Text style={[styles.tabBtnText, activeTab === t && styles.tabBtnTextActive]}>
              {t === 'scorecard' ? 'Scorecard' : t === 'bets' ? 'Bets' : 'Skins'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'scorecard' ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.lime} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Running total indicator */}
          {myHolesPlayed.length > 0 && (
            <View style={styles.thruBar}>
              <Text style={styles.thruText}>
                THRU {myHolesPlayed.length}
                {'  '}
                <Text style={[styles.thruRel, { color: myRelThru < 0 ? Colors.birdie : myRelThru === 0 ? Colors.par : Colors.bogey }]}>
                  {relLabel(myRelThru)}
                </Text>
              </Text>
            </View>
          )}

          {players.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={40} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No players in this round.</Text>
            </View>
          )}

          {players.length > 0 && (
            <>
              <NineSection label="Front 9" list={front9} />
              {back9.length > 0 && <NineSection label="Back 9" list={back9} />}

              {/* Totals summary */}
              <GlassCard style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>Round Summary</Text>
                {players.map((player) => {
                  const uid      = player.userId ?? player.id;
                  const name     = player.user?.name ?? player.name ?? 'Unknown';
                  const avatar   = player.user?.avatar ?? player.avatar;
                  const handicap = player.user?.handicap ?? player.handicap ?? 0;
                  const gross    = playerGross(uid);
                  const net      = playerNet(uid, handicap);
                  const rel      = gross > 0 ? gross - par : null;
                  return (
                    <View key={uid} style={styles.summaryRow}>
                      <AvatarRing uri={avatar} name={name} size={32} ring="none" />
                      <Text style={styles.summaryName} numberOfLines={1}>{name}</Text>
                      <View style={styles.summaryScores}>
                        {gross > 0 ? (
                          <>
                            <View style={styles.scoreChip}>
                              <Text style={styles.scoreChipLabel}>Gross</Text>
                              <Text style={styles.scoreChipValue}>{gross}</Text>
                            </View>
                            <View style={styles.scoreChip}>
                              <Text style={styles.scoreChipLabel}>Net</Text>
                              <Text style={styles.scoreChipValue}>{net}</Text>
                            </View>
                            <View style={[styles.scoreChip, styles.scoreChipRel]}>
                              <Text style={[styles.scoreChipValue, {
                                color: rel === 0 ? Colors.par : rel! < 0 ? Colors.birdie : Colors.bogey,
                              }]}>
                                {relLabel(rel!)}
                              </Text>
                            </View>
                          </>
                        ) : (
                          <Text style={styles.totalDash}>No scores</Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </GlassCard>

              {/* Round complete banner — Change 6 */}
              {isComplete && (
                <TouchableOpacity
                  style={styles.statsBanner}
                  onPress={() => router.push(`/round/stats?roundId=${id}` as any)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.statsBannerIcon}>📊</Text>
                  <Text style={styles.statsBannerText}>View Round Stats</Text>
                  <Ionicons name="chevron-forward" size={16} color={Colors.lime} />
                </TouchableOpacity>
              )}
            </>
          )}
        </ScrollView>
      ) : (
        /* ── Bets tab ── */
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: Spacing.md, paddingBottom: insets.bottom + 40, gap: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.lime} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Skins */}
          <GlassCard>
            <View style={styles.betSectionHeader}>
              <Text style={styles.betSectionTitle}>Skins</Text>
              {skinsLoading && <ActivityIndicator size="small" color={Colors.lime} />}
            </View>
            <SkinsTable skins={skinsData ?? []} />
          </GlassCard>

          {/* Nassau */}
          <GlassCard>
            <View style={styles.betSectionHeader}>
              <Text style={styles.betSectionTitle}>Nassau</Text>
              {nassauLoading && <ActivityIndicator size="small" color={Colors.lime} />}
            </View>
            <NassauCards nassau={nassauData} />
          </GlassCard>
        </ScrollView>
      )}

      {activeTab === 'skins' && (
        /* ── Skins tab ── */
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: Spacing.md, paddingBottom: insets.bottom + 40, gap: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.lime} />}
          showsVerticalScrollIndicator={false}
        >
          {skinsGameApiLoading ? (
            <ActivityIndicator size="small" color={Colors.lime} style={{ marginTop: 40 }} />
          ) : !skinsGameApiData || (Array.isArray(skinsGameApiData) && skinsGameApiData.length === 0) ? (
            <View style={styles.emptyState}>
              <Ionicons name="cash-outline" size={40} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No skins game yet.</Text>
              <TouchableOpacity
                style={[styles.retryBtn, { marginTop: 8, backgroundColor: Colors.goldDim }]}
                onPress={handleAddSkinsGame}
                disabled={addSkinsLoading}
              >
                {addSkinsLoading
                  ? <ActivityIndicator size="small" color={Colors.gold} />
                  : <Text style={[styles.retryText, { color: Colors.gold }]}>Add Skins Game</Text>
                }
              </TouchableOpacity>
            </View>
          ) : (
            <GlassCard>
              <View style={styles.betSectionHeader}>
                <Text style={styles.betSectionTitle}>Skins Game</Text>
              </View>
              {/* Per-hole results table */}
              <View style={skinsTabStyles.table}>
                <View style={skinsTabStyles.headerRow}>
                  <Text style={[skinsTabStyles.cell, skinsTabStyles.cellHole]}>Hole</Text>
                  <Text style={[skinsTabStyles.cell, skinsTabStyles.cellPar]}>Par</Text>
                  <Text style={[skinsTabStyles.cell, skinsTabStyles.cellScore]}>Low</Text>
                  <Text style={[skinsTabStyles.cell, skinsTabStyles.cellWinner]}>Winner</Text>
                  <Text style={[skinsTabStyles.cell, skinsTabStyles.cellPot]}>Pot</Text>
                </View>
                {(Array.isArray(skinsGameApiData) ? skinsGameApiData : (skinsGameApiData?.holes ?? [])).map((h: any, idx: number) => {
                  const isTied = !h.winner;
                  const carryover = h.carryover ?? h.pot ?? 0;
                  return (
                    <View key={idx} style={[skinsTabStyles.dataRow, idx % 2 === 0 && skinsTabStyles.dataRowAlt]}>
                      <Text style={[skinsTabStyles.cell, skinsTabStyles.cellHole, skinsTabStyles.dataText]}>{h.holeNumber ?? idx + 1}</Text>
                      <Text style={[skinsTabStyles.cell, skinsTabStyles.cellPar, skinsTabStyles.dataText]}>{h.par ?? '–'}</Text>
                      <Text style={[skinsTabStyles.cell, skinsTabStyles.cellScore, skinsTabStyles.dataText]}>{h.lowestScore ?? h.score ?? '–'}</Text>
                      <Text style={[skinsTabStyles.cell, skinsTabStyles.cellWinner, isTied ? skinsTabStyles.carryText : skinsTabStyles.winnerText]}>
                        {isTied ? `Carry $${carryover}` : (h.winner?.name ?? h.winnerName ?? '–')}
                      </Text>
                      <Text style={[skinsTabStyles.cell, skinsTabStyles.cellPot, isTied ? skinsTabStyles.carryText : skinsTabStyles.winnerText]}>
                        {isTied ? `⚡` : `$${h.skinsWon ?? 1}`}
                      </Text>
                    </View>
                  );
                })}
              </View>
              {/* Payout summary */}
              {(() => {
                const holesArr = Array.isArray(skinsGameApiData) ? skinsGameApiData : (skinsGameApiData?.holes ?? []);
                const payouts = computeSkinsPayouts(holesArr);
                const entries = Object.entries(payouts);
                if (entries.length === 0) return null;
                return (
                  <View style={skinsTabStyles.payoutSection}>
                    <Text style={skinsTabStyles.payoutTitle}>Payout Summary</Text>
                    {entries.map(([name, skins]) => (
                      <View key={name} style={skinsTabStyles.payoutRow}>
                        <Text style={skinsTabStyles.payoutName}>{name}</Text>
                        <Text style={skinsTabStyles.payoutAmount}>{skins} skin{skins !== 1 ? 's' : ''}</Text>
                      </View>
                    ))}
                  </View>
                );
              })()}
            </GlassCard>
          )}
        </ScrollView>
      )}

      {/* Number pad modal */}
      {pad && (
        <NumberPad
          {...pad}
          visible={padOpen}
          onClose={() => setPadOpen(false)}
          onSubmit={submitScore}
          submitting={submitting}
        />
      )}
    </View>
  );
}

const skinsTabStyles = StyleSheet.create({
  table: { borderRadius: Radius.md, overflow: 'hidden', borderWidth: 1, borderColor: Colors.cardBorder },
  headerRow: { flexDirection: 'row', backgroundColor: Colors.bgTertiary, paddingVertical: 8 },
  dataRow: { flexDirection: 'row', paddingVertical: 8 },
  dataRowAlt: { backgroundColor: Colors.bg },
  cell: { paddingHorizontal: 6, fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
  cellHole: { width: 40, textAlign: 'center' },
  cellPar: { width: 36, textAlign: 'center' },
  cellScore: { width: 40, textAlign: 'center' },
  cellWinner: { flex: 1 },
  cellPot: { width: 48, textAlign: 'center' },
  dataText: { color: Colors.textPrimary, fontWeight: '500', fontSize: 13 },
  carryText: { color: Colors.purple, fontWeight: '700', flex: 1 },
  winnerText: { color: Colors.lime, fontWeight: '700', flex: 1 },
  payoutSection: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: Colors.cardBorder },
  payoutTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700', marginBottom: 10 },
  payoutRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder + '80' },
  payoutName: { color: Colors.textPrimary, fontSize: 13, fontWeight: '600' },
  payoutAmount: { color: Colors.lime, fontSize: 13, fontWeight: '700' },
});

// ─── Styles ──────────────────────────────────────────────────────────────────

const PLAYER_COL = 130;
const HOLE_COL   = 40;
const TOTAL_COL  = 62;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.cardBorder,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.bgSecondary,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { flex: 1, color: Colors.textPrimary, fontSize: 17, fontWeight: '800' },
  statusPill:  { borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  statusText:  { fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },

  infoCard: {
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    backgroundColor: Colors.bgSecondary,
    borderBottomWidth: 1, borderBottomColor: Colors.cardBorder,
    gap: 5,
  },
  infoRow:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  infoText: { color: Colors.textSecondary, fontSize: 13 },
  infoDot:  { color: Colors.textMuted, fontSize: 13 },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: Colors.cardBorder,
  },
  tabBtn: { flex: 1, paddingVertical: 11, alignItems: 'center' },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: Colors.lime },
  tabBtnText: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
  tabBtnTextActive: { color: Colors.lime },

  // Running total bar
  thruBar: {
    marginHorizontal: Spacing.md, marginTop: 10, marginBottom: 2,
    backgroundColor: Colors.bgSecondary, borderRadius: Radius.md,
    paddingVertical: 6, paddingHorizontal: 14,
    borderWidth: 1, borderColor: Colors.cardBorder,
    alignSelf: 'flex-start',
  },
  thruText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  thruRel:  { fontSize: 13, fontWeight: '800' },

  // Nine sections
  nineWrap:   { marginTop: 14, paddingHorizontal: Spacing.md },
  nineHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  nineLabel:  { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  ninePar:    { color: Colors.textSecondary, fontSize: 12 },

  // Grid
  gridRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  playerCol:   { width: PLAYER_COL, flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 6 },
  colHeaderText: { color: Colors.textSecondary, fontSize: 11, fontWeight: '600' },
  holeCol:     { width: HOLE_COL, height: 44, alignItems: 'center', justifyContent: 'center' },
  holeNum:     { color: Colors.textSecondary, fontSize: 11, fontWeight: '700' },
  holePar:     { color: Colors.textMuted, fontSize: 9 },
  holeCellBtn: { borderRadius: Radius.sm, borderWidth: 1, borderColor: 'transparent', marginHorizontal: 1 },
  holeScore:   { fontSize: 15, fontWeight: '800' },
  totalCol:    { width: TOTAL_COL, paddingLeft: 8, alignItems: 'center' },
  totalGross:  { fontSize: 13, fontWeight: '800' },
  totalNet:    { color: Colors.textMuted, fontSize: 9, marginTop: 1 },
  totalDash:   { color: Colors.textMuted, fontSize: 12 },

  playerMeta: { flex: 1 },
  playerName: { color: Colors.textPrimary, fontSize: 12, fontWeight: '700' },
  playerHdcp: { color: Colors.textMuted, fontSize: 9, marginTop: 1 },

  // Summary
  summaryCard:   { margin: Spacing.md, marginTop: 16 },
  summaryTitle:  { color: Colors.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 14 },
  summaryRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' },
  summaryName:   { flex: 1, color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  summaryScores: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  scoreChip:     { backgroundColor: Colors.bgTertiary, borderRadius: Radius.sm, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center' },
  scoreChipRel:  { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.cardBorder },
  scoreChipLabel:{ color: Colors.textMuted, fontSize: 9, fontWeight: '600', marginBottom: 2 },
  scoreChipValue:{ color: Colors.textPrimary, fontSize: 14, fontWeight: '800' },

  // Stats banner (Change 6)
  statsBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: Spacing.md, marginBottom: Spacing.md,
    backgroundColor: Colors.limeDim,
    borderRadius: Radius.lg, padding: 14,
    borderWidth: 1, borderColor: Colors.lime + '44',
  },
  statsBannerIcon: { fontSize: 20 },
  statsBannerText: { flex: 1, color: Colors.lime, fontSize: 15, fontWeight: '700' },

  // Bets
  betSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  betSectionTitle:  { color: Colors.textPrimary, fontSize: 16, fontWeight: '700' },

  // Empty / Error
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText:  { color: Colors.textSecondary, fontSize: 14, textAlign: 'center' },
  errorText:  { color: Colors.textPrimary, fontSize: 16, fontWeight: '700', marginTop: 12 },
  retryBtn:   { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: Colors.limeDim, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.lime + '44' },
  retryText:  { color: Colors.lime, fontSize: 13, fontWeight: '700' },
});
