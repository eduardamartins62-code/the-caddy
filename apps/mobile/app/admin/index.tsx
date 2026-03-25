import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usersApi, eventsApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import AvatarRing from '../../components/ui/AvatarRing';
import GlassCard from '../../components/ui/GlassCard';
import { Colors, Radius, Spacing } from '../../constants/theme';

// ─── Quick action sections ─────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  {
    label: 'Manage Players',
    sub: 'Users & roles',
    route: '/admin/players',
    icon: 'people-outline' as const,
    color: '#3B82F6',
  },
  {
    label: 'Manage Rounds',
    sub: 'Create & edit rounds',
    route: '/admin/rounds',
    icon: 'flag-outline' as const,
    color: Colors.lime,
  },
  {
    label: 'Score Entry',
    sub: 'Per-hole score entry',
    route: '/admin/scores',
    icon: 'clipboard-outline' as const,
    color: Colors.purple,
  },
  {
    label: 'Event History',
    sub: 'Past tournament records',
    route: '/admin/history',
    icon: 'time-outline' as const,
    color: '#F97316',
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const isAuthorized =
    user?.role === 'SUPER_ADMIN' || user?.role === 'SCOREKEEPER';

  const { data: allUsers = [], isLoading: usersLoading, error: usersError } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => usersApi.list(),
    enabled: isAuthorized,
  });

  const { data: events = [], isLoading: eventsLoading, error: eventsError } = useQuery({
    queryKey: ['admin-events'],
    queryFn: () => eventsApi.list(),
    enabled: isAuthorized,
  });

  const isLoading = usersLoading || eventsLoading;
  const hasError = usersError || eventsError;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-events'] }),
    ]);
    setRefreshing(false);
  }, [queryClient]);

  // ── Access guard ──────────────────────────────────────────────────────────
  if (!isAuthorized) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 20 }]}>
        <View style={styles.accessDenied}>
          <Ionicons name="shield-outline" size={48} color={Colors.error} />
          <Text style={styles.accessDeniedTitle}>Access Denied</Text>
          <Text style={styles.accessDeniedSub}>
            You need SUPER_ADMIN or SCOREKEEPER role to view this screen.
          </Text>
          <TouchableOpacity style={styles.backBtnCenter} onPress={() => router.back()}>
            <Text style={styles.backBtnCenterText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Derived stats ─────────────────────────────────────────────────────────
  const totalUsers = allUsers.length;
  const totalEvents = events.length;
  const activeEvents = events.filter((e: any) => e.isActive || e.status === 'ACTIVE').length;
  const liveEvents = events.filter((e: any) => e.status === 'LIVE').length;
  const totalRounds = events.reduce((sum: number, e: any) => sum + (e.rounds?.length ?? 0), 0);

  const recentEvents = [...events]
    .sort((a: any, b: any) => new Date(b.createdAt ?? b.startDate ?? 0).getTime() - new Date(a.createdAt ?? a.startDate ?? 0).getTime())
    .slice(0, 5);

  const STATS = [
    { label: 'Total Users', value: totalUsers, icon: 'people' as const, color: '#3B82F6' },
    { label: 'Active Events', value: activeEvents, icon: 'calendar' as const, color: Colors.lime },
    { label: 'Total Rounds', value: totalRounds, icon: 'flag' as const, color: Colors.purple },
    { label: 'Live Events', value: liveEvents, icon: 'radio' as const, color: '#F97316' },
  ];

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Admin Dashboard</Text>
          <Text style={styles.subtitle}>
            {user?.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Scorekeeper'} · {user?.name}
          </Text>
        </View>
        <View style={styles.rolePill}>
          <Ionicons name="shield-checkmark" size={12} color={Colors.lime} />
          <Text style={styles.rolePillText}>Admin</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.lime} />
        }
      >
        {/* ── Error state ── */}
        {hasError && (
          <GlassCard style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={20} color={Colors.error} />
            <Text style={styles.errorText}>Failed to load stats.</Text>
            <TouchableOpacity onPress={onRefresh}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </GlassCard>
        )}

        {/* ── Stats ── */}
        <Text style={styles.sectionLabel}>OVERVIEW</Text>
        {isLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={Colors.lime} />
          </View>
        ) : (
          <View style={styles.statsGrid}>
            {STATS.map(stat => (
              <GlassCard key={stat.label} style={styles.statCard} padding={14}>
                <View style={[styles.statIconWrap, { backgroundColor: stat.color + '22' }]}>
                  <Ionicons name={stat.icon} size={20} color={stat.color} />
                </View>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </GlassCard>
            ))}
          </View>
        )}

        {/* ── Quick Actions ── */}
        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>MANAGEMENT</Text>
        <View style={styles.actionsGrid}>
          {QUICK_ACTIONS.map(action => (
            <TouchableOpacity
              key={action.label}
              style={styles.actionCard}
              activeOpacity={0.75}
              onPress={() => router.push(action.route as any)}
            >
              <View style={[styles.actionIcon, { backgroundColor: action.color + '22' }]}>
                <Ionicons name={action.icon} size={22} color={action.color} />
              </View>
              <Text style={styles.actionLabel}>{action.label}</Text>
              <Text style={styles.actionSub}>{action.sub}</Text>
              <Ionicons
                name="chevron-forward"
                size={14}
                color={Colors.textMuted}
                style={{ alignSelf: 'flex-end', marginTop: 8 }}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Recent Activity ── */}
        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>RECENT ACTIVITY</Text>
        <GlassCard style={styles.activityCard} padding={0}>
          {recentEvents.length === 0 ? (
            <Text style={styles.emptyText}>No events found.</Text>
          ) : (
            recentEvents.map((ev: any, idx: number) => (
              <View
                key={ev.id}
                style={[
                  styles.activityRow,
                  idx < recentEvents.length - 1 && styles.activityRowBorder,
                ]}
              >
                <View style={[styles.activityDot, { backgroundColor: ev.status === 'LIVE' ? Colors.lime : Colors.purple }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.activityTitle} numberOfLines={1}>{ev.name}</Text>
                  <Text style={styles.activityMeta}>
                    {ev.status ?? 'UPCOMING'}
                    {ev.rounds?.length ? ` · ${ev.rounds.length} rounds` : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
              </View>
            ))
          )}
        </GlassCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },

  // Access denied
  accessDenied: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: Spacing.xl, gap: 12,
  },
  accessDeniedTitle: { color: Colors.error, fontSize: 22, fontWeight: '800' },
  accessDeniedSub:   { color: Colors.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  backBtnCenter: {
    marginTop: 8, paddingHorizontal: 24, paddingVertical: 10,
    backgroundColor: Colors.bgSecondary, borderRadius: Radius.pill,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  backBtnCenterText: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },

  // Header
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
  title:    { color: Colors.textPrimary, fontSize: 18, fontWeight: '800' },
  subtitle: { color: Colors.textSecondary, fontSize: 12, marginTop: 1 },
  rolePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.limeDim,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.pill,
  },
  rolePillText: { color: Colors.lime, fontSize: 11, fontWeight: '700' },

  // Content
  content:     { paddingHorizontal: Spacing.md, paddingBottom: 120 },
  sectionLabel: {
    color: Colors.textSecondary, fontSize: 11, fontWeight: '700',
    letterSpacing: 1, marginBottom: 10, marginTop: 4,
  },

  // Error
  errorCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 16, backgroundColor: Colors.error + '11',
    borderColor: Colors.error + '33',
  },
  errorText: { flex: 1, color: Colors.error, fontSize: 13 },
  retryText: { color: Colors.lime, fontSize: 13, fontWeight: '700' },

  // Loading
  loadingRow: { height: 100, alignItems: 'center', justifyContent: 'center' },

  // Stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    width: '47.5%', alignItems: 'flex-start', gap: 6,
  },
  statIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  statValue: { color: Colors.textPrimary, fontSize: 26, fontWeight: '800', marginTop: 2 },
  statLabel: { color: Colors.textSecondary, fontSize: 12 },

  // Quick actions
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionCard: {
    width: '47.5%',
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.cardBorder,
    padding: 16,
  },
  actionIcon: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  actionLabel: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  actionSub:   { color: Colors.textSecondary, fontSize: 11, marginTop: 2 },

  // Activity feed
  activityCard: { overflow: 'hidden' },
  activityRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  activityRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },
  activityDot: { width: 8, height: 8, borderRadius: 4 },
  activityTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  activityMeta: { color: Colors.textSecondary, fontSize: 11, marginTop: 2 },
  emptyText: {
    color: Colors.textSecondary, fontSize: 13, textAlign: 'center',
    paddingVertical: 20,
  },
});
