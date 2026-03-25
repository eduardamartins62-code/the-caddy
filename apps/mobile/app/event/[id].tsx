import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, Modal, ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import {
  useEvent,
  useEventLeaderboard,
  useEventParticipants,
  useEventItinerary,
  useEventHistory,
} from '../../hooks/useQueries';
import { eventsApi, postsApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import AvatarRing from '../../components/ui/AvatarRing';
import GlassCard from '../../components/ui/GlassCard';
import GradientButton from '../../components/ui/GradientButton';
import SkeletonLoader from '../../components/ui/SkeletonLoader';
import { Colors, Radius, Spacing, Typography } from '../../constants/theme';

// ─── Socket placeholder ────────────────────────────────────────────────────────
// TODO: import { socket } from '../../services/socket';
// socket.on('leaderboard:updated', () => queryClient.invalidateQueries({ queryKey: ['leaderboard', id] }));

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'leaderboard' | 'rounds' | 'itinerary' | 'history' | 'social';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview',    label: 'Overview' },
  { key: 'leaderboard', label: 'Leaderboard' },
  { key: 'rounds',      label: 'Rounds' },
  { key: 'itinerary',   label: 'Itinerary' },
  { key: 'history',     label: 'History' },
  { key: 'social',      label: 'Social' },
];

const ITINERARY_TYPE_COLORS: Record<string, string> = {
  HOTEL:     Colors.purple,
  DINING:    Colors.orange,
  GOLF:      Colors.lime,
  TRANSPORT: '#3B82F6',
  NIGHTLIFE: '#EC4899',
  OTHER:     Colors.textMuted,
};

const ITINERARY_TYPE_ICONS: Record<string, string> = {
  HOTEL:     'bed-outline',
  DINING:    'restaurant-outline',
  GOLF:      'golf-outline',
  TRANSPORT: 'car-outline',
  NIGHTLIFE: 'musical-notes-outline',
  OTHER:     'layers-outline',
};

const STATUS_EVENT_FLOW = ['UPCOMING', 'LIVE', 'COMPLETED'] as const;

