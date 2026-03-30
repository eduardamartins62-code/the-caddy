import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { roundsApi } from '../../services/api';
import GlassCard from '../../components/ui/GlassCard';
import { Colors, Radius, Spacing } from '../../constants/theme';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(d: string | Date | undefined | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function relLabel(diff: number) {
  if (diff === 0) return 'E';
  return diff > 0 ? `+${diff}` : `${diff}`;
}

function pct(num: number, den: number) {
  if (!den) return '–';
  return `${Math.round((num / den) * 100)}%`;
}

function scoreToParColor(diff: number) {
  if (diff < 0) return Colors.lime;   // under par → lime
  if (diff === 0) return Colors.textPrimary; // even → white
  return Colors.error;                // over par → red
}

// ─── Score type colors (matching the scorecard) ───────────────────────────────

const SCORE_TYPES = [
  { key: 'eagles',  label: 'Eagles',  emoji: '🦅', color: '#FFD700', bg: '#FFD70022' },
  { key: 'birdies', label: 'Birdies', emoji: '🐦', color: '#E8365D', bg: '#E8365D22' },
  { key: 'pars',    label: 'Pars',    emoji: '▪',  color: '#8A8A9A', bg: '#3A3A4A55' },
  { key: 'bogeys',  label: 'Bogeys',  emoji: '+1', color: '#4A7FC1', bg: '#4A7FC122' },
  { key: 'doubles', label: 'Doubles', emoji: '+2', color: '#2C5282', bg: '#2C528233' },
  { key: 'triples', label: 'Triple+', emoji: '++', color: '#A0A0B0', bg: '#1A1A2E88' },
] as const;

// ─── Stat card component ──────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={s.statCard}>
      <Text style={s.statCardValue}>{value}</Text>
      <Text style={s.statCardLabel}>{label}</Text>
      {sub ? <Text style={s.statCardSub}>{sub}</Text> : null}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function RoundStatsScreen() {
  const { roundId } = useLocalSearchParams<{ roundId: string }>();
  const insets      = useSafeAreaInsets();
  const router      = useRouter();

  const { data: stats, isLoading, isError, refetch } = useQuery({
    queryKey: ['roundStats', roundId],
    queryFn:  () => (roundsApi as any).getStats(roundId),
    enabled:  !!roundId,
  });

  // ─── Loading ─────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={[s.screen, { paddingTop: insets.top }, s.centred]}>
        <ActivityIndicator size="large" color={Colors.lime} />
        <Text style={s.loadingText}>Loading stats…</Text>
      </View>
    );
  }

  // ─── Error ───────────────────────────────────────────────────────────────
  if (isError || !stats) {
    return (
      <View style={[s.screen, { paddingTop: insets.top }, s.centred]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.error} style={{ marginTop: 40 }} />
        <Text style={s.errorTitle}>Could not load stats</Text>
        <TouchableOpacity style={s.retryBtn} onPress={() => refetch()}>
          <Text style={s.retryText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const scoreToPar   = (stats.totalStrokes ?? 0) - (stats.coursePar ?? 72);
  const holesPlayed  = stats.holesPlayed ?? 18;
  const girTotal     = stats.greensInRegulation ?? 0;
  const fwTotal      = stats.fairwaysHit ?? 0;
  const fwOpps       = stats.fairwayOpportunities ?? 14;
  const totalPutts   = stats.totalPutts ?? 0;
  const puttsPerHole = holesPlayed > 0 ? (totalPutts / holesPlayed).toFixed(2) : '–';

  const scoreCounts: Record<string, number> = {
    eagles:  stats.eagles  ?? 0,
    birdies: stats.birdies ?? 0,
    pars:    stats.pars    ?? 0,
    bogeys:  stats.bogeys  ?? 0,
    doubles: stats.doubles ?? 0,
    triples: stats.triples ?? 0,
  };

  const players: any[] = stats.players ?? [];

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Round Stats</Text>
        <Text style={s.headerDate}>{fmt(stats.date)}</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]}
      >
        {/* ── Score Card ── */}
        <GlassCard glow="lime" style={s.scoreSummary}>
          <View style={s.scoreRow}>
            <View style={s.scoreItem}>
              <Text style={s.scoreBigLabel}>TOTAL</Text>
              <Text style={s.scoreBigValue}>{stats.totalStrokes ?? '–'}</Text>
            </View>
            <View style={s.scoreDivider} />
            <View style={s.scoreItem}>
              <Text style={s.scoreBigLabel}>SCORE TO PAR</Text>
              <Text style={[s.scoreBigValue, { color: scoreToParColor(scoreToPar) }]}>
                {relLabel(scoreToPar)}
              </Text>
            </View>
            <View style={s.scoreDivider} />
            <View style={s.scoreItem}>
              <Text style={s.scoreBigLabel}>HOLES</Text>
              <Text style={s.scoreBigValue}>{holesPlayed}</Text>
            </View>
          </View>
        </GlassCard>

        {/* ── Scoring Breakdown ── */}
        <Text style={s.sectionTitle}>SCORING BREAKDOWN</Text>
        <View style={s.scoreBreakdownRow}>
          {SCORE_TYPES.map((t) => {
            const count = scoreCounts[t.key] ?? 0;
            return (
              <View
                key={t.key}
                style={[s.scoreTypeBox, { backgroundColor: t.bg, borderColor: t.color + '55' }]}
              >
                <Text style={s.scoreTypeEmoji}>{t.emoji}</Text>
                <Text style={[s.scoreTypeCount, { color: t.color }]}>{count}</Text>
                <Text style={s.scoreTypeLabel}>{t.label}</Text>
              </View>
            );
          })}
        </View>

        {/* ── Stats Grid ── */}
        <Text style={s.sectionTitle}>ROUND STATS</Text>
        <View style={s.statGrid}>
          <StatCard
            label="Fairways Hit"
            value={`${fwTotal}/${fwOpps}`}
            sub={pct(fwTotal, fwOpps)}
          />
          <StatCard
            label="Greens in Reg"
            value={`${girTotal}/${holesPlayed}`}
            sub={pct(girTotal, holesPlayed)}
          />
          <StatCard
            label="Total Putts"
            value={String(totalPutts || '–')}
          />
          <StatCard
            label="Putts/Hole"
            value={String(puttsPerHole)}
          />
        </View>

        {/* ── Per-player breakdown ── */}
        {players.length > 1 && (
          <>
            <Text style={s.sectionTitle}>PLAYERS</Text>
            <GlassCard style={{ marginHorizontal: Spacing.md }}>
              {players.map((p: any, idx: number) => {
                const pRel = (p.totalStrokes ?? 0) - (stats.coursePar ?? 72);
                return (
                  <View
                    key={p.userId ?? idx}
                    style={[s.playerRow, idx > 0 && s.playerRowBorder]}
                  >
                    <Text style={s.playerName} numberOfLines={1}>{p.name ?? 'Player'}</Text>
                    <View style={s.playerStats}>
                      <Text style={[s.playerRel, { color: scoreToParColor(pRel) }]}>
                        {relLabel(pRel)}
                      </Text>
                      {p.birdies != null && (
                        <View style={s.playerBadge}>
                          <Text style={s.playerBadgeText}>🐦 {p.birdies}</Text>
                        </View>
                      )}
                      {p.greensInRegulation != null && p.holesPlayed != null && (
                        <View style={s.playerBadge}>
                          <Text style={s.playerBadgeText}>GIR {pct(p.greensInRegulation, p.holesPlayed)}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </GlassCard>
          </>
        )}

        {/* ── Play Again button ── */}
        <TouchableOpacity
          style={s.playAgainBtn}
          onPress={() => router.replace('/event/create' as any)}
          activeOpacity={0.85}
        >
          <Ionicons name="golf-outline" size={18} color={Colors.bg} style={{ marginRight: 8 }} />
          <Text style={s.playAgainText}>Play Again</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: Colors.bg },
  centred: { alignItems: 'center', justifyContent: 'center' },
  scroll:  { paddingTop: 8 },

  loadingText: { color: Colors.textSecondary, marginTop: 12, fontSize: 14 },

  // Header
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
  headerDate:  { color: Colors.textMuted, fontSize: 12 },

  // Score summary card
  scoreSummary: {
    marginHorizontal: Spacing.md, marginTop: 16, marginBottom: 4,
    paddingVertical: 20,
  },
  scoreRow: { flexDirection: 'row', alignItems: 'center' },
  scoreItem: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  scoreDivider: { width: 1, height: 48, backgroundColor: Colors.cardBorder },
  scoreBigLabel: {
    color: Colors.textSecondary, fontSize: 9, fontWeight: '700',
    letterSpacing: 1, marginBottom: 6,
  },
  scoreBigValue: { color: Colors.textPrimary, fontSize: 32, fontWeight: '900' },

  // Section titles
  sectionTitle: {
    color: Colors.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 1,
    marginHorizontal: Spacing.md, marginTop: 20, marginBottom: 10,
  },

  // Scoring breakdown
  scoreBreakdownRow: {
    flexDirection: 'row', flexWrap: 'wrap',
    marginHorizontal: Spacing.md, gap: 6,
  },
  scoreTypeBox: {
    flex: 1, minWidth: 48, alignItems: 'center',
    borderRadius: Radius.md, paddingVertical: 10, paddingHorizontal: 4,
    borderWidth: 1,
  },
  scoreTypeEmoji: { fontSize: 14, marginBottom: 4 },
  scoreTypeCount: { fontSize: 22, fontWeight: '900' },
  scoreTypeLabel: {
    color: Colors.textMuted, fontSize: 9, fontWeight: '600',
    letterSpacing: 0.3, marginTop: 2,
  },

  // Stat grid
  statGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    marginHorizontal: Spacing.md, gap: 10,
  },
  statCard: {
    flex: 1, minWidth: '44%',
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.lg, padding: 16,
    alignItems: 'center',
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  statCardValue: { color: Colors.textPrimary, fontSize: 26, fontWeight: '900' },
  statCardLabel: {
    color: Colors.textSecondary, fontSize: 12, fontWeight: '600',
    marginTop: 4, textAlign: 'center',
  },
  statCardSub: { color: Colors.lime, fontSize: 13, fontWeight: '700', marginTop: 2 },

  // Per-player
  playerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  playerRowBorder: { borderTopWidth: 1, borderTopColor: Colors.cardBorder },
  playerName:  { flex: 1, color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  playerStats: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  playerRel:   { fontSize: 16, fontWeight: '800', minWidth: 36, textAlign: 'right' },
  playerBadge: {
    backgroundColor: Colors.bgTertiary, borderRadius: Radius.sm,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  playerBadgeText: { color: Colors.textSecondary, fontSize: 11, fontWeight: '600' },

  // Play Again
  playAgainBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginHorizontal: Spacing.md, marginTop: 24,
    backgroundColor: Colors.lime,
    borderRadius: Radius.pill, height: 52,
  },
  playAgainText: { color: Colors.bg, fontSize: 16, fontWeight: '800' },

  // Error
  errorTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700', marginTop: 12 },
  retryBtn: {
    marginTop: 16, paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: Colors.limeDim, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.lime + '44',
  },
  retryText: { color: Colors.lime, fontSize: 13, fontWeight: '700' },
});
