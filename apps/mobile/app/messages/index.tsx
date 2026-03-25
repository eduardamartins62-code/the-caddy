import React from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useConversations } from '../../hooks/useQueries';
import AvatarRing from '../../components/ui/AvatarRing';
import SkeletonLoader from '../../components/ui/SkeletonLoader';
import { Colors, Radius, Spacing } from '../../constants/theme';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function ConversationSkeleton() {
  return (
    <View style={styles.skeletonRow}>
      <SkeletonLoader width={50} height={50} borderRadius={25} />
      <View style={{ flex: 1, gap: 8 }}>
        <SkeletonLoader height={13} width="55%" />
        <SkeletonLoader height={12} width="80%" />
      </View>
    </View>
  );
}

// ─── Conversation row ─────────────────────────────────────────────────────────

interface Conversation {
  userId: string;
  name: string;
  avatar?: string | null;
  lastMessage?: string | null;
  unreadCount: number;
  updatedAt: string;
}

function ConversationRow({ item, onPress }: { item: Conversation; onPress: () => void }) {
  const hasUnread = item.unreadCount > 0;
  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.72}
      onPress={onPress}
    >
      <AvatarRing
        uri={item.avatar}
        name={item.name ?? '?'}
        size={50}
        ring={hasUnread ? 'lime' : 'none'}
      />

      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={[styles.rowName, hasUnread && styles.rowNameUnread]} numberOfLines={1}>
            {item.name ?? 'Unknown'}
          </Text>
          <Text style={styles.rowTime}>{timeAgo(item.updatedAt)}</Text>
        </View>
        <Text
          style={[styles.rowPreview, hasUnread && styles.rowPreviewUnread]}
          numberOfLines={1}
        >
          {item.lastMessage ?? 'No messages yet'}
        </Text>
      </View>

      {hasUnread && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {item.unreadCount > 9 ? '9+' : item.unreadCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MessagesInbox() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, isLoading, isFetching, refetch } = useConversations();

  const conversations: Conversation[] = (data as any) ?? [];

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Messages</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Loading skeletons */}
      {isLoading && (
        <View style={styles.skeletonList}>
          <ConversationSkeleton />
          <ConversationSkeleton />
          <ConversationSkeleton />
        </View>
      )}

      {/* List */}
      {!isLoading && (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.userId}
          renderItem={({ item }) => (
            <ConversationRow
              item={item}
              onPress={() => router.push(`/messages/${item.userId}` as any)}
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
            conversations.length === 0 && styles.listContentEmpty,
          ]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="chatbubble-outline" size={32} color={Colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptyText}>
                Follow someone to start chatting.
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

  skeletonList: { paddingHorizontal: Spacing.md, gap: 0 },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },

  listContent: { paddingBottom: 120 },
  listContentEmpty: { flexGrow: 1 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  rowName: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  rowNameUnread: { fontWeight: '800' },
  rowTime: { color: Colors.textMuted, fontSize: 12, flexShrink: 0 },
  rowPreview: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  rowPreviewUnread: { color: Colors.textPrimary, fontWeight: '500' },

  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: Colors.bg, fontSize: 10, fontWeight: '800' },

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
