import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Modal, RefreshControl, ActivityIndicator, Alert, Switch, TextInput,
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
  if (strokes === 0) return '#1A2030';
  const rel = strokes - par;
  if (rel <= -2) return '#3B62D9'; // eagle — blue
  if (rel === -1) return '#C4F135'; // birdie — lime
  if (rel === 0)  return '#1A2030'; // par — dark navy
  if (rel === 1)  return '#D4561A'; // bogey — orange
  if (rel === 2)  return '#9B1C1C'; // double bogey — dark red
  return '#6B1111';                 // triple+ — darker red
}

function holeScoreTextColor(strokes: number, par: number): string {
  if (strokes === 0) return Colors.textMuted;
  const rel = strokes - par;
  if (rel <= -2) return '#FFFFFF';
  if (rel === -1) return '#080C14'; // dark text on lime
  if (rel === 0)  return Colors.textSecondary;
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

type RoundTab = 'scorecard' | 'skins';

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
  const [weather, setWeather] = useState<any>(null);

  useEffect(() => {
    if (!round?.golfCourse?.latitude || !round?.golfCourse?.longitude) return;
    const roundDate = round.date ? new Date(round.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    const today = new Date();
    const diff = Math.abs((new Date(roundDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff > 7) return;
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${round.golfCourse.latitude}&longitude=${round.golfCourse.longitude}&daily=temperature_2m_max,precipitation_probability_max,windspeed_10m_max&temperature_unit=fahrenheit&timezone=auto&start_date=${roundDate}&end_date=${roundDate}`)
      .then(r => r.json())
      .then(d => {
        if (d.daily) setWeather({
          temp: Math.round(d.daily.temperature_2m_max[0]),
          rain: d.daily.precipitation_probability_max[0],
          wind: Math.round(d.daily.windspeed_10m_max[0]),
        });
      }).catch(() => {});
  }, [round]);

  // Bets queries — disabled (tab removed)
  const { data: skinsData } = useQuery({
    queryKey: ['skins', id],
    queryFn: () => (roundsApi as any).getSkins(id),
    enabled: false,
    retry: false,
  });
  const { data: nassauData } = useQuery({
    queryKey: ['nassau', id],
    queryFn: () => (roundsApi as any).getNassau(id),
    enabled: false,
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
    if ((scorecard?.players || []).length)  return scorecard?.players ?? [];
    if ((round?.participants || []).length) return round?.participants ?? [];
    return [];
  }, [scorecard, round]);

  const holes: any[] = useMemo(() => {
    if ((scorecard?.holes || []).length) return scorecard?.holes ?? [];
    return Array.from({ length: 18 }, (_, i) => ({
      holeNumber: i + 1,
      par:        4,
      yardage:    null,
    }));
  }, [scorecard]);

  const scoreMap = useMemo(() => {
    const map: Record<number, Record<string, number>> = {};
    const raw = scorecard?.scores;
    if (!raw) return map;
    // Handles both flat Score[] and legacy Record<userId, Score[]>
    const flatScores: any[] = Array.isArray(raw)
      ? raw
      : Object.values(raw as Record<string, any[]>).flat();
    flatScores.forEach((s: any) => {
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

  // ─── Player card scorecard ────────────────────────────────────────────────

  function playerStats(uid: string) {
    let eagles = 0, birdies = 0, bogeys = 0, doubles = 0;
    holes.forEach((h) => {
      const s = scoreMap[h.holeNumber]?.[uid];
      if (!s) return;
      const rel = s - (h.par ?? 4);
      if (rel <= -2) eagles++;
      else if (rel === -1) birdies++;
      else if (rel === 1) bogeys++;
      else if (rel >= 2) doubles++;
    });
    return { eagles, birdies, bogeys, doubles };
  }

  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      const ga = playerGross(a.userId ?? a.id);
      const gb = playerGross(b.userId ?? b.id);
      if (ga === 0 && gb === 0) return 0;
      if (ga === 0) return 1;
      if (gb === 0) return -1;
      return ga - gb;
    });
  }, [players, scoreMap]);

  const RANK_COLORS = ['#C4F135', '#4361B8', '#6B7DB8', '#3D4460'];

  const PlayerCard = ({ player, rank }: { player: any; rank: number }) => {
    const uid = player.userId ?? player.id;
    const name = player.user?.name ?? player.name ?? 'Unknown';
    const nickname = player.user?.nickname ?? player.nickname ?? '';
    const gross = playerGross(uid);
    const rel = gross > 0 ? gross - par : null;
    const { eagles, birdies, bogeys } = playerStats(uid);
    const rankColor = RANK_COLORS[Math.min(rank - 1, RANK_COLORS.length - 1)];
    const rankTextColor = rank === 1 ? '#080C14' : '#F4EFE6';

    return (
      <View style={pcStyles.card}>
        {/* Top row */}
        <View style={pcStyles.topRow}>
          <View style={[pcStyles.rankCircle, { backgroundColor: rankColor }]}>
            <Text style={[pcStyles.rankText, { color: rankTextColor }]}>{rank}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={pcStyles.playerName}>{name}</Text>
            {nickname ? <Text style={pcStyles.nickname}>"{nickname}"</Text> : null}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={pcStyles.scoreRel}>{rel === null ? 'E' : relLabel(rel)}</Text>
            <Text style={pcStyles.grossText}>{gross > 0 ? `${gross} strokes` : '0 strokes'}</Text>
          </View>
        </View>

        {/* Score chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={pcStyles.chipsScroll}>
          <View style={pcStyles.chipsRow}>
            {holes.map((h) => {
              const s = scoreMap[h.holeNumber]?.[uid] ?? 0;
              const bg = holeScoreBgSolid(s, h.par ?? 4);
              const tc = holeScoreTextColor(s, h.par ?? 4);
              const isEditable = isAdmin || uid === user?.id;
              return (
                <TouchableOpacity
                  key={h.holeNumber}
                  style={[pcStyles.chip, { backgroundColor: bg }]}
                  onPress={() => isEditable && openPad(h.holeNumber, h.par ?? 4, uid, name)}
                  activeOpacity={isEditable ? 0.7 : 1}
                >
                  <Text style={[pcStyles.chipText, { color: tc }]}>{s > 0 ? s : '–'}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* Stat tags */}
        {(eagles > 0 || birdies > 0 || bogeys > 0) && (
          <View style={pcStyles.tagsRow}>
            {eagles > 0 && (
              <View style={[pcStyles.tag, { backgroundColor: '#3B62D930' }]}>
                <View style={[pcStyles.tagDot, { backgroundColor: '#3B62D9' }]} />
                <Text style={[pcStyles.tagText, { color: '#3B62D9' }]}>{eagles} {eagles === 1 ? 'Eagle' : 'Eagles'}</Text>
              </View>
            )}
            {birdies > 0 && (
              <View style={[pcStyles.tag, { backgroundColor: '#C4F13520' }]}>
                <View style={[pcStyles.tagDot, { backgroundColor: '#C4F135' }]} />
                <Text style={[pcStyles.tagText, { color: '#C4F135' }]}>{birdies} {birdies === 1 ? 'Birdie' : 'Birdies'}</Text>
              </View>
            )}
            {bogeys > 0 && (
              <View style={[pcStyles.tag, { backgroundColor: '#D4561A20' }]}>
                <View style={[pcStyles.tagDot, { backgroundColor: '#D4561A' }]} />
                <Text style={[pcStyles.tagText, { color: '#D4561A' }]}>{bogeys} {bogeys === 1 ? 'Bogey' : 'Bogeys'}</Text>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  // ─── Skins setup component ────────────────────────────────────────────────

  const SkinsSetup = () => {
    const [stake, setStake] = useState('5');
    const [carryover, setCarryover] = useState(true);
    const [saving, setSaving] = useState(false);

    async function handleCreate() {
      setSaving(true);
      try {
        const { skinsApi } = await import('../../services/api');
        await skinsApi.create(id, { betPerHole: parseFloat(stake) || 1, carryover });
        refetchSkinsGame();
      } catch (e: any) {
        Alert.alert('Error', e?.message ?? 'Failed to create skins game');
      } finally {
        setSaving(false);
      }
    }

    if (skinsGameApiData) {
      return <SkinsTable skins={skinsGameApiData.holes ?? skinsGameApiData} />;
    }

    return (
      <View style={ssStyles.wrap}>
        <Text style={ssStyles.title}>Set Up Skins Game</Text>
        <Text style={ssStyles.subtitle}>Configure the skins game for this round</Text>
        <View style={ssStyles.card}>
          <View style={ssStyles.row}>
            <View>
              <Text style={ssStyles.label}>Stake per hole</Text>
              <Text style={ssStyles.desc}>Amount wagered each hole</Text>
            </View>
            <View style={ssStyles.inputBox}>
              <Text style={ssStyles.dollar}>$</Text>
              <TextInput
                style={ssStyles.input}
                value={stake}
                onChangeText={setStake}
                keyboardType="numeric"
                maxLength={5}
              />
            </View>
          </View>
          <View style={[ssStyles.row, { borderTopWidth: 1, borderTopColor: 'rgba(196,241,53,0.08)', paddingTop: 16, marginTop: 4 }]}>
            <View>
              <Text style={ssStyles.label}>Carryover</Text>
              <Text style={ssStyles.desc}>Ties carry pot to next hole</Text>
            </View>
            <Switch
              value={carryover}
              onValueChange={setCarryover}
              trackColor={{ false: '#1E2640', true: '#8FB520' }}
              thumbColor={carryover ? '#C4F135' : '#8A8FA8'}
            />
          </View>
        </View>
        {isAdmin && (
          <TouchableOpacity style={ssStyles.createBtn} onPress={handleCreate} disabled={saving}>
            <Text style={ssStyles.createBtnText}>{saving ? 'Creating…' : 'Start Skins Game'}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // ─── Main render ────────────────────────────────────────────────────────

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {round.roundNumber ? `Round ${round.roundNumber}` : 'Round'}
        </Text>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: Colors.lime + '22' }]}
          onPress={() => router.push(`/round/stats?roundId=${id}` as any)}
        >
          <Ionicons name="bar-chart" size={18} color={Colors.lime} />
        </TouchableOpacity>
      </View>

      {/* Course + date info */}
      <View style={styles.infoCard}>
        <Text style={styles.courseNameLarge} numberOfLines={2}>
          {round.courseName ?? 'Golf Course'}
        </Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoText}>
            {round.date ? new Date(round.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : '—'}
            {(round as any).teeTime ? ` • ${(round as any).teeTime}` : ''}
          </Text>
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

      {/* Weather card */}
      {weather && (
        <View style={styles.weatherCard}>
          <Ionicons name="partly-sunny-outline" size={14} color={Colors.textSecondary} />
          <Text style={styles.weatherText}>{weather.temp}°F</Text>
          <Text style={[styles.weatherText, weather.rain > 40 ? styles.weatherAmber : null]}>{weather.rain}% rain</Text>
          <Text style={[styles.weatherText, weather.wind > 20 ? styles.weatherRed : null]}>{weather.wind} mph wind</Text>
        </View>
      )}

      {/* Tab toggle */}
      <View style={styles.tabRow}>
        {(['scorecard', 'skins'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, activeTab === t && styles.tabBtnActive]}
            onPress={() => setActiveTab(t)}
          >
            <Text style={[styles.tabBtnText, activeTab === t && styles.tabBtnTextActive]}>
              {t === 'scorecard' ? 'Scorecard' : 'Skins'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.lime} />}
      >
        {activeTab === 'scorecard' && (
          <>
            {/* Hole par header */}
            <View style={pcStyles.parHeader}>
              <Text style={pcStyles.parHeaderLabel}>HOLE PARS</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={pcStyles.parRow}>
                  {holes.map((h) => (
                    <View key={h.holeNumber} style={pcStyles.parCell}>
                      <Text style={pcStyles.parHoleNum}>{h.holeNumber}</Text>
                      <Text style={pcStyles.parValue}>{h.par ?? 4}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Player cards */}
            {sortedPlayers.map((p, idx) => (
              <PlayerCard key={p.userId ?? p.id} player={p} rank={idx + 1} />
            ))}

            {sortedPlayers.length === 0 && (
              <View style={{ alignItems: 'center', paddingTop: 60 }}>
                <Ionicons name="people-outline" size={40} color={Colors.textMuted} />
                <Text style={{ color: Colors.textMuted, marginTop: 12 }}>No players yet</Text>
              </View>
            )}
          </>
        )}

        {activeTab === 'skins' && <SkinsSetup />}
      </ScrollView>

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

  // Weather
  weatherCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    backgroundColor: Colors.bgTertiary,
    borderBottomWidth: 1, borderBottomColor: Colors.cardBorder,
  },
  weatherText:  { color: Colors.textSecondary, fontSize: 12 },
  weatherAmber: { color: '#C17B2E' },
  weatherRed:   { color: Colors.error },

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

  // Tab row
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.cardBorder,
  },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 999, backgroundColor: '#161D2E' },
  tabBtnActive: { backgroundColor: '#C4F135' },
  tabBtnText: { color: '#8A8FA8', fontSize: 14, fontWeight: '600' },
  tabBtnTextActive: { color: '#080C14', fontWeight: '700' },
  courseNameLarge: { color: '#F4EFE6', fontSize: 20, fontWeight: '700', marginBottom: 4 },

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

// ─── Player card styles ───────────────────────────────────────────────────────
const pcStyles = StyleSheet.create({
  card: {
    backgroundColor: '#0F1420',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(196,241,53,0.10)',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  rankCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: 15,
    fontWeight: '800',
  },
  playerName: {
    color: '#F4EFE6',
    fontSize: 16,
    fontWeight: '700',
  },
  nickname: {
    color: '#8A8FA8',
    fontSize: 12,
    marginTop: 1,
  },
  scoreRel: {
    color: '#F4EFE6',
    fontSize: 18,
    fontWeight: '800',
  },
  grossText: {
    color: '#8A8FA8',
    fontSize: 11,
    marginTop: 1,
  },
  chipsScroll: {
    marginBottom: 10,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 5,
    paddingVertical: 2,
  },
  chip: {
    width: 30,
    height: 30,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  tagDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
  },
  parHeader: {
    marginBottom: 12,
    paddingTop: 8,
  },
  parHeaderLabel: {
    color: '#3D4460',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  parRow: {
    flexDirection: 'row',
    gap: 5,
  },
  parCell: {
    width: 30,
    alignItems: 'center',
    gap: 2,
  },
  parHoleNum: {
    color: '#8A8FA8',
    fontSize: 10,
    fontWeight: '500',
  },
  parValue: {
    color: '#F4EFE6',
    fontSize: 13,
    fontWeight: '700',
  },
});

// ─── Skins setup styles ───────────────────────────────────────────────────────
const ssStyles = StyleSheet.create({
  wrap: {
    paddingTop: 8,
  },
  title: {
    color: '#F4EFE6',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    color: '#8A8FA8',
    fontSize: 14,
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#0F1420',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(196,241,53,0.10)',
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    color: '#F4EFE6',
    fontSize: 15,
    fontWeight: '600',
  },
  desc: {
    color: '#8A8FA8',
    fontSize: 12,
    marginTop: 2,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161D2E',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
    minWidth: 70,
  },
  dollar: {
    color: '#C4F135',
    fontSize: 16,
    fontWeight: '700',
  },
  input: {
    color: '#F4EFE6',
    fontSize: 16,
    fontWeight: '700',
    minWidth: 30,
    textAlign: 'center',
  },
  createBtn: {
    marginTop: 20,
    backgroundColor: '#C4F135',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  createBtnText: {
    color: '#080C14',
    fontSize: 15,
    fontWeight: '800',
  },
});
