import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Dimensions, Image, RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import {
  useUser, useUserStats, useUserPosts, useFollowers,
  useFollowing, useMe, useFollowMutation,
} from '../../hooks/useQueries';
import AvatarRing from '../../components/ui/AvatarRing';
import GlassCard from '../../components/ui/GlassCard';
import GradientButton from '../../components/ui/GradientButton';
import SkeletonLoader from '../../components/ui/SkeletonLoader';
import { Colors, Gradients, Radius, Spacing } from '../../constants/theme';

// ─── Layout ───────────────────────────────────────────────────────────────────

const { width } = Dimensions.get('window');
const CELL = (width - 4) / 3;

type ProfileTab = 'posts' | 'rounds' | 'stats';

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function ProfileSkeleton({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.skeletonWrap}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={18} color={Colors.textPrimary} />
        </TouchableOpacity>
        <SkeletonLoader width={120} height={14} />
        <View style={{ width: 36 }} />
      </View>
      <View style={{ padding: Spacing.md, gap: 12 }}>
        <SkeletonLoader height={220} borderRadius={Radius.xl} />
        <SkeletonLoader height={80} borderRadius={Radius.lg} />
        <SkeletonLoader height={80} borderRadius={Radius.lg} />
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Data queries
  const { data: profile, isLoading: profileLoading, isError, refetch: refetchProfile } = useUser(id);
  const { data: stats, refetch: refetchStats } = useUserStats(id);
  const { data: posts = [], refetch: refetchPosts } = useUserPosts(id);
  const { data: followers = [], refetch: refetchFollowers } = useFollowers(id);
  const { data: following = [], refetch: refetchFollowing } = useFollowing(id);
  const { data: me } = useMe();
  const { follow, unfollow } = useFollowMutation();

  const isLoading = profileLoading;
  const isMe = me?.id === (profile as any)?.id;

  // Determine follow state from followers list
  const isFollowing = !!(me && (followers as any[]).some((f: any) => f.id === me.id));

  const isPrivate = !!(profile as any)?.isPrivate;
  const canSeePosts = !isPrivate || isFollowing || isMe;

  const postsData: any[] = (posts as any[]) ?? [];
  const followersData: any[] = (followers as any[]) ?? [];
  const followingData: any[] = (following as any[]) ?? [];

  const isFollowPending = follow.isPending || unfollow.isPending;

  function refetchAll() {
    refetchProfile();
    refetchStats();
    refetchPosts();
    refetchFollowers();
    refetchFollowing();
  }

  async function handleFollowToggle() {
    if (!me || isFollowPending) return;

    // Optimistic update via cache invalidation is handled in mutation onSuccess
    if (isFollowing) {
      await unfollow.mutateAsync(id);
    } else {
      await follow.mutateAsync(id);
    }
    qc.invalidateQueries({ queryKey: ['followers', id] });
  }

  if (isLoading || !profile) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <ProfileSkeleton onBack={() => router.back()} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={18} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
        </View>
        <View style={styles.errorState}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
          <Text style={styles.errorText}>Couldn't load profile</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => refetchProfile()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const p = profile as any;
  const s = stats as any;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={18} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.topTitle} numberOfLines={1}>
          {p.name?.split(' ')[0] ?? ''}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={refetchAll}
            tintColor={Colors.lime}
          />
        }
      >
        {/* Hero card */}
        <LinearGradient colors={Gradients.hero} style={styles.heroCard}>
          <View style={styles.heroGlow} />

          <View style={styles.heroTop}>
            <AvatarRing uri={p.avatar} name={p.name} size={80} ring="lime" ringWidth={2} />
            <View style={styles.heroInfo}>
              <Text style={styles.heroName}>{p.name}</Text>
              {p.username && (
                <Text style={styles.heroUsername}>@{p.username}</Text>
              )}
              <View style={[styles.roleBadge, {
                borderColor: p.role !== 'USER' ? Colors.lime + '50' : Colors.cardBorder,
                backgroundColor: p.role !== 'USER' ? Colors.limeDim : Colors.bgTertiary,
              }]}>
                <Text style={[styles.roleText, {
                  color: p.role !== 'USER' ? Colors.lime : Colors.textSecondary,
                }]}>
                  {p.role === 'SUPER_ADMIN' ? 'Admin'
                    : p.role === 'SCOREKEEPER' ? 'Scorekeeper'
                    : 'Member'}
                </Text>
              </View>
              {p.homeCourse && (
                <View style={styles.homeCourseRow}>
                  <Ionicons name="flag-outline" size={11} color={Colors.textMuted} />
                  <Text style={styles.homeCourseText}>{p.homeCourse}</Text>
                </View>
              )}
            </View>
          </View>

          {p.bio && <Text style={styles.bio}>{p.bio}</Text>}

          {/* Follower / Following counts */}
          <View style={styles.socialCounts}>
            <TouchableOpacity style={styles.countItem}>
              <Text style={styles.countValue}>{followersData.length}</Text>
              <Text style={styles.countLabel}>Followers</Text>
            </TouchableOpacity>
            <View style={styles.countDivider} />
            <TouchableOpacity style={styles.countItem}>
              <Text style={styles.countValue}>{followingData.length}</Text>
              <Text style={styles.countLabel}>Following</Text>
            </TouchableOpacity>
          </View>

          {/* Stats row */}
          <View style={styles.heroStats}>
            {[
              { label: 'HCP',    value: p.handicap ?? '–',             color: Colors.lime   },
              { label: 'Rounds', value: s?.totalRounds ?? 0,           color: Colors.purple },
              { label: 'Best',   value: s?.bestScore ?? '–',           color: Colors.textPrimary },
              { label: 'Avg',    value: s?.averageScore?.toFixed(1) ?? '–', color: Colors.textPrimary },
            ].map((stat, i) => (
              <View key={i} style={styles.heroStat}>
                <Text style={[styles.heroStatValue, { color: stat.color }]}>{stat.value}</Text>
                <Text style={styles.heroStatLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>

          {/* Action buttons */}
          {!isMe && (
            <View style={styles.actionRow}>
              <GradientButton
                label={isFollowPending ? '...' : isFollowing ? 'Following' : 'Follow'}
                variant={isFollowing ? 'outline' : 'gradient'}
                onPress={handleFollowToggle}
                size="sm"
                style={{ flex: 1 }}
              />
              <TouchableOpacity
                style={styles.messageBtn}
                onPress={() => router.push(`/messages/${p.id}` as any)}
                activeOpacity={0.75}
              >
                <Ionicons name="chatbubble-outline" size={16} color={Colors.textSecondary} />
                <Text style={styles.messageBtnText}>Message</Text>
              </TouchableOpacity>
            </View>
          )}
        </LinearGradient>

        {/* Highlight circles */}
        <View style={styles.highlightsRow}>
          {[
            { icon: 'flash',   label: 'Eagles',  value: s?.totalEagles  ?? 0, color: Colors.eagle  },
            { icon: 'star',    label: 'Birdies', value: s?.totalBirdies ?? 0, color: Colors.birdie },
            { icon: 'flag',    label: 'Pars',    value: s?.totalPars    ?? 0, color: Colors.textSecondary },
            { icon: 'trophy',  label: 'Rounds',  value: s?.totalRounds  ?? 0, color: Colors.lime   },
          ].map((h) => (
            <View key={h.label} style={styles.highlightItem}>
              <View style={[styles.highlightCircle, { borderColor: h.color + '40' }]}>
                <Ionicons name={h.icon as any} size={22} color={h.color} />
              </View>
              <Text style={styles.highlightValue}>{h.value}</Text>
              <Text style={styles.highlightLabel}>{h.label}</Text>
            </View>
          ))}
        </View>

        {/* Tab bar */}
        <View style={styles.tabBar}>
          {([
            { id: 'posts' as ProfileTab,  icon: 'grid-outline'        },
            { id: 'rounds' as ProfileTab, icon: 'list-outline'         },
            { id: 'stats' as ProfileTab,  icon: 'trending-up-outline'  },
          ]).map((t) => (
            <TouchableOpacity
              key={t.id}
              style={[styles.tabBtn, activeTab === t.id && styles.tabBtnActive]}
              onPress={() => setActiveTab(t.id)}
            >
              <Ionicons
                name={t.icon as any}
                size={20}
                color={activeTab === t.id ? Colors.lime : Colors.textMuted}
              />
            </TouchableOpacity>
          ))}

          {/* Grid / list toggle (posts tab only) */}
          {activeTab === 'posts' && (
            <TouchableOpacity
              style={styles.viewToggle}
              onPress={() => setViewMode(v => v === 'grid' ? 'list' : 'grid')}
            >
              <Ionicons
                name={viewMode === 'grid' ? 'list-outline' : 'grid-outline'}
                size={18}
                color={Colors.textMuted}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Posts tab ── */}
        {activeTab === 'posts' && (
          <>
            {!canSeePosts ? (
              <View style={styles.privateState}>
                <Ionicons name="lock-closed-outline" size={36} color={Colors.textMuted} />
                <Text style={styles.privateTitle}>This account is private</Text>
                <Text style={styles.privateText}>
                  Follow {p.name?.split(' ')[0] ?? 'this user'} to see their posts.
                </Text>
              </View>
            ) : postsData.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="grid-outline" size={36} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>No posts yet</Text>
              </View>
            ) : viewMode === 'grid' ? (
              <View style={styles.gridRow}>
                {postsData.map((post: any, i: number) => (
                  <TouchableOpacity
                    key={post.id ?? i}
                    style={[styles.gridCell, { width: CELL, height: CELL }]}
                    activeOpacity={0.8}
                  >
                    {post.imageUrl ? (
                      <Image source={{ uri: post.imageUrl }} style={styles.gridImg} resizeMode="cover" />
                    ) : (
                      <LinearGradient colors={['#1A1A2E', '#0F0F1A']} style={styles.gridTextCard}>
                        <Text style={styles.gridText} numberOfLines={4}>{post.content}</Text>
                      </LinearGradient>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.listPosts}>
                {postsData.map((post: any, i: number) => (
                  <View key={post.id ?? i} style={styles.listPostCard}>
                    {post.imageUrl && (
                      <Image
                        source={{ uri: post.imageUrl }}
                        style={styles.listPostImg}
                        resizeMode="cover"
                      />
                    )}
                    {post.content && (
                      <Text style={styles.listPostContent} numberOfLines={4}>
                        {post.content}
                      </Text>
                    )}
                    <Text style={styles.listPostDate}>
                      {new Date(post.createdAt).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* ── Rounds tab ── */}
        {activeTab === 'rounds' && (
          !canSeePosts ? (
            <View style={styles.privateState}>
              <Ionicons name="lock-closed-outline" size={36} color={Colors.textMuted} />
              <Text style={styles.privateTitle}>This account is private</Text>
            </View>
          ) : !s?.roundBreakdown?.length ? (
            <View style={styles.emptyState}>
              <Ionicons name="flag-outline" size={36} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No rounds yet</Text>
            </View>
          ) : (
            <View style={styles.roundsSection}>
              {(s.roundBreakdown || []).map((r: any) => (
                <GlassCard key={r.roundId} style={styles.roundCard} padding={14}>
                  <View>
                    <Text style={styles.roundEvent}>{r.eventName}</Text>
                    <Text style={styles.roundDate}>
                      {new Date(r.date).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}
                    </Text>
                  </View>
                  <View style={styles.roundRight}>
                    <Text style={styles.roundGross}>{r.grossScore}</Text>
                    <Text style={styles.roundNet}>net {r.netScore}</Text>
                  </View>
                </GlassCard>
              ))}
            </View>
          )
        )}

        {/* ── Stats tab ── */}
        {activeTab === 'stats' && (
          !canSeePosts ? (
            <View style={styles.privateState}>
              <Ionicons name="lock-closed-outline" size={36} color={Colors.textMuted} />
              <Text style={styles.privateTitle}>This account is private</Text>
            </View>
          ) : (
            <View style={styles.statsSection}>
              {[
                { label: 'Total Rounds',  value: s?.totalRounds ?? 0,                  icon: 'map-outline',         color: Colors.lime   },
                { label: 'Avg Score',     value: s?.averageScore?.toFixed(1) ?? '–',   icon: 'trending-up-outline', color: Colors.purple },
                { label: 'Best Round',    value: s?.bestScore ?? '–',                  icon: 'trophy-outline',      color: Colors.lime   },
                { label: 'Eagles',        value: s?.totalEagles ?? 0,                  icon: 'flash-outline',       color: Colors.eagle  },
                { label: 'Birdies',       value: s?.totalBirdies ?? 0,                 icon: 'star-outline',        color: Colors.birdie },
              ].map((stat) => (
                <GlassCard key={stat.label} style={styles.statCard} padding={16}>
                  <Ionicons name={stat.icon as any} size={22} color={stat.color} />
                  <Text style={styles.statLabel}>{stat.label}</Text>
                  <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
                </GlassCard>
              ))}
            </View>
          )
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },

  skeletonWrap: { flex: 1 },

  errorState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  errorText: { color: Colors.textSecondary, fontSize: 15 },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  retryText: { color: Colors.textPrimary, fontWeight: '600' },

  scroll: { paddingHorizontal: Spacing.md },

  heroCard: {
    borderRadius: Radius.xl,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.lime + '20',
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: Colors.lime,
    opacity: 0.06,
  },
  heroTop: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  heroInfo: { flex: 1, gap: 5 },
  heroName: { color: Colors.textPrimary, fontSize: 20, fontWeight: '800' },
  heroUsername: { color: Colors.textMuted, fontSize: 13 },
  roleBadge: {
    alignSelf: 'flex-start',
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
  },
  roleText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  homeCourseRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  homeCourseText: { color: Colors.textMuted, fontSize: 12 },
  bio: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 14 },

  socialCounts: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
  countItem: { flex: 1, alignItems: 'center', gap: 2 },
  countValue: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800' },
  countLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: '500' },
  countDivider: { width: 1, height: 30, backgroundColor: Colors.cardBorder, marginHorizontal: 16 },

  heroStats: {
    flexDirection: 'row',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatValue: { fontSize: 20, fontWeight: '800' },
  heroStatLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: 3,
  },

  actionRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  messageBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingVertical: 9,
    backgroundColor: Colors.bgSecondary,
  },
  messageBtnText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },

  highlightsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  highlightItem: { alignItems: 'center', gap: 4 },
  highlightCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightValue: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  highlightLabel: { color: Colors.textMuted, fontSize: 10 },

  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: 2,
    marginHorizontal: -Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: Colors.lime },
  viewToggle: {
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  privateState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 40,
    gap: 10,
  },
  privateTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700' },
  privateText: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 240,
  },

  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
    marginHorizontal: -Spacing.md,
  },
  gridCell: { overflow: 'hidden' },
  gridImg: { width: '100%', height: '100%' },
  gridTextCard: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 8 },
  gridText: { color: Colors.textSecondary, fontSize: 11, textAlign: 'center' },

  listPosts: { gap: 10, marginTop: 8 },
  listPostCard: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: 'hidden',
  },
  listPostImg: { width: '100%', height: 200 },
  listPostContent: {
    color: Colors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
    padding: 14,
  },
  listPostDate: {
    color: Colors.textMuted,
    fontSize: 11,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },

  roundsSection: { gap: 8, marginTop: 8 },
  roundCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roundEvent: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  roundDate: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  roundRight: { alignItems: 'flex-end' },
  roundGross: { color: Colors.lime, fontSize: 18, fontWeight: '800' },
  roundNet: { color: Colors.textMuted, fontSize: 12 },

  statsSection: { gap: 8, marginTop: 8 },
  statCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statLabel: { flex: 1, color: Colors.textSecondary, fontSize: 14 },
  statValue: { fontSize: 22, fontWeight: '800' },

  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 40,
    gap: 8,
    width: '100%',
  },
  emptyTitle: { color: Colors.textSecondary, fontSize: 15 },
});
