import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Dimensions, Image, RefreshControl, Alert, Modal, TextInput, ActivityIndicator, FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { usersApi } from '../../services/api';
import {
  useMe, useUserStats, useUserPosts, useUserRounds,
  useFollowers, useFollowing, useUnreadCount,
} from '../../hooks/useQueries';
import AvatarRing from '../../components/ui/AvatarRing';
import GlassCard from '../../components/ui/GlassCard';
import GradientButton from '../../components/ui/GradientButton';
import SkeletonLoader from '../../components/ui/SkeletonLoader';
import BadgeGrid from '../../components/ui/BadgeGrid';
import { Colors, Radius, Spacing } from '../../constants/theme';

type ProfileTab = 'posts' | 'rounds' | 'stats';

const CELL = (Dimensions.get('window').width - 4) / 3;

export default function ProfileTab() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user: authUser, refreshUser, updateUser } = useAuth();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const [refreshing, setRefreshing] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [handicapLoading, setHandicapLoading] = useState(false);

  const userId = authUser?.id ?? '';

  // ─── Queries ─────────────────────────────────────────────────────────────
  const { data: me, isLoading: meLoading, error: meError, refetch: refetchMe } = useMe();
  const { data: stats, isLoading: statsLoading, error: statsError } = useUserStats(userId);
  const { data: posts = [], isLoading: postsLoading } = useUserPosts(userId);
  const { data: rounds = [], isLoading: roundsLoading } = useUserRounds(userId);
  const { data: followers = [] } = useFollowers(userId);
  const { data: following = [] } = useFollowing(userId);
  const { data: unreadData } = useUnreadCount();

  const unread = unreadData?.count ?? 0;
  const loading = meLoading || statsLoading;
  const user = me ?? authUser;

  // ─── Pull-to-refresh ─────────────────────────────────────────────────────
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['me'] }),
      qc.invalidateQueries({ queryKey: ['stats', userId] }),
      qc.invalidateQueries({ queryKey: ['userPosts', userId] }),
      qc.invalidateQueries({ queryKey: ['userRounds', userId] }),
      qc.invalidateQueries({ queryKey: ['followers', userId] }),
      qc.invalidateQueries({ queryKey: ['following', userId] }),
      qc.invalidateQueries({ queryKey: ['unreadCount'] }),
    ]);
    setRefreshing(false);
  }, [qc, userId]);

  // ─── Avatar upload ───────────────────────────────────────────────────────
  const handleAvatarPress = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to your photo library to update your profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    const uri = result.assets[0].uri;
    try {
      setAvatarUploading(true);
      const data = await usersApi.uploadAvatar(uri);
      await updateUser({ avatar: data.avatar });
      await qc.invalidateQueries({ queryKey: ['me'] });
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message ?? 'Could not upload photo. Please try again.');
    } finally {
      setAvatarUploading(false);
    }
  }, [updateUser, qc]);

  // ─── Edit profile ────────────────────────────────────────────────────────
  const handleEditProfilePress = useCallback(() => {
    setEditName(user?.name ?? '');
    setEditUsername(user?.username ?? '');
    setEditModalVisible(true);
  }, [user]);

  // ─── Handicap calculation ─────────────────────────────────────────────────
  const handleCalculateHandicap = useCallback(async () => {
    try {
      setHandicapLoading(true);
      await usersApi.calculateHandicap();
      await Promise.all([
        refreshUser(),
        qc.invalidateQueries({ queryKey: ['me'] }),
      ]);
    } catch (e: any) {
      Alert.alert('Handicap error', e?.message ?? 'Could not calculate handicap. Please try again.');
    } finally {
      setHandicapLoading(false);
    }
  }, [refreshUser, qc]);

  const handleEditProfileSave = useCallback(async () => {
    try {
      setEditSaving(true);
      await usersApi.updateMe({ name: editName.trim(), username: editUsername.trim() || undefined });
      await Promise.all([
        refreshUser(),
        qc.invalidateQueries({ queryKey: ['me'] }),
      ]);
      setEditModalVisible(false);
    } catch (e: any) {
      Alert.alert('Save failed', e?.message ?? 'Could not save changes. Please try again.');
    } finally {
      setEditSaving(false);
    }
  }, [editName, editUsername, refreshUser, qc]);

  if (!user) return null;

  const roleBadge =
    user.role === 'SUPER_ADMIN'  ? { label: 'Admin',       color: Colors.gold }   :
    user.role === 'SCOREKEEPER'  ? { label: 'Scorekeeper', color: Colors.teal } :
    { label: 'Member', color: Colors.textSecondary };

  // Career stats grid items for the Stats tab
  const CAREER_STATS = [
    { label: 'Total Eagles',  value: stats?.totalEagles  ?? 0,   icon: 'flash-outline',    color: Colors.scoreEagle },
    { label: 'Total Birdies', value: stats?.totalBirdies ?? 0,   icon: 'star-outline',     color: Colors.scoreBirdie },
    { label: 'Total Pars',    value: stats?.totalPars    ?? 0,   icon: 'flag-outline',     color: Colors.textSecondary },
    { label: 'Best Score',    value: stats?.bestScore    ?? '–', icon: 'trophy-outline',   color: Colors.gold },
    { label: 'Avg Score',     value: stats?.averageScore ? (stats.averageScore as number).toFixed(1) : '–',
                                                                  icon: 'trending-up-outline', color: Colors.teal },
    { label: 'Total Rounds',  value: stats?.totalRounds  ?? 0,   icon: 'map-outline',      color: Colors.textPrimary },
    { label: 'Holes in One',  value: (stats as any)?.holesInOne ?? 0, icon: 'radio-button-on-outline', color: Colors.gold },
    { label: 'Rounds Played', value: stats?.totalRounds  ?? 0,   icon: 'golf-outline',     color: Colors.textSecondary },
  ];

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Text style={styles.username}>{user.name}</Text>
        <View style={styles.topBarRight}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => router.push('/notifications' as any)}
          >
            <Ionicons
              name="notifications-outline"
              size={19}
              color={unread > 0 ? Colors.gold : Colors.textSecondary}
            />
            {unread > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unread > 9 ? '9+' : unread}</Text>
              </View>
            )}
          </TouchableOpacity>
          {(user.role === 'SUPER_ADMIN' || user.role === 'SCOREKEEPER') && (
            <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/admin/index' as any)}>
              <Ionicons name="shield-checkmark-outline" size={19} color={Colors.gold} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/settings' as any)}>
            <Ionicons name="settings-outline" size={19} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {meError ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={40} color={Colors.error} />
          <Text style={styles.errorTitle}>Failed to load profile</Text>
          <TouchableOpacity onPress={() => refetchMe()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scroll, { paddingBottom: 120 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />}
        >
          {/* ── Hero card ── */}
          <LinearGradient colors={['#1A1A2E', Colors.bg]} style={styles.heroCard}>
            <View style={styles.heroGlow} />
            <View style={styles.heroTop}>
              {/* Avatar (84px circle, gold 3px border) */}
              <TouchableOpacity onPress={handleAvatarPress} activeOpacity={0.8} style={styles.avatarWrapper}>
                <AvatarRing uri={user.avatar} name={user.name} size={84} ring="lime" ringWidth={3} />
                <View style={styles.cameraBadge}>
                  {avatarUploading
                    ? <ActivityIndicator size="small" color={Colors.bg} />
                    : <Ionicons name="camera" size={13} color={Colors.bg} />}
                </View>
              </TouchableOpacity>
              <View style={styles.heroInfo}>
                <Text style={styles.heroName}>{user.name}</Text>
                {user.username && (
                  <Text style={styles.heroUsername}>@{user.username}</Text>
                )}
                {/* HCP badge */}
                <View style={styles.hcpBadge}>
                  <Text style={styles.hcpBadgeText}>
                    {(user.handicapIndex != null || user.handicap != null)
                      ? `HCP ${user.handicapIndex ?? user.handicap}`
                      : 'No handicap'}
                  </Text>
                </View>
                <View style={[styles.roleBadge, { borderColor: roleBadge.color + '50', backgroundColor: roleBadge.color + '15' }]}>
                  <Text style={[styles.roleText, { color: roleBadge.color }]}>{roleBadge.label}</Text>
                </View>
                {user.homeCourse && (
                  <View style={styles.metaRow}>
                    <Ionicons name="flag-outline" size={11} color={Colors.textMuted} />
                    <Text style={styles.metaText}>{user.homeCourse}</Text>
                  </View>
                )}
                {user.location && (
                  <View style={styles.metaRow}>
                    <Ionicons name="location-outline" size={11} color={Colors.textMuted} />
                    <Text style={styles.metaText}>{user.location}</Text>
                  </View>
                )}
              </View>
            </View>

            {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}

            {/* Stats row: posts | followers | following */}
            <View style={styles.followRow}>
              <TouchableOpacity style={styles.followStat}
                onPress={() => router.push(`/profile/${userId}/posts` as any)}>
                <Text style={styles.followCount}>{(posts as any[]).length}</Text>
                <Text style={styles.followLabel}>Posts</Text>
              </TouchableOpacity>
              <View style={styles.followDivider} />
              <TouchableOpacity style={styles.followStat}
                onPress={() => router.push('/friends' as any)}>
                <Text style={styles.followCount}>{(followers as any[]).length}</Text>
                <Text style={styles.followLabel}>Followers</Text>
              </TouchableOpacity>
              <View style={styles.followDivider} />
              <TouchableOpacity style={styles.followStat}
                onPress={() => router.push('/friends' as any)}>
                <Text style={styles.followCount}>{(following as any[]).length}</Text>
                <Text style={styles.followLabel}>Following</Text>
              </TouchableOpacity>
            </View>

            {/* HCP display + update */}
            <View style={styles.hcpRow}>
              <View style={styles.hcpLeft}>
                <Text style={styles.hcpValue}>
                  {loading ? '–' : user.handicapIndex != null ? `HCP ${user.handicapIndex}` : (user.handicap != null ? `HCP ${user.handicap}` : 'HCP --')}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.hcpBtn}
                onPress={handleCalculateHandicap}
                disabled={handicapLoading}
                activeOpacity={0.7}
              >
                {handicapLoading
                  ? <ActivityIndicator size="small" color={Colors.gold} />
                  : (
                    <Text style={styles.hcpBtnText}>
                      {(user.handicapIndex != null || user.handicap != null) ? '↻ Update' : 'Calculate'}
                    </Text>
                  )}
              </TouchableOpacity>
            </View>

            {/* Stats row */}
            <View style={styles.heroStats}>
              {[
                { label: 'Rounds', value: String(stats?.totalRounds ?? 0), color: Colors.teal },
                { label: 'Best',   value: String(stats?.bestScore   ?? '–'), color: Colors.textPrimary },
                { label: 'Avg',    value: stats?.averageScore ? (stats.averageScore as number).toFixed(1) : '–', color: Colors.textPrimary },
              ].map((s) => (
                <View key={s.label} style={styles.heroStat}>
                  <Text style={[styles.heroStatValue, { color: s.color }]}>{loading ? '–' : s.value}</Text>
                  <Text style={styles.heroStatLabel}>{s.label}</Text>
                </View>
              ))}
            </View>

            <GradientButton
              label="Edit Profile"
              onPress={handleEditProfilePress}
              variant="outline"
              size="sm"
              style={{ alignSelf: 'flex-start', marginTop: 16 }}
            />
          </LinearGradient>

          {/* ── Badges ── */}
          {userId && <BadgeGrid userId={userId} />}

          {/* ── 3-tab selector ── */}
          <View style={styles.tabToggle}>
            {([
              { id: 'posts',  icon: 'grid-outline' },
              { id: 'rounds', icon: 'list-outline' },
              { id: 'stats',  icon: 'trending-up-outline' },
            ] as { id: ProfileTab; icon: string }[]).map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[styles.tabBtn, activeTab === t.id && styles.tabBtnActive]}
                onPress={() => setActiveTab(t.id)}
              >
                <Ionicons
                  name={t.icon as any}
                  size={20}
                  color={activeTab === t.id ? Colors.gold : Colors.textMuted}
                />
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Tab: Posts (3-column FlatList grid) ── */}
          {activeTab === 'posts' && (
            postsLoading ? (
              <View style={styles.gridWrap}>
                <SkeletonLoader height={CELL} style={{ flex: 1 / 3, margin: 1 }} />
                <SkeletonLoader height={CELL} style={{ flex: 1 / 3, margin: 1 }} />
                <SkeletonLoader height={CELL} style={{ flex: 1 / 3, margin: 1 }} />
              </View>
            ) : (posts as any[]).length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="grid-outline" size={36} color={Colors.textMuted} />
                <Text style={styles.emptyText}>No posts yet</Text>
              </View>
            ) : (
              <FlatList
                data={posts as any[]}
                numColumns={3}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                renderItem={({ item: post }) => (
                  <TouchableOpacity
                    style={[styles.gridCell, { width: CELL, height: CELL }]}
                    activeOpacity={0.8}
                    onPress={() => router.push(`/post/${post.id}` as any)}
                  >
                    {post.imageUrl ? (
                      <Image source={{ uri: post.imageUrl }} style={styles.gridImg} />
                    ) : (
                      <View style={styles.gridTextCard}>
                        <Text style={styles.gridText} numberOfLines={3}>{post.content}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}
              />
            )
          )}

          {/* ── Tab: Rounds ── */}
          {activeTab === 'rounds' && (
            <View style={styles.roundsSection}>
              {roundsLoading ? (
                <>
                  <SkeletonLoader height={70} borderRadius={Radius.lg} />
                  <SkeletonLoader height={70} borderRadius={Radius.lg} />
                </>
              ) : (rounds as any[]).length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="flag-outline" size={36} color={Colors.textMuted} />
                  <Text style={styles.emptyText}>No rounds yet</Text>
                </View>
              ) : (rounds as any[]).map((r: any) => (
                <GlassCard
                  key={r.id ?? r.roundId}
                  style={styles.roundCard}
                  padding={14}
                >
                  <View style={styles.roundLeft}>
                    <Text style={styles.roundEvent}>{r.courseName ?? r.eventName ?? r.event?.name ?? 'Round'}</Text>
                    <Text style={styles.roundDate}>
                      {new Date(r.date ?? r.createdAt).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}
                    </Text>
                  </View>
                  <View style={styles.roundRight}>
                    <Text style={styles.roundGross}>{r.grossScore ?? r.totalStrokes ?? '–'}</Text>
                    <Text style={styles.roundNet}>net {r.netScore ?? '–'}</Text>
                  </View>
                </GlassCard>
              ))}
            </View>
          )}

          {/* ── Tab: Stats — career stats grid ── */}
          {activeTab === 'stats' && (
            <View style={styles.statsSection}>
              {statsLoading ? (
                <>
                  <SkeletonLoader height={60} borderRadius={Radius.lg} />
                  <SkeletonLoader height={60} borderRadius={Radius.lg} />
                  <SkeletonLoader height={60} borderRadius={Radius.lg} />
                </>
              ) : statsError ? (
                <View style={styles.emptyState}>
                  <Ionicons name="alert-circle-outline" size={36} color={Colors.error} />
                  <Text style={styles.emptyText}>Could not load stats</Text>
                </View>
              ) : (
                <View style={styles.statsGrid}>
                  {CAREER_STATS.map((s) => (
                    <View key={s.label} style={styles.statGridCell}>
                      <View style={[styles.statIconWrap, { borderColor: s.color + '30' }]}>
                        <Ionicons name={s.icon as any} size={20} color={s.color} />
                      </View>
                      <Text style={[styles.statGridValue, { color: s.color }]}>
                        {loading ? '–' : String(s.value)}
                      </Text>
                      <Text style={styles.statGridLabel}>{s.label}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* ── Edit Profile Modal ── */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Profile</Text>

            <Text style={styles.modalLabel}>Name</Text>
            <TextInput
              style={styles.modalInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Your name"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="words"
            />

            <Text style={styles.modalLabel}>Username</Text>
            <TextInput
              style={styles.modalInput}
              value={editUsername}
              onChangeText={setEditUsername}
              placeholder="username"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setEditModalVisible(false)}
                disabled={editSaving}
              >
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnSave]}
                onPress={handleEditProfileSave}
                disabled={editSaving}
              >
                {editSaving
                  ? <ActivityIndicator size="small" color={Colors.bg} />
                  : <Text style={styles.modalBtnSaveText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
  },
  username: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: '600',
  },
  topBarRight: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.bgSecondary, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  bellBadge: {
    position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: Colors.error, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  bellBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorTitle: { color: Colors.textSecondary, fontSize: 16 },
  retryBtn: {
    backgroundColor: Colors.goldDim, borderRadius: Radius.pill,
    paddingHorizontal: 20, paddingVertical: 8,
    borderWidth: 1, borderColor: Colors.gold + '40',
  },
  retryText: { color: Colors.gold, fontSize: 13, fontWeight: '600' },

  scroll: { paddingHorizontal: 0 },

  heroCard: {
    marginHorizontal: Spacing.md, marginBottom: 16,
    borderRadius: Radius.xl, padding: 20,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute', top: -40, right: -40, width: 150, height: 150,
    borderRadius: 75, backgroundColor: Colors.gold, opacity: 0.05,
  },
  heroTop: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  heroInfo: { flex: 1, gap: 5 },
  heroName: { color: Colors.textPrimary, fontSize: 18, fontWeight: '600' },
  heroUsername: { color: Colors.textSecondary, fontSize: 13, marginTop: -2 },
  hcpBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.goldDim,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.gold + '50',
  },
  hcpBadgeText: { color: Colors.gold, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  roleBadge: { alignSelf: 'flex-start', borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1 },
  roleText: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { color: Colors.textMuted, fontSize: 12 },
  bio: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 14 },

  followRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  followStat: { flex: 1, alignItems: 'center' },
  followCount: { color: Colors.textPrimary, fontSize: 20, fontWeight: '700' },
  followLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  followDivider: { width: 1, height: 32, backgroundColor: Colors.border },

  hcpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  hcpLeft: { flex: 1 },
  hcpValue: { color: Colors.gold, fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
  hcpBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    backgroundColor: Colors.goldDim,
    borderWidth: 1,
    borderColor: Colors.gold + '50',
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hcpBtnText: { color: Colors.gold, fontSize: 13, fontWeight: '600' },

  heroStats: {
    flexDirection: 'row',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatValue: { fontSize: 20, fontWeight: '700' },
  heroStatLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    marginTop: 3,
    textTransform: 'uppercase',
  },

  tabToggle: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border,
    marginBottom: 2,
  },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: Colors.gold },

  // Posts grid
  gridWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  gridCell: { margin: 1, overflow: 'hidden' },
  gridImg: { width: '100%', height: '100%' },
  gridTextCard: {
    flex: 1,
    backgroundColor: Colors.bgSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  gridText: { color: Colors.textSecondary, fontSize: 11, textAlign: 'center', lineHeight: 15 },

  // Rounds
  roundsSection: { gap: 8, paddingHorizontal: Spacing.md, marginTop: 8, paddingBottom: 20 },
  roundCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roundLeft: {},
  roundEvent: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  roundDate: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  roundRight: { alignItems: 'flex-end' },
  roundGross: { color: Colors.gold, fontSize: 18, fontWeight: '700' },
  roundNet: { color: Colors.textMuted, fontSize: 12 },

  // Stats grid
  statsSection: { paddingHorizontal: Spacing.md, marginTop: 8, paddingBottom: 20 },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statGridCell: {
    width: '47%',
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    alignItems: 'center',
    gap: 6,
  },
  statIconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgTertiary,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statGridValue: { fontSize: 24, fontWeight: '700', letterSpacing: -0.5 },
  statGridLabel: { color: Colors.textSecondary, fontSize: 11, textAlign: 'center' },

  // Empty
  emptyState: { alignItems: 'center', paddingTop: 40, gap: 10, width: '100%' },
  emptyText: { color: Colors.textSecondary, fontSize: 15 },

  // Avatar wrapper + camera badge
  avatarWrapper: { position: 'relative' },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.bg,
  },

  // Edit profile modal
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  modalCard: {
    width: '100%',
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.xl,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 20 },
  modalLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginBottom: 6 },
  modalInput: {
    backgroundColor: Colors.bgTertiary,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.textPrimary,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 16,
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalBtn: { flex: 1, height: 44, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  modalBtnCancel: { backgroundColor: Colors.bgTertiary, borderWidth: 1, borderColor: Colors.border },
  modalBtnCancelText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '500' },
  modalBtnSave: { backgroundColor: Colors.gold },
  modalBtnSaveText: { color: Colors.bg, fontSize: 14, fontWeight: '600' },
});
