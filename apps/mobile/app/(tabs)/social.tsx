import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, TextInput,
  Modal, FlatList, RefreshControl, Alert, Pressable, ActivityIndicator,
  Platform, KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient, useMutation, useInfiniteQuery } from '@tanstack/react-query';
import { postsApi, usersApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';
import AvatarRing from '../../components/ui/AvatarRing';
import GlassCard from '../../components/ui/GlassCard';
import { SkeletonCard } from '../../components/ui/SkeletonLoader';
import { Colors, Radius, Spacing } from '../../constants/theme';
import { API_BASE } from '../../constants/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type FeedTab = 'friends' | 'discover';

interface SocialPost {
  id: string;
  content: string;
  imageUrl?: string | null;
  mediaUrl?: string | null;
  courseTag?: string | null;
  location?: string | null;
  createdAt: string;
  likes?: number;
  likedByMe?: boolean;
  commentCount?: number;
  user?: {
    id: string;
    name: string;
    username?: string;
    avatar?: string | null;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

// ─── Post card ────────────────────────────────────────────────────────────────

interface PostCardProps {
  post: SocialPost;
  currentUserId?: string;
  onLike: (post: SocialPost) => void;
  onComment: (post: SocialPost) => void;
  onDelete: (post: SocialPost) => void;
  onAuthorPress: (userId: string) => void;
  onFollow?: (userId: string) => void;
  showFollow?: boolean;
}

function PostCard({
  post, currentUserId, onLike, onComment, onDelete, onAuthorPress, onFollow, showFollow,
}: PostCardProps) {
  const isOwn = post.user?.id === currentUserId;
  const imageUri = post.imageUrl ?? post.mediaUrl;
  const likeCount = post.likes ?? 0;
  const commentCount = post.commentCount ?? 0;

  return (
    <GlassCard style={pcStyles.card}>
      {/* Author row */}
      <View style={pcStyles.authorRow}>
        <Pressable style={pcStyles.authorLeft} onPress={() => post.user?.id && onAuthorPress(post.user.id)}>
          <AvatarRing uri={post.user?.avatar} name={post.user?.name} size={38} ring="none" />
          <View style={{ flex: 1 }}>
            <Text style={pcStyles.authorName} numberOfLines={1}>{post.user?.name ?? 'Golfer'}</Text>
            <View style={pcStyles.metaRow}>
              {post.user?.username && (
                <Text style={pcStyles.username}>@{post.user.username} · </Text>
              )}
              {post.courseTag && (
                <>
                  <Ionicons name="flag" size={10} color={Colors.lime} />
                  <Text style={pcStyles.courseTag}>{post.courseTag} · </Text>
                </>
              )}
              <Text style={pcStyles.timeAgo}>{timeAgo(post.createdAt)}</Text>
            </View>
          </View>
        </Pressable>

        {!isOwn && showFollow && onFollow && post.user?.id && (
          <TouchableOpacity
            style={pcStyles.followBtn}
            onPress={() => onFollow(post.user!.id)}
          >
            <Text style={pcStyles.followBtnText}>Follow</Text>
          </TouchableOpacity>
        )}

        {isOwn && (
          <Pressable onLongPress={() => onDelete(post)} hitSlop={12}>
            <Ionicons name="ellipsis-horizontal" size={18} color={Colors.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Image */}
      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          style={pcStyles.postImage}
          resizeMode="cover"
        />
      ) : null}

      {/* Content */}
      {post.content?.trim() ? (
        <Text style={pcStyles.content}>
          <Text style={pcStyles.authorNameInline}>{post.user?.name?.split(' ')[0]} </Text>
          {post.content}
        </Text>
      ) : null}

      {/* Location */}
      {post.location ? (
        <View style={pcStyles.locationRow}>
          <Ionicons name="location-outline" size={11} color={Colors.textMuted} />
          <Text style={pcStyles.locationText}>{post.location}</Text>
        </View>
      ) : null}

      {/* Actions */}
      <View style={pcStyles.actions}>
        <TouchableOpacity style={pcStyles.actionBtn} onPress={() => onLike(post)}>
          <Ionicons
            name={post.likedByMe ? 'heart' : 'heart-outline'}
            size={22}
            color={post.likedByMe ? '#EF4444' : Colors.textSecondary}
          />
          {likeCount > 0 && (
            <Text style={[pcStyles.actionCount, post.likedByMe && { color: '#EF4444' }]}>
              {likeCount}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={pcStyles.actionBtn} onPress={() => onComment(post)}>
          <Ionicons name="chatbubble-outline" size={20} color={Colors.textSecondary} />
          {commentCount > 0 && <Text style={pcStyles.actionCount}>{commentCount}</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={pcStyles.actionBtn}>
          <Ionicons name="paper-plane-outline" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </GlassCard>
  );
}

const pcStyles = StyleSheet.create({
  card:        { marginBottom: 12 },
  authorRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  authorLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  authorName:  { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  metaRow:     { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 2 },
  username:    { color: Colors.textMuted, fontSize: 11 },
  courseTag:   { color: Colors.lime, fontSize: 11, marginLeft: 4 },
  timeAgo:     { color: Colors.textSecondary, fontSize: 11 },
  followBtn: {
    borderWidth: 1, borderColor: Colors.lime, borderRadius: Radius.pill,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  followBtnText: { color: Colors.lime, fontSize: 12, fontWeight: '600' },
  postImage: {
    width: '100%', height: 240, borderRadius: Radius.md, marginBottom: 10,
  },
  content:         { color: Colors.textPrimary, fontSize: 14, lineHeight: 20, marginBottom: 8 },
  authorNameInline: { fontWeight: '700' },
  locationRow:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  locationText:    { color: Colors.textMuted, fontSize: 11 },
  actions: {
    flexDirection: 'row', gap: 16, paddingTop: 6,
    borderTopWidth: 1, borderTopColor: Colors.cardBorder + '60',
  },
  actionBtn:   { flexDirection: 'row', alignItems: 'center', gap: 5, padding: 2 },
  actionCount: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
});

// ─── Suggestions row ──────────────────────────────────────────────────────────

function SuggestionsRow() {
  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ['suggestions'],
    queryFn: () => usersApi.getSuggestions(),
  });

  const [followed, setFollowed] = useState<Set<string>>(new Set());

  async function handleFollow(userId: string) {
    setFollowed(prev => new Set([...prev, userId]));
    try {
      await usersApi.follow(userId);
    } catch {
      setFollowed(prev => { const n = new Set(prev); n.delete(userId); return n; });
    }
  }

  if (isLoading || suggestions.length === 0) return null;

  return (
    <View style={sgStyles.wrap}>
      <View style={sgStyles.headerRow}>
        <Text style={sgStyles.title}>People You May Know</Text>
      </View>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={suggestions as any[]}
        keyExtractor={u => u.id}
        contentContainerStyle={{ gap: 10, paddingRight: Spacing.md }}
        renderItem={({ item: u }) => (
          <GlassCard style={sgStyles.card} padding={14}>
            <AvatarRing uri={u.avatar} name={u.name} size={48} ring="none" />
            <Text style={sgStyles.name} numberOfLines={1}>{u.name}</Text>
            {u.handicap != null && <Text style={sgStyles.hcp}>HCP {u.handicap}</Text>}
            <TouchableOpacity
              style={[sgStyles.followBtn, followed.has(u.id) && sgStyles.followBtnActive]}
              onPress={() => !followed.has(u.id) && handleFollow(u.id)}
            >
              <Text style={[sgStyles.followBtnText, followed.has(u.id) && sgStyles.followBtnTextActive]}>
                {followed.has(u.id) ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
          </GlassCard>
        )}
      />
    </View>
  );
}

const sgStyles = StyleSheet.create({
  wrap:       { marginBottom: 16 },
  headerRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.md, marginBottom: 10 },
  title:      { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  card:       { alignItems: 'center', width: 130, gap: 4 },
  name:       { color: Colors.textPrimary, fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: 4 },
  hcp:        { color: Colors.lime, fontSize: 11, fontWeight: '600' },
  followBtn:  {
    marginTop: 6, paddingHorizontal: 16, paddingVertical: 6,
    borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.lime,
  },
  followBtnActive:     { backgroundColor: Colors.lime },
  followBtnText:       { color: Colors.lime, fontSize: 12, fontWeight: '600' },
  followBtnTextActive: { color: Colors.bg },
});

// ─── Compose modal ────────────────────────────────────────────────────────────

interface ComposeModalProps {
  visible: boolean;
  onClose: () => void;
  onPosted: () => void;
}

function ComposeModal({ visible, onClose, onPosted }: ComposeModalProps) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [courseTag, setCourseTag] = useState('');
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) { setContent(''); setCourseTag(''); setMediaUri(null); }
  }, [visible]);

  async function pickMedia() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.85,
      allowsEditing: true,
    });
    if (!result.canceled) setMediaUri(result.assets[0].uri);
  }

  async function handlePost() {
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      let token: string | null = null;
      if (Platform.OS === 'web') {
        try { token = localStorage.getItem('auth_token'); } catch { /* ignore */ }
      } else {
        const SecureStore = await import('expo-secure-store');
        token = await SecureStore.getItemAsync('auth_token');
      }

      if (mediaUri) {
        const formData = new FormData();
        formData.append('content', content.trim());
        if (courseTag.trim()) formData.append('courseTag', courseTag.trim());
        const filename = mediaUri.split('/').pop()!;
        const type = filename.endsWith('.mp4') || filename.endsWith('.mov') ? 'video/mp4' : 'image/jpeg';
        formData.append('media', { uri: mediaUri, name: filename, type } as unknown as Blob);
        await fetch(`${API_BASE}/posts`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
      } else {
        await fetch(`${API_BASE}/posts`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: content.trim(),
            ...(courseTag.trim() ? { courseTag: courseTag.trim() } : {}),
          }),
        });
      }
      onPosted();
    } catch {
      Alert.alert('Error', 'Failed to post. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const canPost = content.trim().length > 0 && !submitting;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[cmStyles.sheet, { paddingTop: insets.top + 16 }]}>
          {/* Header */}
          <View style={cmStyles.header}>
            <TouchableOpacity onPress={onClose}>
              <Text style={cmStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={cmStyles.title}>New Post</Text>
            <TouchableOpacity
              style={[cmStyles.postBtn, !canPost && { opacity: 0.45 }]}
              onPress={handlePost}
              disabled={!canPost}
            >
              {submitting
                ? <ActivityIndicator color={Colors.bg} size="small" />
                : <Text style={cmStyles.postBtnText}>Post</Text>
              }
            </TouchableOpacity>
          </View>

          {/* Author row */}
          <View style={cmStyles.authorRow}>
            <AvatarRing uri={user?.avatar} name={user?.name} size={38} ring="lime" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={cmStyles.authorName}>{user?.name}</Text>
              {user?.username && <Text style={cmStyles.authorUsername}>@{user.username}</Text>}
            </View>
          </View>

          <TextInput
            style={cmStyles.input}
            placeholder="What's happening on the course?"
            placeholderTextColor={Colors.textMuted}
            value={content}
            onChangeText={setContent}
            multiline
            maxLength={500}
            autoFocus
          />

          {/* Character count */}
          <Text style={cmStyles.charCount}>{content.length}/500</Text>

          {/* Media preview */}
          {mediaUri && (
            <View style={cmStyles.mediaWrap}>
              <Image source={{ uri: mediaUri }} style={cmStyles.mediaPreview} resizeMode="cover" />
              <TouchableOpacity style={cmStyles.removeMedia} onPress={() => setMediaUri(null)}>
                <Ionicons name="close-circle" size={26} color={Colors.error} />
              </TouchableOpacity>
            </View>
          )}

          {/* Course tag */}
          <View style={cmStyles.tagRow}>
            <Ionicons name="flag-outline" size={16} color={Colors.lime} />
            <TextInput
              style={cmStyles.tagInput}
              placeholder="Tag a course (optional)"
              placeholderTextColor={Colors.textMuted}
              value={courseTag}
              onChangeText={setCourseTag}
            />
          </View>

          {/* Toolbar */}
          <View style={cmStyles.toolbar}>
            <TouchableOpacity style={cmStyles.toolBtn} onPress={pickMedia}>
              <View style={cmStyles.toolIconWrap}>
                <Ionicons name="image-outline" size={20} color={Colors.lime} />
              </View>
              <Text style={cmStyles.toolLabel}>Photo / Video</Text>
            </TouchableOpacity>
            <TouchableOpacity style={cmStyles.toolBtn}>
              <View style={cmStyles.toolIconWrap}>
                <Ionicons name="location-outline" size={20} color={Colors.purple} />
              </View>
              <Text style={cmStyles.toolLabel}>Location</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const cmStyles = StyleSheet.create({
  sheet: {
    flex: 1, backgroundColor: Colors.bg, paddingHorizontal: Spacing.md,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 20,
  },
  cancelText:    { color: Colors.textSecondary, fontSize: 15 },
  title:         { color: Colors.textPrimary, fontSize: 16, fontWeight: '700' },
  postBtn: {
    backgroundColor: Colors.lime, borderRadius: Radius.pill,
    paddingHorizontal: 18, paddingVertical: 8, minWidth: 56, alignItems: 'center',
  },
  postBtnText: { color: Colors.bg, fontSize: 14, fontWeight: '800' },

  authorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  authorName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  authorUsername: { color: Colors.textSecondary, fontSize: 12 },

  input: {
    color: Colors.textPrimary, fontSize: 16, lineHeight: 24,
    minHeight: 100, textAlignVertical: 'top', marginBottom: 4,
  },
  charCount: { color: Colors.textMuted, fontSize: 11, textAlign: 'right', marginBottom: 12 },

  mediaWrap:    { marginBottom: 12, position: 'relative' },
  mediaPreview: { width: '100%', height: 200, borderRadius: Radius.lg },
  removeMedia:  { position: 'absolute', top: 8, right: 8 },

  tagRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 20, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder,
    paddingBottom: 10,
  },
  tagInput: { flex: 1, color: Colors.textPrimary, fontSize: 14 },

  toolbar: {
    flexDirection: 'row', gap: 20, borderTopWidth: 1,
    borderTopColor: Colors.cardBorder, paddingTop: 16,
  },
  toolBtn:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toolIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.bgSecondary, alignItems: 'center', justifyContent: 'center',
  },
  toolLabel: { color: Colors.textSecondary, fontSize: 13 },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function SocialScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<FeedTab>('discover');
  const [showCompose, setShowCompose] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [optimisticLikes, setOptimisticLikes] = useState<Record<string, boolean>>({});

  // ── Infinite feed query ───────────────────────────────────────────────────

  const {
    data: feedData,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['feed', tab],
    queryFn: ({ pageParam = 1 }) => postsApi.getFeed(tab, pageParam as number) as Promise<SocialPost[]>,
    getNextPageParam: (lastPage: SocialPost[], allPages: SocialPost[][]) =>
      lastPage.length === 0 ? undefined : allPages.length + 1,
    initialPageParam: 1,
  });

  const posts: SocialPost[] = feedData?.pages.flat() ?? [];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['feed', tab] });
    setRefreshing(false);
  }, [queryClient, tab]);

  // ── Like mutation (optimistic) ────────────────────────────────────────────

  const likeMutation = useMutation({
    mutationFn: ({ id, liked }: { id: string; liked: boolean }) =>
      liked ? postsApi.unlike(id) : postsApi.like(id),
    onMutate: ({ id, liked }) => {
      setOptimisticLikes(prev => ({ ...prev, [id]: !liked }));
    },
    onError: (_, { id, liked }) => {
      setOptimisticLikes(prev => ({ ...prev, [id]: liked }));
      Alert.alert('Error', 'Failed to update like.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['feed', tab] });
    },
  });

  function handleLike(post: SocialPost) {
    const isOptimisticallyLiked = id in optimisticLikes
      ? optimisticLikes[post.id]
      : post.likedByMe;
    likeMutation.mutate({ id: post.id, liked: !!isOptimisticallyLiked });
  }

  // ── Follow ────────────────────────────────────────────────────────────────

  async function handleFollow(userId: string) {
    try {
      await usersApi.follow(userId);
      queryClient.invalidateQueries({ queryKey: ['feed', tab] });
      queryClient.invalidateQueries({ queryKey: ['suggestions'] });
    } catch {
      Alert.alert('Error', 'Failed to follow user.');
    }
  }

  // ── Delete post ───────────────────────────────────────────────────────────

  function handleDeletePost(post: SocialPost) {
    Alert.alert('Delete Post', 'Are you sure you want to delete this post?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await postsApi.delete(post.id);
            queryClient.invalidateQueries({ queryKey: ['feed', tab] });
          } catch {
            Alert.alert('Error', 'Failed to delete post.');
          }
        },
      },
    ]);
  }

  // ── Handle end of list (infinite scroll) ─────────────────────────────────

  function handleEndReached() {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  const listHeader = (
    <>
      {/* Feed tab toggle */}
      <View style={styles.tabToggleRow}>
        <View style={styles.tabToggle}>
          {(['friends', 'discover'] as FeedTab[]).map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.tabToggleBtn, tab === t && styles.tabToggleBtnActive]}
              onPress={() => setTab(t)}
            >
              <Text style={[styles.tabToggleLabel, tab === t && styles.tabToggleLabelActive]}>
                {t === 'friends' ? 'Friends Feed' : 'Discover'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Suggestions (Discover only) */}
      {tab === 'discover' && <SuggestionsRow />}
    </>
  );

  const listEmpty = isLoading ? (
    <View style={{ paddingHorizontal: Spacing.md }}>
      {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
    </View>
  ) : (
    <View style={styles.emptyState}>
      <Ionicons name="compass-outline" size={52} color={Colors.textMuted} />
      <Text style={styles.emptyText}>Nothing here yet</Text>
      <Text style={styles.emptySub}>
        {tab === 'friends'
          ? 'Follow other golfers to see their posts here.'
          : 'No posts yet. Be the first to post!'}
      </Text>
    </View>
  );

  const listFooter = isFetchingNextPage ? (
    <View style={styles.loadMoreRow}>
      <ActivityIndicator color={Colors.lime} />
    </View>
  ) : null;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>Social</Text>
        <TouchableOpacity style={styles.composeBtn} onPress={() => setShowCompose(true)}>
          <Ionicons name="create-outline" size={22} color={Colors.lime} />
        </TouchableOpacity>
      </View>

      {/* Feed */}
      <FlatList<SocialPost>
        data={posts}
        keyExtractor={p => p.id}
        contentContainerStyle={[styles.feed, { paddingBottom: 120 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.lime} />
        }
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        ListFooterComponent={listFooter}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
        renderItem={({ item: post }) => {
          const effectiveLiked = post.id in optimisticLikes
            ? optimisticLikes[post.id]
            : post.likedByMe;
          return (
            <PostCard
              post={{ ...post, likedByMe: effectiveLiked }}
              currentUserId={user?.id}
              onLike={handleLike}
              onComment={p => router.push(`/post/${p.id}` as any)}
              onDelete={handleDeletePost}
              onAuthorPress={userId => router.push(`/profile/${userId}` as any)}
              onFollow={handleFollow}
              showFollow={tab === 'discover'}
            />
          );
        }}
      />

      {/* Compose modal */}
      <ComposeModal
        visible={showCompose}
        onClose={() => setShowCompose(false)}
        onPosted={() => {
          setShowCompose(false);
          queryClient.invalidateQueries({ queryKey: ['feed', tab] });
        }}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },

  screenHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.cardBorder,
  },
  screenTitle: { color: Colors.textPrimary, fontSize: 20, fontWeight: '900' },
  composeBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.limeDim, alignItems: 'center', justifyContent: 'center',
  },

  tabToggleRow: { paddingHorizontal: Spacing.md, paddingVertical: 12 },
  tabToggle: {
    flexDirection: 'row', backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.pill, padding: 3,
    borderWidth: 1, borderColor: Colors.cardBorder,
    alignSelf: 'stretch',
  },
  tabToggleBtn:         { flex: 1, paddingVertical: 8, borderRadius: Radius.pill, alignItems: 'center' },
  tabToggleBtnActive:   { backgroundColor: Colors.limeDim, borderWidth: 1, borderColor: Colors.lime + '50' },
  tabToggleLabel:       { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
  tabToggleLabelActive: { color: Colors.lime },

  feed: { paddingHorizontal: Spacing.md },

  emptyState: {
    alignItems: 'center', paddingTop: 60, gap: 10, paddingBottom: 40,
  },
  emptyText: { color: Colors.textSecondary, fontSize: 16, fontWeight: '600' },
  emptySub: {
    color: Colors.textMuted, fontSize: 13, textAlign: 'center', paddingHorizontal: 40,
  },

  loadMoreRow: { paddingVertical: 20, alignItems: 'center' },
});
