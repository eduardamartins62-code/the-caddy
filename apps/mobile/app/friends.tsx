import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Search, UserPlus, QrCode, Check, Users } from 'lucide-react-native';
import GlassCard from '../components/ui/GlassCard';
import AvatarRing from '../components/ui/AvatarRing';
import { usersApi } from '../services/api';
import { Colors, Radius, Spacing, Typography } from '../constants/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'friends' | 'add';

interface Friend {
  id: string;
  name: string;
  username?: string;
  avatar?: string;
  handicap?: number | null;
}

interface SearchUser {
  id: string;
  name: string;
  username?: string;
  avatar?: string;
  handicap?: number | null;
  isFollowing?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatHandicap(h?: number | null) {
  if (h == null) return 'Handicap N/A';
  return `Handicap ${h.toFixed(1)}`;
}

// ─── Avatar placeholder ──────────────────────────────────────────────────────

function Avatar({ uri, name, size = 44 }: { uri?: string; name: string; size?: number }) {
  return (
    <AvatarRing uri={uri} name={name} size={size} ring="none" />
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function FriendsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<Tab>('friends');

  // ── Friends tab state ──
  const [friends, setFriends] = useState<Friend[]>([]);
  const [followRequests, setFollowRequests] = useState<Friend[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [friendSearch, setFriendSearch] = useState('');

  // ── Add tab state ──
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());

  const addDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Load friends + requests ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setFriendsLoading(true);
      try {
        const [f, req] = await Promise.allSettled([
          usersApi.getFriends(),
          usersApi.getFollowRequests(),
        ]);
        if (!cancelled) {
          setFriends(f.status === 'fulfilled' ? (f.value ?? []) : []);
          setFollowRequests(req.status === 'fulfilled' ? (req.value ?? []) : []);
          // Seed followingIds from friends
          if (f.status === 'fulfilled' && Array.isArray(f.value)) {
            setFollowingIds(new Set((f.value as Friend[]).map(u => u.id)));
          }
        }
      } finally {
        if (!cancelled) setFriendsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // ─── Follow back a request ──────────────────────────────────────────────
  const handleFollowBack = useCallback(async (user: Friend) => {
    try {
      await usersApi.follow(user.id);
      setFollowRequests(prev => prev.filter(r => r.id !== user.id));
      setFriends(prev => [...prev, user]);
      setFollowingIds(prev => new Set([...prev, user.id]));
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not follow user');
    }
  }, []);

  // ─── Search users (Add tab) ─────────────────────────────────────────────
  useEffect(() => {
    if (addDebounceTimer.current) clearTimeout(addDebounceTimer.current);

    if (searchQuery.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    addDebounceTimer.current = setTimeout(async () => {
      try {
        const results = await usersApi.list({ q: searchQuery });
        setSearchResults((results ?? []).map((u: any) => ({
          ...u,
          isFollowing: followingIds.has(u.id),
        })));
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => {
      if (addDebounceTimer.current) clearTimeout(addDebounceTimer.current);
    };
  }, [searchQuery, followingIds]);

  // ─── Follow / Unfollow ──────────────────────────────────────────────────
  const toggleFollow = useCallback(async (userId: string) => {
    const isFollowing = followingIds.has(userId);
    try {
      if (isFollowing) {
        await usersApi.unfollow(userId);
        setFollowingIds(prev => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
      } else {
        await usersApi.follow(userId);
        setFollowingIds(prev => new Set([...prev, userId]));
      }
      setSearchResults(prev =>
        prev.map(u => u.id === userId ? { ...u, isFollowing: !isFollowing } : u)
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Action failed');
    }
  }, [followingIds]);

  // ─── Filtered friends ────────────────────────────────────────────────────
  const filteredFriends = friends.filter(f =>
    friendSearch.length === 0 ||
    f.name.toLowerCase().includes(friendSearch.toLowerCase())
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ArrowLeft size={22} color={Colors.textPrimary} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Friends</Text>

        {activeTab === 'add' && (
          <TouchableOpacity
            style={styles.qrBtn}
            onPress={() => Alert.alert('Coming Soon', 'QR sharing coming soon')}
          >
            <QrCode size={20} color={Colors.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
        )}
        {activeTab !== 'add' && <View style={styles.qrBtn} />}
      </View>

      {/* Tab switcher */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'friends' && styles.tabBtnActive]}
          onPress={() => setActiveTab('friends')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabBtnText, activeTab === 'friends' && styles.tabBtnTextActive]}>
            Friends
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'add' && styles.tabBtnActive]}
          onPress={() => setActiveTab('add')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabBtnText, activeTab === 'add' && styles.tabBtnTextActive]}>
            Add Friends
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Friends Tab ── */}
      {activeTab === 'friends' && (
        <ScrollView
          style={styles.content}
          contentContainerStyle={[styles.contentPad, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {friendsLoading ? (
            <View style={styles.centeredState}>
              <ActivityIndicator color={Colors.lime} size="large" />
            </View>
          ) : (
            <>
              {/* Friend Requests */}
              {followRequests.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>
                    Friend Requests ({followRequests.length})
                  </Text>
                  {followRequests.map(user => (
                    <GlassCard key={user.id} style={styles.userRow} padding={12}>
                      <Avatar uri={user.avatar} name={user.name} size={44} />
                      <View style={styles.userInfo}>
                        <Text style={styles.userName}>{user.name}</Text>
                        <Text style={styles.userSub}>{formatHandicap(user.handicap)}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.followBackBtn}
                        onPress={() => handleFollowBack(user)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.followBackText}>Follow Back</Text>
                      </TouchableOpacity>
                    </GlassCard>
                  ))}
                </View>
              )}

              {/* Friends list */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  Friends ({friends.length})
                </Text>
                {/* Local search */}
                {friends.length > 0 && (
                  <View style={styles.searchInputWrap}>
                    <Search size={15} color={Colors.textSecondary} strokeWidth={2} />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search by Name"
                      placeholderTextColor={Colors.textMuted}
                      value={friendSearch}
                      onChangeText={setFriendSearch}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                )}

                {filteredFriends.length === 0 && friends.length === 0 ? (
                  <View style={styles.centeredState}>
                    <Users size={36} color={Colors.textMuted} strokeWidth={1.5} />
                    <Text style={styles.emptyText}>No friends yet</Text>
                    <Text style={styles.emptySubtext}>Switch to Add Friends to find people</Text>
                  </View>
                ) : filteredFriends.length === 0 ? (
                  <Text style={styles.emptyText}>No results for "{friendSearch}"</Text>
                ) : (
                  filteredFriends.map(friend => (
                    <TouchableOpacity
                      key={friend.id}
                      onPress={() => router.push(`/profile/${friend.id}` as any)}
                      activeOpacity={0.7}
                    >
                      <GlassCard style={styles.userRow} padding={12}>
                        <Avatar uri={friend.avatar} name={friend.name} size={44} />
                        <View style={styles.userInfo}>
                          <Text style={styles.userName}>{friend.name}</Text>
                          <Text style={styles.userSub}>{formatHandicap(friend.handicap)}</Text>
                        </View>
                        <ArrowLeft
                          size={16}
                          color={Colors.textMuted}
                          strokeWidth={2}
                          style={{ transform: [{ rotate: '180deg' }] }}
                        />
                      </GlassCard>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            </>
          )}
        </ScrollView>
      )}

      {/* ── Add Friends Tab ── */}
      {activeTab === 'add' && (
        <View style={styles.addTabContent}>
          {/* Search input */}
          <View style={[styles.searchInputWrap, styles.addSearchWrap]}>
            <Search size={15} color={Colors.textSecondary} strokeWidth={2} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or username"
              placeholderTextColor={Colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
          </View>

          <ScrollView
            style={styles.content}
            contentContainerStyle={[styles.contentPad, { paddingBottom: insets.bottom + 24 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {searchLoading && (
              <View style={styles.centeredState}>
                <ActivityIndicator color={Colors.lime} size="large" />
              </View>
            )}

            {!searchLoading && searchQuery.length < 2 && (
              <View style={styles.centeredState}>
                <UserPlus size={36} color={Colors.textMuted} strokeWidth={1.5} />
                <Text style={styles.emptyText}>Find your friends</Text>
                <Text style={styles.emptySubtext}>Search by name or username</Text>
              </View>
            )}

            {!searchLoading && searchQuery.length >= 2 && searchResults.length === 0 && (
              <View style={styles.centeredState}>
                <Text style={styles.emptyText}>No users found</Text>
              </View>
            )}

            {!searchLoading && searchResults.map(user => {
              const isFollowing = followingIds.has(user.id);
              return (
                <GlassCard key={user.id} style={styles.userRow} padding={12}>
                  <Avatar uri={user.avatar} name={user.name} size={44} />
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{user.name}</Text>
                    <Text style={styles.userSub}>
                      {user.username ? `@${user.username}` : formatHandicap(user.handicap)}
                    </Text>
                    {user.username && (
                      <Text style={styles.userHandicap}>{formatHandicap(user.handicap)}</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={[styles.followBtn, isFollowing && styles.followBtnActive]}
                    onPress={() => toggleFollow(user.id)}
                    activeOpacity={0.7}
                  >
                    {isFollowing ? (
                      <>
                        <Check size={13} color={Colors.lime} strokeWidth={2.5} />
                        <Text style={styles.followBtnTextActive}>Following</Text>
                      </>
                    ) : (
                      <Text style={styles.followBtnText}>Follow</Text>
                    )}
                  </TouchableOpacity>
                </GlassCard>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: Typography.xl,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  qrBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Tab switcher
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: Spacing.md,
    marginBottom: 16,
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 3,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: Radius.sm,
  },
  tabBtnActive: {
    backgroundColor: Colors.limeDim,
  },
  tabBtnText: {
    color: Colors.textSecondary,
    fontSize: Typography.sm,
    fontWeight: '600',
  },
  tabBtnTextActive: {
    color: Colors.lime,
  },

  // Content
  content: { flex: 1 },
  contentPad: { paddingHorizontal: Spacing.md, gap: 10 },
  addTabContent: { flex: 1 },
  addSearchWrap: { marginHorizontal: Spacing.md, marginBottom: 12 },

  // Section
  section: { gap: 8 },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.md,
    fontWeight: '700',
    marginBottom: 4,
  },

  // User row
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 0,
  },
  userInfo: { flex: 1, gap: 2 },
  userName: {
    color: Colors.textPrimary,
    fontSize: Typography.md,
    fontWeight: '600',
  },
  userSub: {
    color: Colors.textSecondary,
    fontSize: Typography.sm,
  },
  userHandicap: {
    color: Colors.textMuted,
    fontSize: Typography.xs,
  },

  // Search input
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: Typography.md,
  },

  // Follow back button
  followBackBtn: {
    backgroundColor: Colors.lime,
    borderRadius: Radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  followBackText: {
    color: Colors.bg,
    fontSize: Typography.sm,
    fontWeight: '700',
  },

  // Follow button
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.lime,
    borderRadius: Radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  followBtnActive: {
    backgroundColor: Colors.limeDim,
    borderWidth: 1,
    borderColor: Colors.lime + '50',
  },
  followBtnText: {
    color: Colors.bg,
    fontSize: Typography.sm,
    fontWeight: '700',
  },
  followBtnTextActive: {
    color: Colors.lime,
    fontSize: Typography.sm,
    fontWeight: '700',
  },

  // States
  centeredState: {
    alignItems: 'center',
    paddingTop: 40,
    gap: 8,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: Typography.md,
    fontWeight: '600',
  },
  emptySubtext: {
    color: Colors.textMuted,
    fontSize: Typography.sm,
  },
});
