import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Dimensions, Image, RefreshControl, Alert, Modal, TextInput, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Shield, LayoutGrid, TrendingUp, List,
  Flag, MapPin, Bell, Zap, Star, Trophy, Map, AlertCircle, Camera,
} from 'lucide-react-native';
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
    user.role === 'SUPER_ADMIN'  ? { label: 'Admin',       color: Colors.lime }   :
    user.role === 'SCOREKEEPER'  ? { label: 'Scorekeeper', color: Colors.purple } :
    { label: 'Member', color: Colors.textSecondary };

  const HIGHLIGHTS = [
    { Icon: Zap,    label: 'Eagles',  value: stats?.totalEagles  ?? 0, color: Colors.eagle },
    { Icon: Star,   label: 'Birdies', value: stats?.totalBirdies ?? 0, color: Colors.birdie },
    { Icon: Flag,   label: 'Pars',    value: stats?.totalPars    ?? 0, color: Colors.textSecondary },
    { Icon: Trophy, label: 'Rounds',  value: stats?.totalRounds  ?? 0, color: Colors.lime },
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
            <Bell size={19} color={unread > 0 ? Colors.lime : Colors.textSecondary} strokeWidth={2} />
            {unread > 0 && <View style={styles.bellBadge}><Text style={styles.bellBadgeText}>{unread > 9 ? '9+' : unread}</Text></View>}
          </TouchableOpacity>
          {(user.role === 'SUPER_ADMIN' || user.role === 'SCOREKEEPER') && (
            <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/admin/index' as any)}>
              <Shield size={19} color={Colors.lime} strokeWidth={2} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/settings' as any)}>
            <Ionicons name="settings-outline" size={19} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {meError ? (
        <View style={styles.errorContainer}>
          <AlertCircle size={40} color={Colors.error} strokeWidth={1.5} />
          <Text style={styles.errorTitle}>Failed to load profile</Text>
          <TouchableOpacity onPress={() => refetchMe()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scroll, { paddingBottom: 120 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.lime} />}
        >
          {/* ── Hero card ── */}
          <LinearGradient colors={['#1A1A2E', Colors.bg]} style={styles.heroCard}>
            <View style={styles.heroGlow} />
            <View style={styles.heroTop}>
              <TouchableOpacity onPress={handleAvatarPress} activeOpacity={0.8} style={styles.avatarWrapper}>
                <AvatarRing uri={user.avatar} name={user.name} size={80} ring="lime" />
                <View style={styles.cameraBadge}>
                  {avatarUploading
                    ? <ActivityIndicator size="small" color={Colors.bg} />
                    : <Camera size={13} color={Colors.bg} strokeWidth={2.5} />}
                </View>
              </TouchableOpacity>
              <View style={styles.heroInfo}>
                <Text style={styles.heroName}>{user.name}</Text>
                <View style={[styles.roleBadge, { borderColor: roleBadge.color + '50', backgroundColor: roleBadge.color + '15' }]}>
                  <Text style={[styles.roleText, { color: roleBadge.color }]}>{roleBadge.label}</Text>
                </View>
                {user.homeCourse && (
                  <View style={styles.metaRow}>
                    <Flag size={11} color={Colors.textMuted} strokeWidth={1.5} />
                    <Text style={styles.metaText}>{user.homeCourse}</Text>
                  </View>
                )}
                {user.location && (
                  <View style={styles.metaRow}>
                    <MapPin size={11} color={Colors.textMuted} strokeWidth={1.5} />
                    <Text style={styles.metaText}>{user.location}</Text>
                  </View>
                )}
              </View>
            </View>

            {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}

            {/* Follow counts */}
            <View style={styles.followRow}>
              <TouchableOpacity style={styles.followStat}>
                <Text style={styles.followCount}>{(followers as any[]).length}</Text>
                <Text style={styles.followLabel}>Followers</Text>
              </TouchableOpacity>
              <View style={styles.followDivider} />
              <TouchableOpacity style={styles.followStat}>
                <Text style={styles.followCount}>{(following as any[]).length}</Text>
                <Text style={styles.followLabel}>Following</Text>
              </TouchableOpacity>
            </View>

            {/* HCP display */}
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
                  ? <ActivityIndicator size="small" color={Colors.lime} />
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
                { label: 'Rounds', value: String(stats?.totalRounds ?? 0), color: Colors.purple },
                { label: 'Best',   value: String(stats?.bestScore   ?? '–'), color: Colors.textPrimary },
                { label: 'Avg',    value: stats?.averageScore ? stats.averageScore.toFixed(1) : '–', color: Colors.textPrimary },
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

          {/* ── Highlights (IG-style circles) ── */}
          <View style={styles.highlightsRow}>
            {HIGHLIGHTS.map((h) => (
              <TouchableOpacity key={h.label} style={styles.highlightItem} activeOpacity={0.7}>
                <View style={[styles.highlightCircle, { borderColor: h.color + '40' }]}>
                  <h.Icon size={22} color={h.color} strokeWidth={1.8} />
                </View>
                <Text style={styles.highlightValue}>{loading ? '–' : h.value}</Text>
                <Text style={styles.highlightLabel}>{h.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── 3-tab selector ── */}
          <View style={styles.tabToggle}>
            {([
              { id: 'posts',  Icon: LayoutGrid },
              { id: 'rounds', Icon: List },
              { id: 'stats',  Icon: TrendingUp },
            ] as { id: ProfileTab; Icon: any }[]).map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[styles.tabBtn, activeTab === t.id && styles.tabBtnActive]}
                onPress={() => setActiveTab(t.id)}
              >
                <t.Icon
                  size={20}
                  color={activeTab === t.id ? Colors.lime : Colors.textMuted}
                  strokeWidth={activeTab === t.id ? 2.2 : 1.7}
                />
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Tab: Posts (3-column grid) ── */}
          {activeTab === 'posts' && (
            <View style={styles.gridWrap}>
              {postsLoading ? (
                <>
                  <SkeletonLoader height={CELL} style={{ flex: 1 / 3, margin: 1 }} />
                  <SkeletonLoader height={CELL} style={{ flex: 1 / 3, margin: 1 }} />
                  <SkeletonLoader height={CELL} style={{ flex: 1 / 3, margin: 1 }} />
                </>
              ) : (posts as any[]).length === 0 ? (
                <View style={styles.emptyState}>
                  <LayoutGrid size={36} color={Colors.textMuted} strokeWidth={1.5} />
                  <Text style={styles.emptyText}>No posts yet</Text>
                </View>
              ) : (
                (posts as any[]).map((post: any) => (
                  <TouchableOpacity
                    key={post.id}
                    style={[styles.gridCell, { width: CELL, height: CELL }]}
                    activeOpacity={0.8}
                  >
                    {post.imageUrl ? (
                      <Image source={{ uri: post.imageUrl }} style={styles.gridImg} />
                    ) : (
                      <View style={styles.gridTextCard}>
                        <Text style={styles.gridText} numberOfLines={3}>{post.content}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))
              )}
            </View>
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
                  <Flag size={36} color={Colors.textMuted} strokeWidth={1.5} />
                  <Text style={styles.emptyText}>No rounds yet</Text>
                </View>
              ) : (rounds as any[]).map((r: any) => (
                <GlassCard
                  key={r.id ?? r.roundId}
                  style={styles.roundCard}
                  padding={14}
                >
                  <View style={styles.roundLeft}>
                    <Text style={styles.roundEvent}>{r.eventName ?? r.event?.name ?? 'Round'}</Text>
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

          {/* ── Tab: Stats ── */}
          {activeTab === 'stats' && (
            <View style={styles.statsSection}>
              {statsLoading ? (
                <>
                  <SkeletonLoader height={60} borderRadius={Radius.lg} />
                  <SkeletonLoader height={60} borderRadius={Radius.lg} />
                </>
              ) : statsError ? (
                <View style={styles.emptyState}>
                  <AlertCircle size={36} color={Colors.error} strokeWidth={1.5} />
                  <Text style={styles.emptyText}>Could not load stats</Text>
                </View>
              ) : (
                [
                  { label: 'Total Eagles',   value: stats?.totalEagles  ?? 0,    Icon: Zap,        color: Colors.eagle },
                  { label: 'Total Birdies',  value: stats?.totalBirdies ?? 0,    Icon: Star,       color: Colors.birdie },
                  { label: 'Total Pars',     value: stats?.totalPars    ?? 0,    Icon: Flag,       color: Colors.textSecondary },
                  { label: 'Best Score',     value: stats?.bestScore    ?? '–',  Icon: Trophy,     color: Colors.lime },
                  { label: 'Average Score',  value: stats?.averageScore ? stats.averageScore.toFixed(1) : '–', Icon: TrendingUp, color: Colors.purple },
                  { label: 'Total Rounds',   value: stats?.totalRounds  ?? 0,    Icon: Map,        color: Colors.textPrimary },
                ].map((s) => (
                  <GlassCard key={s.label} style={styles.statCard} padding={14}>
                    <s.Icon size={22} color={s.color} strokeWidth={1.8} />
                    <Text style={styles.statLabel}>{s.label}</Text>
                    <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
                  </GlassCard>
                ))
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

  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: 14 },
  username: { color: Colors.textPrimary, fontSize: 20, fontWeight: '800' },
  topBarRight: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.bgSecondary, borderWidth: 1, borderColor: Colors.cardBorder,
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  bellBadge: {
    position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  bellBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorTitle: { color: Colors.textSecondary, fontSize: 16 },
  retryBtn: {
    backgroundColor: Colors.limeDim, borderRadius: Radius.pill,
    paddingHorizontal: 20, paddingVertical: 8,
    borderWidth: 1, borderColor: Colors.lime + '40',
  },
  retryText: { color: Colors.lime, fontSize: 13, fontWeight: '700' },

  scroll: { paddingHorizontal: 0 },

  heroCard: {
    marginHorizontal: Spacing.md, marginBottom: 16,
    borderRadius: Radius.xl, padding: 20,
    borderWidth: 1, borderColor: Colors.lime + '20', overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute', top: -40, right: -40, width: 150, height: 150,
    borderRadius: 75, backgroundColor: Colors.lime, opacity: 0.06,
  },
  heroTop: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  heroInfo: { flex: 1, gap: 6 },
  heroName: { color: Colors.textPrimary, fontSize: 20, fontWeight: '800' },
  roleBadge: { alignSelf: 'flex-start', borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1 },
  roleText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { color: Colors.textMuted, fontSize: 12 },
  bio: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 14 },

  followRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: Colors.cardBorder },
  followStat: { flex: 1, alignItems: 'center' },
  followCount: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800' },
  followLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginTop: 2 },
  followDivider: { width: 1, height: 32, backgroundColor: Colors.cardBorder },

  hcpRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: Colors.cardBorder,
  },
  hcpLeft: { flex: 1 },
  hcpValue: { color: Colors.lime, fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  hcpBtn: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: Radius.pill,
    backgroundColor: Colors.limeDim,
    borderWidth: 1, borderColor: Colors.lime + '50',
    minWidth: 80, alignItems: 'center', justifyContent: 'center',
  },
  hcpBtnText: { color: Colors.lime, fontSize: 13, fontWeight: '700' },

  heroStats: { flexDirection: 'row', marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: Colors.cardBorder },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatValue: { fontSize: 20, fontWeight: '800' },
  heroStatLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: '600', letterSpacing: 0.5, marginTop: 3 },

  highlightsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: Spacing.md, marginBottom: 20 },
  highlightItem: { alignItems: 'center', gap: 4 },
  highlightCircle: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: Colors.bgSecondary, borderWidth: 2, borderColor: Colors.lime + '40',
    alignItems: 'center', justifyContent: 'center',
  },
  highlightValue: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  highlightLabel: { color: Colors.textMuted, fontSize: 10 },

  tabToggle: {
    flexDirection: 'row',
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.cardBorder,
    marginBottom: 2,
  },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: Colors.lime },

  // Posts grid
  gridWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  gridCell: { margin: 1, overflow: 'hidden' },
  gridImg: { width: '100%', height: '100%' },
  gridTextCard: {
    flex: 1, backgroundColor: Colors.bgSecondary,
    alignItems: 'center', justifyContent: 'center', padding: 8,
  },
  gridText: { color: Colors.textSecondary, fontSize: 11, textAlign: 'center', lineHeight: 15 },

  // Rounds
  roundsSection: { gap: 8, paddingHorizontal: Spacing.md, marginTop: 8, paddingBottom: 20 },
  roundCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roundLeft: {},
  roundEvent: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  roundDate: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  roundRight: { alignItems: 'flex-end' },
  roundGross: { color: Colors.lime, fontSize: 18, fontWeight: '800' },
  roundNet: { color: Colors.textMuted, fontSize: 12 },

  // Stats
  statsSection: { gap: 8, paddingHorizontal: Spacing.md, marginTop: 8, paddingBottom: 20 },
  statCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statLabel: { color: Colors.textSecondary, fontSize: 14, flex: 1 },
  statValue: { fontSize: 22, fontWeight: '800' },

  // Empty
  emptyState: { alignItems: 'center', paddingTop: 40, gap: 10, width: '100%' },
  emptyText: { color: Colors.textSecondary, fontSize: 15 },

  // Avatar wrapper + camera badge
  avatarWrapper: { position: 'relative' },
  cameraBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: Colors.lime, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.bg,
  },

  // Edit profile modal
  modalOverlay: {
    flex: 1, backgroundColor: Colors.overlay,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  modalCard: {
    width: '100%', backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.xl, padding: 24,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  modalTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800', marginBottom: 20 },
  modalLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginBottom: 6 },
  modalInput: {
    backgroundColor: Colors.bgTertiary, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.cardBorder,
    color: Colors.textPrimary, fontSize: 15, paddingHorizontal: 14, paddingVertical: 11,
    marginBottom: 16,
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalBtn: { flex: 1, height: 44, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  modalBtnCancel: { backgroundColor: Colors.bgTertiary, borderWidth: 1, borderColor: Colors.cardBorder },
  modalBtnCancelText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '700' },
  modalBtnSave: { backgroundColor: Colors.lime },
  modalBtnSaveText: { color: Colors.bg, fontSize: 14, fontWeight: '800' },
});