function fmt(d: string | Date | undefined | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function scoreColor(rel: number) {
  if (rel <= -2) return Colors.eagle;
  if (rel === -1) return Colors.birdie;
  if (rel === 0)  return Colors.par;
  if (rel === 1)  return Colors.bogey;
  return Colors.doubleBogey;
}

function fmtRelScore(score: number, par: number) {
  const rel = score - par;
  if (rel === 0) return { label: 'E', color: Colors.par };
  return { label: rel > 0 ? `+${rel}` : `${rel}`, color: scoreColor(rel) };
}

function statusBadgeColors(status: string) {
  if (status === 'LIVE')      return { bg: '#EF444422', text: Colors.error };
  if (status === 'COMPLETED') return { bg: Colors.limeDim,   text: Colors.lime };
  return { bg: Colors.purpleDim, text: Colors.purple };
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function HeroSkeleton() {
  return (
    <View style={[sk.hero, { paddingTop: 60 }]}>
      <SkeletonLoader width={36} height={36} borderRadius={18} style={{ marginBottom: 16 }} />
      <SkeletonLoader width="50%" height={12} style={{ marginBottom: 12 }} />
      <SkeletonLoader width="80%" height={28} style={{ marginBottom: 10 }} />
      <SkeletonLoader width="60%" height={14} />
    </View>
  );
}

const sk = StyleSheet.create({
  hero: { paddingHorizontal: Spacing.md, paddingBottom: 20, backgroundColor: '#1A1A2E' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [activeTab, setActiveTab]   = useState<Tab>('overview');
  const [lbMode, setLbMode]         = useState<'NET' | 'GROSS'>('NET');
  const [itinDay, setItinDay]       = useState(1);
  const [responding, setResponding] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const tabScrollRef = useRef<ScrollView>(null);

  // React Query hooks
  const {
    data: event, isLoading: eventLoading, isError: eventError,
    refetch: refetchEvent,
  } = useEvent(id);

  const {
    data: leaderboard = [], isLoading: lbLoading,
    refetch: refetchLb,
  } = useEventLeaderboard(id);

  const {
    data: participants = [], isLoading: participantsLoading,
    refetch: refetchParticipants,
  } = useEventParticipants(id);

  const {
    data: itinerary = [], isLoading: itinLoading,
    refetch: refetchItin,
  } = useEventItinerary(id);

  const {
    data: history = [], isLoading: historyLoading,
    refetch: refetchHistory,
  } = useEventHistory(id);

  const [socialPosts, setSocialPosts]   = useState<any[]>([]);
  const [socialLoading, setSocialLoading] = useState(false);
  const [socialError, setSocialError]   = useState(false);

  const loadSocial = useCallback(async () => {
    setSocialLoading(true);
    setSocialError(false);
    try {
      const posts = await eventsApi.socialPosts(id);
      setSocialPosts(posts || []);
    } catch {
      setSocialError(true);
    } finally {
      setSocialLoading(false);
    }
  }, [id]);

  // Load social when tab becomes active
  const prevTabRef = useRef<Tab>('overview');
  if (activeTab === 'social' && prevTabRef.current !== 'social') {
    loadSocial();
  }
  prevTabRef.current = activeTab;

  const isAdmin = user?.role === 'SCOREKEEPER' || user?.role === 'SUPER_ADMIN';

  const myParticipant = event?.participants?.find((p: any) => p.userId === user?.id)
    ?? participants?.find((p: any) => p.userId === user?.id);
  const myStatus = myParticipant?.status;

  // ─── Actions ───────────────────────────────────────────────────────────────

  async function respond(status: 'ACCEPTED' | 'DECLINED') {
    setResponding(true);
    try {
      await eventsApi.respond(id, status);
      qc.invalidateQueries({ queryKey: ['event', id] });
      qc.invalidateQueries({ queryKey: ['participants', id] });
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to respond');
    } finally {
      setResponding(false);
    }
  }

  async function toggleStatus() {
    if (!event) return;
    const currentIdx = STATUS_EVENT_FLOW.indexOf(event.status as any);
    if (currentIdx === -1 || currentIdx === STATUS_EVENT_FLOW.length - 1) return;
    const nextStatus = STATUS_EVENT_FLOW[currentIdx + 1];
    Alert.alert(
      'Change Status',
      `Move event to ${nextStatus}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setTogglingStatus(true);
            try {
              await eventsApi.updateStatus(id, nextStatus);
              qc.invalidateQueries({ queryKey: ['event', id] });
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to update status');
            } finally {
              setTogglingStatus(false);
            }
          },
        },
      ]
    );
  }

  async function likePost(postId: string, liked: boolean) {
    try {
      if (liked) {
        await postsApi.unlike(postId);
      } else {
        await postsApi.like(postId);
      }
      setSocialPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, liked: !liked, likes: (p.likes ?? 0) + (liked ? -1 : 1) }
            : p
        )
      );
    } catch { /* silent */ }
  }

  // ─── Loading / Error ────────────────────────────────────────────────────────

  if (eventLoading) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <HeroSkeleton />
        <View style={styles.tabBarWrap}>
          {TABS.map((t) => (
            <View key={t.key} style={styles.tabBtnSkeleton}>
              <SkeletonLoader width={50} height={12} />
            </View>
          ))}
        </View>
        <View style={styles.tabContent}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={{ marginBottom: 12 }}>
              <SkeletonLoader height={80} borderRadius={Radius.lg} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (eventError || !event) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
        <Text style={styles.errorTitle}>Failed to load event</Text>
        <TouchableOpacity onPress={() => refetchEvent()} style={styles.retryBtn}>
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusColors = statusBadgeColors(event.status);
  const days = [...new Set(itinerary.map((i: any) => i.day as number))].sort() as number[];
  const allDays = days.length > 0 ? days : [1];
  const nextStatus = STATUS_EVENT_FLOW[STATUS_EVENT_FLOW.indexOf(event.status as any) + 1];

  // ─── Hero ─────────────────────────────────────────────────────────────────

  const Hero = () => (
    <LinearGradient
      colors={['#1A1A2E', Colors.bg]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[styles.hero, { paddingTop: insets.top + 8 }]}
    >
      <View style={styles.heroTopRow}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        {isAdmin && nextStatus && (
          <TouchableOpacity
            style={styles.statusToggleBtn}
            onPress={toggleStatus}
            disabled={togglingStatus}
          >
            {togglingStatus
              ? <ActivityIndicator size="small" color={Colors.lime} />
              : <>
                  <Ionicons name="flash-outline" size={14} color={Colors.lime} />
                  <Text style={styles.statusToggleText}>Set {nextStatus}</Text>
                </>
            }
          </TouchableOpacity>
        )}
      </View>

      {/* Badges */}
      <View style={styles.badgesRow}>
        <View style={[styles.badge, { backgroundColor: statusColors.bg }]}>
          {event.status === 'LIVE' && (
            <View style={styles.liveDot} />
          )}
          <Text style={[styles.badgeText, { color: statusColors.text }]}>{event.status}</Text>
        </View>
        {event.type && (
          <View style={[styles.badge, { backgroundColor: Colors.bgTertiary, borderColor: Colors.cardBorder, borderWidth: 1 }]}>
            <Text style={[styles.badgeText, { color: Colors.textSecondary }]}>{event.type}</Text>
          </View>
        )}
      </View>

      <Text style={styles.heroName} numberOfLines={2}>{event.name}</Text>

      {/* Meta row */}
      <View style={styles.metaRow}>
        {event.location && (
          <>
            <Ionicons name="location-outline" size={13} color={Colors.textSecondary} />
            <Text style={styles.metaText} numberOfLines={1}>{event.location}</Text>
          </>
        )}
        {event.startDate && (
          <>
            <Ionicons name="calendar-outline" size={13} color={Colors.textSecondary} style={{ marginLeft: 10 }} />
            <Text style={styles.metaText}>{fmt(event.startDate)}{event.endDate ? ` – ${fmt(event.endDate)}` : ''}</Text>
          </>
        )}
      </View>

      {/* Participants stack */}
      {(event.participants?.length > 0 || participants.length > 0) && (() => {
        const pList = event.participants?.length > 0 ? event.participants : participants;
        return (
          <View style={styles.avatarRow}>
            {pList.slice(0, 5).map((p: any, i: number) => (
              <View key={p.id ?? i} style={[styles.avatarOffset, { marginLeft: i === 0 ? 0 : -10, zIndex: 5 - i }]}>
                <AvatarRing uri={p.user?.avatar} name={p.user?.name} size={28} ring="none" />
              </View>
            ))}
            {pList.length > 5 && (
              <View style={styles.moreAvatars}>
                <Text style={styles.moreAvatarsText}>+{pList.length - 5}</Text>
              </View>
            )}
            <Text style={styles.participantCount}>{pList.length} players</Text>
          </View>
        );
      })()}
    </LinearGradient>
  );

  // ─── Tab bar ──────────────────────────────────────────────────────────────

  const TabBar = () => (
    <View style={styles.tabBarWrap}>
      <ScrollView
        ref={tabScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabBarContent}
      >
        {TABS.map((t) => {
          const active = activeTab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabBtn, active && styles.tabBtnActive]}
              onPress={() => setActiveTab(t.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]}>{t.label}</Text>
              {active && <View style={styles.tabBtnUnderline} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  // ─── Tab 1: Overview ──────────────────────────────────────────────────────

  const OverviewTab = () => {
    const [refreshing, setRefreshing] = useState(false);
    const onRefresh = async () => {
      setRefreshing(true);
      await refetchEvent();
      setRefreshing(false);
    };

    const accepted = (event.participants ?? participants).filter((p: any) => p.status === 'ACCEPTED');

    return (
      <ScrollView
        contentContainerStyle={styles.tabContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.lime} />}
      >
        {/* RSVP card */}
        {myStatus === 'PENDING' && (
          <GlassCard glow="lime" style={styles.rsvpCard}>
            <View style={styles.rsvpIconRow}>
              <Ionicons name="mail-outline" size={22} color={Colors.lime} />
              <Text style={styles.rsvpTitle}>You're invited</Text>
            </View>
            <Text style={styles.rsvpSub}>Will you be joining {event.name}?</Text>
            <View style={styles.rsvpBtns}>
              <TouchableOpacity
                style={[styles.rsvpBtn, { backgroundColor: Colors.lime }]}
                onPress={() => respond('ACCEPTED')}
                disabled={responding}
              >
                {responding
                  ? <ActivityIndicator size="small" color={Colors.bg} />
                  : <Text style={[styles.rsvpBtnText, { color: Colors.bg }]}>Accept</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.rsvpBtn, styles.rsvpBtnOutline]}
                onPress={() => respond('DECLINED')}
                disabled={responding}
              >
                <Text style={[styles.rsvpBtnText, { color: Colors.textPrimary }]}>Decline</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        )}

        {/* Description */}
        {event.description ? (
          <GlassCard style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.descText}>{event.description}</Text>
          </GlassCard>
        ) : null}

        {/* Event details */}
        <GlassCard style={styles.section}>
          <Text style={styles.sectionTitle}>Event Details</Text>
          <DetailRow icon="calendar-outline" label="Dates" value={`${fmt(event.startDate)}${event.endDate ? ` – ${fmt(event.endDate)}` : ''}`} />
          {event.location ? <DetailRow icon="location-outline" label="Location" value={event.location} /> : null}
          {event.type ? <DetailRow icon="trophy-outline" label="Format" value={event.type} /> : null}
          {event.host?.name ? <DetailRow icon="person-outline" label="Host" value={event.host.name} /> : null}
        </GlassCard>

        {/* Stats */}
        <View style={styles.statsGrid}>
          <StatBox value={event._count?.rounds ?? event.rounds?.length ?? 0} label="Rounds" />
          <StatBox value={accepted.length} label="Players" />
          <StatBox value={event.rounds?.filter((r: any) => r.status === 'COMPLETED').length ?? 0} label="Completed" />
        </View>

        {/* Participants */}
        <GlassCard style={[styles.section, { marginTop: 14 }]}>
          <Text style={styles.sectionTitle}>
            Participants ({(event.participants ?? participants).length ?? 0})
          </Text>
          {(event.participants ?? participants).map((p: any) => (
            <TouchableOpacity
              key={p.id}
              style={styles.participantRow}
              onPress={() => router.push(`/profile/${p.userId}` as any)}
              activeOpacity={0.7}
            >
              <AvatarRing
                uri={p.user?.avatar}
                name={p.user?.name}
                size={38}
                ring={p.role === 'ADMIN' || p.role === 'SUPER_ADMIN' ? 'lime' : p.role === 'SCOREKEEPER' ? 'purple' : 'none'}
              />
              <View style={styles.participantInfo}>
                <Text style={styles.participantName}>{p.user?.name ?? 'Unknown'}</Text>
                <Text style={styles.participantSub}>{p.role} · {p.status}</Text>
              </View>
              {p.user?.handicap != null && (
                <View style={styles.hdcpPill}>
                  <Text style={styles.hdcpText}>HCP {p.user.handicap}</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          ))}
        </GlassCard>
      </ScrollView>
    );
  };

  // ─── Tab 2: Leaderboard ───────────────────────────────────────────────────

  const LeaderboardTab = () => {
    const [refreshing, setRefreshing] = useState(false);
    const onRefresh = async () => {
      setRefreshing(true);
      await refetchLb();
      setRefreshing(false);
    };

    const sorted = [...(leaderboard as any[])].sort((a, b) =>
      lbMode === 'NET' ? (a.netScore ?? 999) - (b.netScore ?? 999) : (a.grossScore ?? 999) - (b.grossScore ?? 999)
    );
    const totalPar = event.rounds?.reduce((s: number, r: any) => s + (r.coursePar || 72), 0) || 72;

    if (lbLoading) {
      return (
        <View style={styles.tabContent}>
          {[1, 2, 3, 4].map((i) => (
            <SkeletonLoader key={i} height={56} borderRadius={Radius.lg} style={{ marginBottom: 10 }} />
          ))}
        </View>
      );
    }

    return (
      <ScrollView
        contentContainerStyle={styles.tabContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.lime} />}
      >
        {/* NET / GROSS toggle */}
        <View style={styles.toggleRow}>
          {(['NET', 'GROSS'] as const).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.toggleBtn, lbMode === m && styles.toggleBtnActive]}
              onPress={() => setLbMode(m)}
            >
              <Text style={[styles.toggleText, lbMode === m && styles.toggleTextActive]}>{m} SCORE</Text>
            </TouchableOpacity>
          ))}
        </View>

        {sorted.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="podium-outline" size={40} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No scores recorded yet.</Text>
          </View>
        )}

        {/* #1 hero card */}
        {sorted[0] && (() => {
          const score = lbMode === 'NET' ? sorted[0].netScore : sorted[0].grossScore;
          const { label, color } = fmtRelScore(score ?? 0, totalPar);
          return (
            <LinearGradient colors={[Colors.limeDim, Colors.bg]} style={styles.lbHeroCard}>
              <View style={[styles.lbRank1Badge]}>
                <Text style={styles.lbRank1Text}>1</Text>
              </View>
              <AvatarRing uri={sorted[0].user?.avatar} name={sorted[0].user?.name} size={60} ring="lime" />
              <Text style={styles.lbHeroName}>{sorted[0].user?.name}</Text>
              {sorted[0].user?.handicap != null && (
                <Text style={styles.lbHeroHdcp}>HCP {sorted[0].user.handicap}</Text>
              )}
              <Text style={[styles.lbHeroScore, { color }]}>{label}</Text>
              <View style={styles.lbScoreDetail}>
                <Text style={styles.lbScoreDetailText}>Gross {sorted[0].grossScore ?? '—'}</Text>
                <Text style={styles.lbScoreDetailSep}>·</Text>
                <Text style={styles.lbScoreDetailText}>Net {sorted[0].netScore ?? '—'}</Text>
              </View>
            </LinearGradient>
          );
        })()}

        {/* Podium 2 & 3 */}
        {sorted.length > 1 && (
          <View style={styles.podiumRow}>
            {sorted.slice(1, 3).map((entry: any, i: number) => {
              const score = lbMode === 'NET' ? entry.netScore : entry.grossScore;
              const { label, color } = fmtRelScore(score ?? 0, totalPar);
              const rankColor = i === 0 ? '#C0C0C0' : '#CD7F32';
              return (
                <GlassCard key={entry.user?.id ?? i} style={styles.podiumCard}>
                  <Text style={[styles.podiumRank, { color: rankColor }]}>{i + 2}</Text>
                  <AvatarRing uri={entry.user?.avatar} name={entry.user?.name} size={40} ring="none" style={{ alignSelf: 'center', marginVertical: 6 } as any} />
                  <Text style={[styles.lbName, { textAlign: 'center' }]} numberOfLines={1}>{entry.user?.name}</Text>
                  <Text style={[styles.lbScore, { color, textAlign: 'center' }]}>{label}</Text>
                </GlassCard>
              );
            })}
          </View>
        )}

        {/* Rest of field */}
        {sorted.slice(3).map((entry: any, i: number) => {
          const score = lbMode === 'NET' ? entry.netScore : entry.grossScore;
          const { label, color } = fmtRelScore(score ?? 0, totalPar);
          return (
            <GlassCard key={entry.user?.id ?? i} style={styles.lbRow}>
              <Text style={styles.lbPosition}>{i + 4}</Text>
              <AvatarRing uri={entry.user?.avatar} name={entry.user?.name} size={34} ring="none" />
              <Text style={[styles.lbName, { flex: 1, marginLeft: 10 }]} numberOfLines={1}>{entry.user?.name}</Text>
              <View style={styles.lbScoreCol}>
                <Text style={[styles.lbScore, { color }]}>{label}</Text>
                <Text style={styles.lbScoreSmall}>{lbMode === 'NET' ? `G${entry.grossScore ?? '—'}` : `N${entry.netScore ?? '—'}`}</Text>
              </View>
            </GlassCard>
          );
        })}
      </ScrollView>
    );
  };

  // ─── Tab 3: Rounds ────────────────────────────────────────────────────────

  const RoundsTab = () => {
    const [refreshing, setRefreshing] = useState(false);
    const onRefresh = async () => {
      setRefreshing(true);
      await refetchParticipants();
      await refetchEvent();
      setRefreshing(false);
    };

    const rounds: any[] = event.rounds ?? [];

    if (participantsLoading && rounds.length === 0) {
      return (
        <View style={styles.tabContent}>
          {[1, 2].map((i) => (
            <SkeletonLoader key={i} height={90} borderRadius={Radius.lg} style={{ marginBottom: 12 }} />
          ))}
        </View>
      );
    }

    return (
      <ScrollView
        contentContainerStyle={styles.tabContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.lime} />}
      >
        {rounds.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="golf-outline" size={40} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No rounds scheduled yet.</Text>
          </View>
        )}
        {rounds.map((round: any, i: number) => {
          const { bg: sBg, text: sText } = statusBadgeColors(round.status ?? 'UPCOMING');
          return (
            <TouchableOpacity
              key={round.id}
              activeOpacity={0.8}
              onPress={() => router.push(`/round/${round.id}` as any)}
            >
              <GlassCard style={styles.roundCard} glow={round.status === 'LIVE' ? 'lime' : 'none'}>
                <View style={styles.roundCardRow}>
                  <View style={styles.roundNumBadge}>
                    <Text style={styles.roundNumText}>R{round.roundNumber ?? i + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.roundCourseName} numberOfLines={1}>
                      {round.courseName ?? `Round ${round.roundNumber ?? i + 1}`}
                    </Text>
                    <Text style={styles.roundMeta}>
                      {fmt(round.date)}{round.coursePar ? ` · Par ${round.coursePar}` : ''}
                    </Text>
                    {round.players != null && (
                      <Text style={styles.roundMeta}>{round.players} players</Text>
                    )}
                  </View>
                  <View style={[styles.roundStatusPill, { backgroundColor: sBg }]}>
                    <Text style={[styles.roundStatusText, { color: sText }]}>{round.status ?? 'UPCOMING'}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} style={{ alignSelf: 'flex-end', marginTop: 4 }} />
              </GlassCard>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  };

  // ─── Tab 4: Itinerary ─────────────────────────────────────────────────────

  const ItineraryTab = () => {
    const [refreshing, setRefreshing] = useState(false);
    const onRefresh = async () => {
      setRefreshing(true);
      await refetchItin();
      setRefreshing(false);
    };

    const dayItems = itinerary.filter((item: any) => item.day === itinDay);

    if (itinLoading) {
      return (
        <View style={styles.tabContent}>
          {[1, 2, 3].map((i) => (
            <SkeletonLoader key={i} height={80} borderRadius={Radius.lg} style={{ marginBottom: 10 }} />
          ))}
        </View>
      );
    }

    return (
      <View style={{ flex: 1 }}>
        {/* Day selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dayPills}
        >
          {allDays.map((d) => (
            <TouchableOpacity
              key={d}
              style={[styles.dayPill, itinDay === d && styles.dayPillActive]}
              onPress={() => setItinDay(d)}
            >
              <Text style={[styles.dayPillText, itinDay === d && styles.dayPillTextActive]}>Day {d}</Text>
            </TouchableOpacity>
          ))}
          {isAdmin && (
            <TouchableOpacity style={styles.addItinBtn}>
              <Ionicons name="add" size={16} color={Colors.lime} />
              <Text style={styles.addItinText}>Add</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        <ScrollView
          contentContainerStyle={styles.tabContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.lime} />}
        >
          {dayItems.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={40} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No activities for Day {itinDay}.</Text>
            </View>
          )}
          {dayItems.map((item: any) => {
            const typeColor = ITINERARY_TYPE_COLORS[item.type] || Colors.textMuted;
            const iconName = ITINERARY_TYPE_ICONS[item.type] || 'layers-outline';
            return (
              <GlassCard key={item.id} style={styles.itinCard}>
                <View style={styles.itinRow}>
                  <View style={[styles.itinIconBox, { backgroundColor: typeColor + '22', borderColor: typeColor + '44' }]}>
                    <Ionicons name={iconName as any} size={18} color={typeColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.itinTitleRow}>
                      <Text style={styles.itinTitle}>{item.title}</Text>
                      <View style={[styles.itinTypePill, { backgroundColor: typeColor + '22' }]}>
                        <Text style={[styles.itinTypePillText, { color: typeColor }]}>{item.type}</Text>
                      </View>
                    </View>
                    {item.time && (
                      <Text style={styles.itinTime}>{item.time}</Text>
                    )}
                    {item.location && (
                      <View style={styles.itinLocRow}>
                        <Ionicons name="location-outline" size={11} color={Colors.textSecondary} />
                        <Text style={styles.itinLocText}>{item.location}</Text>
                      </View>
                    )}
                    {item.description && (
                      <Text style={styles.itinDesc}>{item.description}</Text>
                    )}
                  </View>
                </View>
              </GlassCard>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  // ─── Tab 5: History ───────────────────────────────────────────────────────

  const HistoryTab = () => {
    const [refreshing, setRefreshing] = useState(false);
    const onRefresh = async () => {
      setRefreshing(true);
      await refetchHistory();
      setRefreshing(false);
    };

    if (historyLoading) {
      return (
        <View style={styles.tabContent}>
          {[1, 2].map((i) => (
            <SkeletonLoader key={i} height={100} borderRadius={Radius.lg} style={{ marginBottom: 12 }} />
          ))}
        </View>
      );
    }

    if (event.recurrence === 'ONE_TIME') {
      return (
        <View style={[styles.tabContent, styles.center]}>
          <Ionicons name="time-outline" size={40} color={Colors.textMuted} />
          <Text style={styles.emptyText}>History is only available for recurring events.</Text>
        </View>
      );
    }

    const sorted = [...(history as any[])].sort((a, b) => (b.year ?? 0) - (a.year ?? 0));

    return (
      <ScrollView
        contentContainerStyle={styles.tabContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.lime} />}
      >
        {sorted.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="trophy-outline" size={40} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No historical records yet.</Text>
          </View>
        )}
        {sorted.map((entry: any) => (
          <GlassCard key={entry.id} style={styles.histCard}>
            <View style={styles.histCardRow}>
              <View style={styles.histYearBadge}>
                <Text style={styles.histYear}>{entry.year}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <View style={styles.histChampionRow}>
                  <Ionicons name="trophy" size={14} color={Colors.lime} />
                  <Text style={styles.histChampion}>{entry.champion ?? entry.winner ?? '—'}</Text>
                </View>
                {entry.coursePlayed && (
                  <Text style={styles.histMeta}>{entry.coursePlayed}</Text>
                )}
                {entry.winningScore != null && (
                  <Text style={styles.histMeta}>Score: {entry.winningScore}</Text>
                )}
              </View>
            </View>
            {entry.recap ? (
              <Text style={styles.histRecap}>{entry.recap}</Text>
            ) : null}
          </GlassCard>
        ))}
      </ScrollView>
    );
  };

  // ─── Tab 6: Social ────────────────────────────────────────────────────────

  const SocialTab = () => {
    const [refreshing, setRefreshing] = useState(false);
    const onRefresh = async () => {
      setRefreshing(true);
      await loadSocial();
      setRefreshing(false);
    };

    if (socialLoading) {
      return (
        <View style={styles.tabContent}>
          {[1, 2, 3].map((i) => (
            <SkeletonLoader key={i} height={120} borderRadius={Radius.lg} style={{ marginBottom: 12 }} />
          ))}
        </View>
      );
    }

    if (socialError) {
      return (
        <View style={[styles.tabContent, styles.center]}>
          <Ionicons name="cloud-offline-outline" size={40} color={Colors.error} />
          <Text style={styles.emptyText}>Failed to load posts.</Text>
          <TouchableOpacity onPress={loadSocial} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <ScrollView
        contentContainerStyle={styles.tabContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.lime} />}
      >
        {socialPosts.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={40} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No posts yet. Be the first to share!</Text>
          </View>
        )}
        {socialPosts.map((post: any) => (
          <GlassCard key={post.id} style={styles.postCard}>
            <View style={styles.postHeader}>
              <AvatarRing uri={post.user?.avatar} name={post.user?.name} size={36} ring="none" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.postUser}>{post.user?.name ?? 'Unknown'}</Text>
                <Text style={styles.postTime}>{fmt(post.createdAt)}</Text>
              </View>
            </View>
            {post.content ? <Text style={styles.postContent}>{post.content}</Text> : null}
            <View style={styles.postActions}>
              <TouchableOpacity
                style={styles.postAction}
                onPress={() => likePost(post.id, post.liked)}
              >
                <Ionicons
                  name={post.liked ? 'heart' : 'heart-outline'}
                  size={16}
                  color={post.liked ? Colors.error : Colors.textSecondary}
                />
                <Text style={[styles.postActionText, post.liked && { color: Colors.error }]}>
                  {post.likes ?? 0}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.postAction}>
                <Ionicons name="chatbubble-outline" size={15} color={Colors.textSecondary} />
                <Text style={styles.postActionText}>Comment</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.postAction}>
                <Ionicons name="share-outline" size={15} color={Colors.textSecondary} />
                <Text style={styles.postActionText}>Share</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        ))}
      </ScrollView>
    );
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  const renderTab = () => {
    switch (activeTab) {
      case 'overview':    return <OverviewTab />;
      case 'leaderboard': return <LeaderboardTab />;
      case 'rounds':      return <RoundsTab />;
      case 'itinerary':   return <ItineraryTab />;
      case 'history':     return <HistoryTab />;
      case 'social':      return <SocialTab />;
    }
  };

  return (
    <View style={[styles.screen, { paddingBottom: insets.bottom + 90 }]}>
      <Hero />
      <TabBar />
      <View style={{ flex: 1 }}>{renderTab()}</View>
    </View>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function DetailRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon as any} size={15} color={Colors.lime} />
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function StatBox({ value, label }: { value: number | string; label: string }) {
  return (
    <GlassCard style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </GlassCard>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: Colors.bg },
  center:  { alignItems: 'center', justifyContent: 'center' },

  // Hero
  hero:         { paddingHorizontal: Spacing.md, paddingBottom: 20 },
  heroTopRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  statusToggleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.limeDim,
    borderRadius: Radius.full,
    paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: Colors.lime + '44',
  },
  statusToggleText: { color: Colors.lime, fontSize: 12, fontWeight: '700' },
  badgesRow: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  badge: { borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 5 },
  badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.error },
  heroName: { color: Colors.textPrimary, fontSize: 26, fontWeight: '800', marginBottom: 10, lineHeight: 32 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 14, flexWrap: 'wrap' },
  metaText: { color: Colors.textSecondary, fontSize: 13 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  avatarOffset: {},
  moreAvatars: {
    width: 28, height: 28, borderRadius: 14, marginLeft: -10,
    backgroundColor: Colors.bgTertiary, borderWidth: 1, borderColor: Colors.cardBorder,
    alignItems: 'center', justifyContent: 'center', zIndex: 0,
  },
  moreAvatarsText:   { color: Colors.textSecondary, fontSize: 9, fontWeight: '700' },
  participantCount:  { color: Colors.textSecondary, fontSize: 12, marginLeft: 8 },

  // Tab bar
  tabBarWrap:    { borderBottomWidth: 1, borderBottomColor: Colors.cardBorder, backgroundColor: Colors.bg },
  tabBarContent: { paddingHorizontal: 12, paddingVertical: 4 },
  tabBtn:        { paddingHorizontal: 14, paddingVertical: 10, position: 'relative' },
  tabBtnActive:  {},
  tabBtnSkeleton:{ paddingHorizontal: 14, paddingVertical: 10 },
  tabBtnText:     { color: Colors.textSecondary, fontSize: 13, fontWeight: '500' },
  tabBtnTextActive: { color: Colors.textPrimary, fontWeight: '700' },
  tabBtnUnderline: {
    position: 'absolute', bottom: 0, left: 14, right: 14,
    height: 2, borderRadius: 1, backgroundColor: Colors.lime,
  },

  // Tab content
  tabContent: { padding: Spacing.md, paddingBottom: 40 },

  // Overview
  section:        { marginBottom: 14 },
  rsvpCard:       { marginBottom: 16 },
  rsvpIconRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  rsvpTitle:      { color: Colors.textPrimary, fontSize: 16, fontWeight: '700' },
  rsvpSub:        { color: Colors.textSecondary, fontSize: 13, marginBottom: 14 },
  rsvpBtns:       { flexDirection: 'row', gap: 10 },
  rsvpBtn:        { flex: 1, height: 42, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  rsvpBtnOutline: { backgroundColor: Colors.bgTertiary, borderWidth: 1, borderColor: Colors.cardBorder },
  rsvpBtnText:    { fontSize: 14, fontWeight: '700' },
  sectionTitle:   { color: Colors.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 14 },
  descText:       { color: Colors.textSecondary, fontSize: 14, lineHeight: 21 },
  detailRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  detailLabel:    { color: Colors.textSecondary, fontSize: 13, width: 72, flexShrink: 0 },
  detailValue:    { color: Colors.textPrimary, fontSize: 13, flex: 1 },
  statsGrid:      { flexDirection: 'row', gap: 10 },
  statBox:        { flex: 1, alignItems: 'center', padding: 14 },
  statValue:      { color: Colors.lime, fontSize: 22, fontWeight: '800' },
  statLabel:      { color: Colors.textSecondary, fontSize: 11, marginTop: 4 },
  participantRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.cardBorder + '55',
  },
  participantInfo: { flex: 1, marginLeft: 10 },
  participantName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  participantSub:  { color: Colors.textSecondary, fontSize: 11, marginTop: 2 },
  hdcpPill:        { backgroundColor: Colors.limeDim, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3, marginRight: 8 },
  hdcpText:        { color: Colors.lime, fontSize: 10, fontWeight: '700' },

  // Leaderboard
  toggleRow:       { flexDirection: 'row', gap: 6, marginBottom: 16, backgroundColor: Colors.bgSecondary, borderRadius: Radius.md, padding: 4 },
  toggleBtn:       { flex: 1, paddingVertical: 8, borderRadius: Radius.sm, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: Colors.lime },
  toggleText:      { color: Colors.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  toggleTextActive:{ color: Colors.bg },
  lbHeroCard:      { borderRadius: Radius.lg, marginBottom: 14, padding: 24, alignItems: 'center', gap: 6 },
  lbRank1Badge:    { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.lime, alignItems: 'center', justifyContent: 'center' },
  lbRank1Text:     { color: Colors.bg, fontSize: 16, fontWeight: '900' },
  lbHeroName:      { color: Colors.textPrimary, fontSize: 18, fontWeight: '800', marginTop: 6 },
  lbHeroHdcp:      { color: Colors.textSecondary, fontSize: 12 },
  lbHeroScore:     { fontSize: 36, fontWeight: '900', marginTop: 2 },
  lbScoreDetail:   { flexDirection: 'row', gap: 10, marginTop: 4 },
  lbScoreDetailText: { color: Colors.textSecondary, fontSize: 12 },
  lbScoreDetailSep:  { color: Colors.textMuted, fontSize: 12 },
  podiumRow:       { flexDirection: 'row', gap: 10, marginBottom: 12 },
  podiumCard:      { flex: 1, alignItems: 'center', paddingVertical: 16 },
  podiumRank:      { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  lbRow:           { flexDirection: 'row', alignItems: 'center', marginBottom: 8, padding: 12 },
  lbPosition:      { color: Colors.textSecondary, fontSize: 16, fontWeight: '700', width: 32 },
  lbName:          { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  lbScore:         { fontSize: 18, fontWeight: '800' },
  lbScoreCol:      { alignItems: 'flex-end' },
  lbScoreSmall:    { color: Colors.textMuted, fontSize: 11, marginTop: 2 },

  // Rounds
  roundCard:       { marginBottom: 12 },
  roundCardRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  roundNumBadge:   { width: 38, height: 38, borderRadius: 10, backgroundColor: Colors.limeDim, alignItems: 'center', justifyContent: 'center' },
  roundNumText:    { color: Colors.lime, fontSize: 12, fontWeight: '800' },
  roundCourseName: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  roundMeta:       { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  roundStatusPill: { borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  roundStatusText: { fontSize: 10, fontWeight: '700' },

  // Itinerary
  dayPills:        { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  dayPill:         { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.bgSecondary, borderWidth: 1, borderColor: Colors.cardBorder },
  dayPillActive:   { backgroundColor: Colors.lime, borderColor: Colors.lime },
  dayPillText:     { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  dayPillTextActive: { color: Colors.bg },
  addItinBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.limeDim, borderWidth: 1, borderColor: Colors.lime + '44' },
  addItinText:     { color: Colors.lime, fontSize: 13, fontWeight: '600' },
  itinCard:        { marginBottom: 10 },
  itinRow:         { flexDirection: 'row', gap: 12 },
  itinIconBox:     { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, flexShrink: 0 },
  itinTitleRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  itinTitle:       { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  itinTypePill:    { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  itinTypePillText:{ fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  itinTime:        { color: Colors.lime, fontSize: 12, fontWeight: '600', marginTop: 3 },
  itinLocRow:      { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  itinLocText:     { color: Colors.textSecondary, fontSize: 11 },
  itinDesc:        { color: Colors.textSecondary, fontSize: 12, marginTop: 6, lineHeight: 17 },

  // History
  histCard:        { marginBottom: 12 },
  histCardRow:     { flexDirection: 'row', alignItems: 'center' },
  histYearBadge:   { backgroundColor: Colors.limeDim, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 10, minWidth: 60, alignItems: 'center' },
  histYear:        { color: Colors.lime, fontSize: 18, fontWeight: '900' },
  histChampionRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  histChampion:    { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  histMeta:        { color: Colors.textSecondary, fontSize: 12, marginTop: 3 },
  histRecap:       { color: Colors.textSecondary, fontSize: 13, marginTop: 10, lineHeight: 19 },

  // Social
  postCard:        { marginBottom: 12 },
  postHeader:      { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  postUser:        { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  postTime:        { color: Colors.textSecondary, fontSize: 11, marginTop: 1 },
  postContent:     { color: Colors.textPrimary, fontSize: 14, lineHeight: 20, marginBottom: 12 },
  postActions:     { flexDirection: 'row', gap: 20, borderTopWidth: 1, borderTopColor: Colors.cardBorder, paddingTop: 10 },
  postAction:      { flexDirection: 'row', alignItems: 'center', gap: 6 },
  postActionText:  { color: Colors.textSecondary, fontSize: 12 },

  // Empty / Error
  emptyState:    { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyText:     { color: Colors.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  errorTitle:    { color: Colors.textPrimary, fontSize: 16, fontWeight: '700', marginTop: 12 },
  retryBtn:      { marginTop: 12, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: Colors.limeDim, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.lime + '44' },
  retryText:     { color: Colors.lime, fontSize: 13, fontWeight: '700' },
});
