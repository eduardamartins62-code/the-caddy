import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Alert, Modal, RefreshControl, ActivityIndicator,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import AvatarRing from '../../components/ui/AvatarRing';
import GlassCard from '../../components/ui/GlassCard';
import SkeletonLoader from '../../components/ui/SkeletonLoader';
import { Colors, Radius, Spacing } from '../../constants/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = 'USER' | 'SCOREKEEPER' | 'SUPER_ADMIN';

interface Player {
  id: string;
  name: string;
  username?: string;
  email: string;
  avatar?: string | null;
  role: Role;
  handicap?: number | null;
  homeCourse?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function roleBadgeStyle(role: Role): { bg: string; fg: string; label: string } {
  switch (role) {
    case 'SUPER_ADMIN':
      return { bg: Colors.lime + '22', fg: Colors.lime, label: 'SUPER ADMIN' };
    case 'SCOREKEEPER':
      return { bg: Colors.purple + '22', fg: Colors.purple, label: 'SCOREKEEPER' };
    default:
      return { bg: Colors.bgTertiary, fg: Colors.textSecondary, label: 'USER' };
  }
}

// ─── Player row skeleton ──────────────────────────────────────────────────────

function PlayerSkeleton() {
  return (
    <View style={skelStyles.row}>
      <SkeletonLoader width={44} height={44} borderRadius={22} />
      <View style={{ flex: 1, marginLeft: 12, gap: 8 }}>
        <SkeletonLoader height={14} width="55%" />
        <SkeletonLoader height={11} width="70%" />
      </View>
      <SkeletonLoader width={70} height={22} borderRadius={Radius.pill} />
    </View>
  );
}

const skelStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.cardBorder,
  },
});

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminPlayersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user: me } = useAuth();
  const queryClient = useQueryClient();
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isSuperAdmin = me?.role === 'SUPER_ADMIN';

  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [actionTarget, setActionTarget] = useState<Player | null>(null);
  const [roleChanging, setRoleChanging] = useState(false);

  // Debounce search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(searchText.trim()), 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchText]);

  const queryKey = ['admin-players', debouncedSearch];

  const { data: players = [], isLoading, error, refetch } = useQuery<Player[]>({
    queryKey,
    queryFn: () =>
      usersApi.list(debouncedSearch ? { q: debouncedSearch } : undefined) as Promise<Player[]>,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // ── Role action sheet ─────────────────────────────────────────────────────

  function openActionSheet(player: Player) {
    if (player.id === me?.id) {
      Alert.alert('Info', 'You cannot modify your own role.');
      return;
    }

    const options: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [
      { text: 'View Profile', onPress: () => router.push(`/profile/${player.id}` as any) },
    ];

    if (isSuperAdmin) {
      if (player.role === 'USER') {
        options.push({ text: 'Promote to Scorekeeper', onPress: () => confirmRoleChange(player, 'SCOREKEEPER') });
      }
      if (player.role === 'SCOREKEEPER') {
        options.push({ text: 'Demote to User', style: 'destructive', onPress: () => confirmRoleChange(player, 'USER') });
      }
    }

    options.push({ text: 'Cancel', style: 'cancel' });

    Alert.alert(player.name, `Role: ${player.role}`, options);
  }

  async function confirmRoleChange(player: Player, newRole: 'USER' | 'SCOREKEEPER') {
    const action = newRole === 'SCOREKEEPER' ? 'Promote' : 'Demote';
    const verb = newRole === 'SCOREKEEPER' ? 'promote to Scorekeeper' : 'demote to User';
    Alert.alert(
      `${action} ${player.name}`,
      `Are you sure you want to ${verb}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action,
          style: newRole === 'USER' ? 'destructive' : 'default',
          onPress: () => applyRoleChange(player, newRole),
        },
      ]
    );
  }

  async function applyRoleChange(player: Player, newRole: 'USER' | 'SCOREKEEPER') {
    setRoleChanging(true);
    try {
      await usersApi.updateRole(player.id, newRole);
      await queryClient.invalidateQueries({ queryKey: ['admin-players'] });
    } catch {
      Alert.alert('Error', 'Failed to update role. Please try again.');
    } finally {
      setRoleChanging(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Manage Players</Text>
        {roleChanging && <ActivityIndicator color={Colors.lime} size="small" />}
      </View>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={16} color={Colors.textSecondary} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or email..."
          placeholderTextColor={Colors.textMuted}
          value={searchText}
          onChangeText={setSearchText}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {searchText.length > 0 && (
          <TouchableOpacity onPress={() => setSearchText('')}>
            <Ionicons name="close-circle" size={16} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Results count */}
      {!isLoading && (
        <View style={styles.countRow}>
          <Text style={styles.countText}>
            {players.length} player{players.length !== 1 ? 's' : ''}
            {debouncedSearch ? ` matching "${debouncedSearch}"` : ''}
          </Text>
        </View>
      )}

      {/* Error state */}
      {error && (
        <GlassCard style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={20} color={Colors.error} />
          <Text style={styles.errorText}>Failed to load players.</Text>
          <TouchableOpacity onPress={() => refetch()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </GlassCard>
      )}

      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.lime} />
        }
      >
        {isLoading ? (
          <GlassCard padding={0}>
            {[1, 2, 3, 4, 5].map(i => <PlayerSkeleton key={i} />)}
          </GlassCard>
        ) : players.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No players found</Text>
            {debouncedSearch ? (
              <Text style={styles.emptySub}>Try a different search term</Text>
            ) : (
              <Text style={styles.emptySub}>Players will appear here once they join</Text>
            )}
          </View>
        ) : (
          <GlassCard padding={0}>
            {players.map((player, idx) => {
              const badge = roleBadgeStyle(player.role);
              return (
                <Pressable
                  key={player.id}
                  style={({ pressed }) => [
                    styles.playerRow,
                    idx < players.length - 1 && styles.playerRowBorder,
                    pressed && styles.playerRowPressed,
                  ]}
                  onPress={() => openActionSheet(player)}
                >
                  {/* Avatar */}
                  <AvatarRing
                    uri={player.avatar}
                    name={player.name}
                    size={44}
                    ring={player.role === 'SUPER_ADMIN' ? 'lime' : player.role === 'SCOREKEEPER' ? 'purple' : 'none'}
                  />

                  {/* Info */}
                  <View style={styles.playerInfo}>
                    <Text style={styles.playerName} numberOfLines={1}>{player.name}</Text>
                    <Text style={styles.playerEmail} numberOfLines={1}>
                      {player.username ? `@${player.username} · ` : ''}{player.email}
                    </Text>
                    {player.homeCourse && (
                      <Text style={styles.playerCourse} numberOfLines={1}>
                        <Ionicons name="flag-outline" size={10} color={Colors.lime} /> {player.homeCourse}
                      </Text>
                    )}
                  </View>

                  {/* Right side: role badge + handicap */}
                  <View style={styles.playerRight}>
                    <View style={[styles.roleBadge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.roleBadgeText, { color: badge.fg }]}>{badge.label}</Text>
                    </View>
                    {player.handicap != null && (
                      <Text style={styles.handicapText}>HCP {player.handicap}</Text>
                    )}
                  </View>

                  <Ionicons name="ellipsis-vertical" size={16} color={Colors.textMuted} style={{ marginLeft: 8 }} />
                </Pressable>
              );
            })}
          </GlassCard>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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

  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: Spacing.md, marginTop: 12,
    backgroundColor: Colors.bgSecondary, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.cardBorder,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: 14 },

  countRow: {
    paddingHorizontal: Spacing.md, paddingTop: 10, paddingBottom: 6,
  },
  countText: { color: Colors.textSecondary, fontSize: 12 },

  errorCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: Spacing.md, marginBottom: 8,
    backgroundColor: Colors.error + '11', borderColor: Colors.error + '33',
  },
  errorText: { flex: 1, color: Colors.error, fontSize: 13 },
  retryText: { color: Colors.lime, fontSize: 13, fontWeight: '700' },

  listContent: {
    paddingHorizontal: Spacing.md, paddingBottom: 120, paddingTop: 4,
  },

  // Player row
  playerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  playerRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },
  playerRowPressed: { backgroundColor: Colors.bgTertiary },

  playerInfo: { flex: 1, marginLeft: 12 },
  playerName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  playerEmail: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  playerCourse: { color: Colors.lime, fontSize: 11, marginTop: 3 },

  playerRight: { alignItems: 'flex-end', gap: 4 },
  roleBadge: {
    borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 3,
  },
  roleBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  handicapText: { color: Colors.textSecondary, fontSize: 11 },

  // Empty state
  emptyState: {
    alignItems: 'center', paddingTop: 60, gap: 10,
  },
  emptyText: { color: Colors.textSecondary, fontSize: 16, fontWeight: '600' },
  emptySub: { color: Colors.textMuted, fontSize: 13, textAlign: 'center', paddingHorizontal: 40 },
});

// Needed for bgTertiary reference
const bgTertiary = Colors.bgTertiary;
