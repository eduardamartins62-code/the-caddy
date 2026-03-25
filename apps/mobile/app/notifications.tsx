import React, { useEffect, useRef } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications } from '../hooks/useQueries';
import { notificationsApi } from '../services/api';
import SkeletonLoader from '../components/ui/SkeletonLoader';
import { Colors, Radius, Spacing } from '../constants/theme';

// ─── Notification type map ────────────────────────────────────────────────────

const TYPE_META: Record<string, { icon: string; color: string }> = {
  follow:       { icon: 'person-add',       color: Colors.purple },
  like:         { icon: 'heart',             color: '#EF4444'     },
  comment:      { icon: 'chatbubble',        color: '#3B82F6'     },
  event_invite: { icon: 'calendar',          color: Colors.lime   },
  FOLLOW:       { icon: 'person-add',        color: Colors.purple },
  LIKE:         { icon: 'heart',             color: '#EF4444'     },
  INVITE:       { icon: 'calendar',          color: '#3B82F6'     },
  ROUND_STARTING: { icon: 'timer-outline',   color: Colors.lime   },
  LEADERBOARD:  { icon: 'trending-up',       color: Colors.lime   },
  SCORE_ENTERED:{ icon: 'trophy',            color: Colors.purple },
  RECAP:        { icon: 'document-text',     color: '#F97316'     },
};

// ─── Route resolution ─────────────────────────────────────────────────────────

function resolveRoute(n: any): string | null {
  const type = (n.type ?? '').toLowerCase();
  const data = n.data ?? {};
  if (type === 'follow')       return `/profile/${data.userId ?? data.actorId}`;
  if (type === 'like')         return data.postId ? `/post/${data.postId}` : null;
  if (type === 'comment')      return data.postId ? `/post/${data.postId}` : null;
  if (type === 'event_invite') return data.eventId ? `/event/${data.eventId}` : null;
  if (type === 'invite')       return data.eventId ? `/event/${data.eventId}` : null;
  if (type === 'round_starting') return data.eventId ? `/event/${data.eventId}` : null;
  if (type === 'leaderboard')  return data.eventId ? `/event/${data.eventId}` : null;
  if (type === 'score_entered')return data.roundId ? `/round/${data.roundId}` : null;
  return null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function NotificationSkeleton() {
  return (
    <View style={styles.skeletonRow}>
      <SkeletonLoader width={44} height={44} borderRadius={22} />
      <View style={{ flex: 1, gap: 8 }}>
        <SkeletonLoader height={13} width="70%" />
        <SkeletonLoader height={12} width="50%" />
      </View>
    </View>
  );
}

// ─── Notification row ─────────────────────────────────────────────────────────

interface NotificationRowProps {
  item: any;
  onPress: () => void;
  onDelete: () => void;
}

function NotificationRow({ item, onPress, onDelete }: NotificationRowProps) {
  const swipeRef = useRef<Swipeable>(null);
  const meta = TYPE_META[item.type] ?? { icon: 'notifications-outline', color: Colors.textMuted };

  const renderRightActions = () => (
    <TouchableOpacity
      style={styles.deleteAction}
      onPress={() => {
        swipeRef.current?.close();
        onDelete();
      }}
      activeOpacity={0.8}
    >
      <Ionicons name="trash-outline" size={22} color="#fff" />
    </TouchableOpacity>
  );

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={renderRightActions}
      rightThreshold={60}
      overshootRight={false}
    >
      <TouchableOpacity
        style={[styles.notifCard, !item.isRead && styles.notifCardUnread]}
        activeOpacity={0.75}
        onPress={onPress}
      >
        {!item.isRead && <View style={styles.unreadDot} />}

        <View style={[styles.iconBubble, { backgroundColor: meta.color + '22' }]}>
          <Ionicons name={meta.icon as any} size={20} color={meta.color} />
        </View>

        <View style={styles.notifBody}>
          <Text style={styles.notifTitle} numberOfLines={1}>
            {item.title ?? item.body ?? 'Notification'}
          </Text>
          {item.body && item.title && (
            <Text style={styles.notifMessage} numberOfLines={2}>
              {item.body}
            </Text>
          )}
          <Text style={styles.notifTime}>{timeAgo(item.createdAt)}</Text>
        </View>

        <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
      </TouchableOpacity>
    </Swipeable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { data, isLoading, isFetching, refetch } = useNotifications();

  const notifications: any[] = (data as any) ?? [];
  const unreadCount = notifications.filter(n => !n.isRead).length;

  // Mark all read on mount
  useEffect(() => {
    notificationsApi.readAll()
      .then(() => {
        qc.invalidateQueries({ queryKey: ['notifications'] });
        qc.invalidateQueries({ queryKey: ['unreadCount'] });
      })
      .catch(() => {});
  }, []);

  async function handleMarkAll() {
    try {
      await notificationsApi.readAll();
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['unreadCount'] });
    } catch {
      Alert.alert('Error', 'Could not mark notifications as read.');
    }
  }

  async function handleDelete(id: string) {
    try {
      await notificationsApi.delete(id);
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['unreadCount'] });
    } catch {
      Alert.alert('Error', 'Could not delete notification.');
    }
  }

  function handlePress(item: any) {
    const route = resolveRoute(item);
    if (route) router.push(route as any);
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity style={styles.markAllBtn} onPress={handleMarkAll} activeOpacity={0.7}>
            <Ionicons name="checkmark-done" size={15} color={Colors.lime} />
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
        {unreadCount === 0 && <View style={{ width: 36 }} />}
      </View>

      {/* Unread count banner */}
      {unreadCount > 0 && (
        <View style={styles.unreadBanner}>
          <Text style={styles.unreadBannerText}>
            {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
          </Text>
        </View>
      )}

      {/* Skeletons */}
      {isLoading && (
        <View style={styles.skeletonList}>
          <NotificationSkeleton />
          <NotificationSkeleton />
          <NotificationSkeleton />
        </View>
      )}

      {/* List */}
      {!isLoading && (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <NotificationRow
              item={item}
              onPress={() => handlePress(item)}
              onDelete={() => handleDelete(item.id)}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={refetch}
              tintColor={Colors.lime}
            />
          }
          contentContainerStyle={[
            styles.listContent,
            notifications.length === 0 && styles.listContentEmpty,
          ]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="checkmark-done-outline" size={32} color={Colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>You're all caught up!</Text>
              <Text style={styles.emptyText}>
                You'll see activity here when something happens.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.bgSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: Colors.limeDim,
    borderRadius: Radius.pill,
  },
  markAllText: { color: Colors.lime, fontSize: 11, fontWeight: '700' },

  unreadBanner: {
    marginHorizontal: Spacing.md,
    marginBottom: 8,
    backgroundColor: Colors.limeDim,
    borderRadius: Radius.md,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  unreadBannerText: { color: Colors.lime, fontSize: 12, fontWeight: '600' },

  skeletonList: {
    paddingHorizontal: Spacing.md,
    gap: 10,
    marginTop: 4,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },

  listContent: { paddingHorizontal: Spacing.md, paddingBottom: 120, paddingTop: 4, gap: 8 },
  listContentEmpty: { flexGrow: 1 },

  notifCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    position: 'relative',
  },
  notifCardUnread: {
    borderColor: Colors.lime + '33',
    backgroundColor: Colors.limeDim,
  },
  unreadDot: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.lime,
  },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  notifBody: { flex: 1 },
  notifTitle: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  notifMessage: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 4,
  },
  notifTime: { color: Colors.textMuted, fontSize: 11, fontWeight: '500' },

  deleteAction: {
    width: 70,
    backgroundColor: Colors.error,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    gap: 10,
    paddingBottom: 80,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700' },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
