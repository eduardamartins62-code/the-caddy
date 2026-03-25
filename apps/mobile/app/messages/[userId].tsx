import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { messagesApi, usersApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import AvatarRing from '../../components/ui/AvatarRing';
import SkeletonLoader from '../../components/ui/SkeletonLoader';
import { Colors, Radius, Spacing } from '../../constants/theme';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeLabel(date: string): string {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function dateSeparator(date: string): string {
  const d = new Date(date);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function needsDateSeparator(current: any, previous: any): boolean {
  if (!previous) return true;
  return new Date(current.createdAt).toDateString() !== new Date(previous.createdAt).toDateString();
}

function needsTimestamp(current: any, previous: any): boolean {
  if (!previous) return false;
  return new Date(current.createdAt).getTime() - new Date(previous.createdAt).getTime() > 5 * 60 * 1000;
}

// ─── Message bubble ───────────────────────────────────────────────────────────

interface MessageBubbleProps {
  msg: any;
  prevMsg: any | null;
  meId: string;
  otherAvatar?: string | null;
  otherName?: string;
}

function MessageBubble({ msg, prevMsg, meId, otherAvatar, otherName }: MessageBubbleProps) {
  const isMe = msg.senderId === meId || msg.sender?.id === meId;
  const showDate = needsDateSeparator(msg, prevMsg);
  const showTime = needsTimestamp(msg, prevMsg);

  // Group bubbles: don't show avatar if previous message is from same sender within 5 min
  const sameGroupAsPrev =
    prevMsg &&
    !showDate &&
    !showTime &&
    (prevMsg.senderId === msg.senderId || prevMsg.sender?.id === msg.sender?.id);

  return (
    <>
      {showDate && (
        <View style={styles.dateSep}>
          <View style={styles.dateSepLine} />
          <Text style={styles.dateSepText}>{dateSeparator(msg.createdAt)}</Text>
          <View style={styles.dateSepLine} />
        </View>
      )}
      {showTime && !showDate && (
        <Text style={styles.timeLabel}>{timeLabel(msg.createdAt)}</Text>
      )}
      <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
        {/* Avatar placeholder to maintain alignment */}
        {!isMe && (
          <View style={styles.avatarSlot}>
            {!sameGroupAsPrev && (
              <AvatarRing
                uri={msg.sender?.avatar ?? otherAvatar}
                name={msg.sender?.name ?? otherName ?? '?'}
                size={28}
                ring="none"
              />
            )}
          </View>
        )}
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
          <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>
            {msg.content}
          </Text>
          <Text style={[styles.bubbleTime, isMe && styles.bubbleTimeMe]}>
            {timeLabel(msg.createdAt)}
          </Text>
        </View>
      </View>
    </>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function ChatSkeleton() {
  return (
    <View style={styles.skeletonWrap}>
      {/* them */}
      <View style={[styles.skeletonRow, { justifyContent: 'flex-start' }]}>
        <SkeletonLoader width={28} height={28} borderRadius={14} />
        <SkeletonLoader width={180} height={38} borderRadius={Radius.lg} />
      </View>
      {/* me */}
      <View style={[styles.skeletonRow, { justifyContent: 'flex-end' }]}>
        <SkeletonLoader width={140} height={38} borderRadius={Radius.lg} />
      </View>
      {/* them */}
      <View style={[styles.skeletonRow, { justifyContent: 'flex-start' }]}>
        <SkeletonLoader width={28} height={28} borderRadius={14} />
        <SkeletonLoader width={220} height={56} borderRadius={Radius.lg} />
      </View>
      {/* me */}
      <View style={[styles.skeletonRow, { justifyContent: 'flex-end' }]}>
        <SkeletonLoader width={100} height={38} borderRadius={Radius.lg} />
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user: me } = useAuth();
  const qc = useQueryClient();

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [localMessages, setLocalMessages] = useState<any[]>([]);
  const flatRef = useRef<FlatList>(null);

  // Fetch messages
  const {
    data: serverMessages,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['conversation', userId],
    queryFn: () => messagesApi.getConversation(userId),
    enabled: !!userId,
  });

  // Fetch other user's profile for header
  const { data: otherUser } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => usersApi.getUser(userId),
    enabled: !!userId,
  });

  // Mark read on mount
  useEffect(() => {
    if (userId) {
      messagesApi.markRead(userId).catch(() => {});
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['unreadCount'] });
    }
  }, [userId]);

  // Sync server messages into local state
  useEffect(() => {
    if (serverMessages) {
      setLocalMessages(serverMessages as any[]);
    }
  }, [serverMessages]);

  // TODO: Socket.io integration
  // useEffect(() => {
  //   const socket = getSocket(); // from services/socket.ts
  //   socket.on('message:new', (msg: any) => {
  //     if (msg.senderId === userId || msg.receiverId === userId) {
  //       setLocalMessages(prev => [...prev, msg]);
  //       messagesApi.markRead(userId).catch(() => {});
  //     }
  //   });
  //   return () => { socket.off('message:new'); };
  // }, [userId]);

  const messages: any[] = localMessages;

  const send = useCallback(async () => {
    const content = text.trim();
    if (!content || sending || !me) return;
    setSending(true);
    setText('');

    // Optimistic message
    const optimistic = {
      id: `optimistic-${Date.now()}`,
      senderId: me.id,
      receiverId: userId,
      content,
      createdAt: new Date().toISOString(),
      isOptimistic: true,
    };
    setLocalMessages(prev => [...prev, optimistic]);

    try {
      const sent = await messagesApi.send(userId, content);
      setLocalMessages(prev =>
        prev.map(m => m.id === optimistic.id ? { ...sent, isOptimistic: false } : m)
      );
      qc.invalidateQueries({ queryKey: ['conversations'] });
    } catch {
      // Remove optimistic on failure
      setLocalMessages(prev => prev.filter(m => m.id !== optimistic.id));
      setText(content);
    } finally {
      setSending(false);
    }
  }, [text, sending, me, userId, qc]);

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>

        {otherUser ? (
          <TouchableOpacity
            style={styles.headerUser}
            onPress={() => router.push(`/profile/${(otherUser as any).id}` as any)}
            activeOpacity={0.7}
          >
            <AvatarRing
              uri={(otherUser as any).avatar}
              name={(otherUser as any).name}
              size={34}
              ring="lime"
            />
            <View>
              <Text style={styles.headerName}>{(otherUser as any).name}</Text>
              {(otherUser as any).username && (
                <Text style={styles.headerUsername}>@{(otherUser as any).username}</Text>
              )}
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerUser}>
            <SkeletonLoader width={34} height={34} borderRadius={17} />
            <SkeletonLoader width={100} height={14} />
          </View>
        )}

        <View style={{ width: 36 }} />
      </View>

      {/* Messages */}
      {isLoading ? (
        <ChatSkeleton />
      ) : isError ? (
        <View style={styles.errorState}>
          <Ionicons name="alert-circle-outline" size={40} color={Colors.error} />
          <Text style={styles.errorText}>Couldn't load messages</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={(item, index) => item.id ?? String(index)}
          renderItem={({ item, index }) => (
            <MessageBubble
              msg={item}
              prevMsg={index > 0 ? messages[index - 1] : null}
              meId={me?.id ?? ''}
              otherAvatar={(otherUser as any)?.avatar}
              otherName={(otherUser as any)?.name}
            />
          )}
          inverted={false}
          contentContainerStyle={[
            styles.messageContent,
            { paddingBottom: insets.bottom + 8 },
            messages.length === 0 && styles.messageContentEmpty,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() =>
            flatRef.current?.scrollToEnd({ animated: true })
          }
          ListEmptyComponent={
            otherUser ? (
              <View style={styles.emptyState}>
                <AvatarRing
                  uri={(otherUser as any).avatar}
                  name={(otherUser as any).name ?? '?'}
                  size={64}
                  ring="lime"
                />
                <Text style={styles.emptyName}>{(otherUser as any).name}</Text>
                <Text style={styles.emptyText}>
                  Say hello to {(otherUser as any).name?.split(' ')[0] ?? 'them'} to start the conversation.
                </Text>
              </View>
            ) : null
          }
        />
      )}

      {/* Input bar */}
      <View style={[styles.inputBar, { paddingBottom: insets.bottom + 6 }]}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Message..."
          placeholderTextColor={Colors.textMuted}
          multiline
          maxLength={1000}
          returnKeyType="default"
        />
        <TouchableOpacity
          style={[
            styles.sendBtn,
            (!text.trim() || sending) && styles.sendBtnDisabled,
          ]}
          onPress={send}
          disabled={!text.trim() || sending}
          activeOpacity={0.8}
        >
          {sending ? (
            <ActivityIndicator size="small" color={Colors.bg} />
          ) : (
            <Ionicons
              name="send"
              size={18}
              color={text.trim() && !sending ? Colors.bg : Colors.textMuted}
            />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.bgSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerUser: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerName: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  headerUsername: { color: Colors.textMuted, fontSize: 12, marginTop: 1 },

  skeletonWrap: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingTop: 16,
    gap: 12,
  },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },

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

  messageContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: 12,
    gap: 2,
  },
  messageContentEmpty: { flexGrow: 1 },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingBottom: 60,
  },
  emptyName: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700' },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 260,
  },

  dateSep: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    gap: 8,
  },
  dateSepLine: { flex: 1, height: 1, backgroundColor: Colors.cardBorder },
  dateSepText: { color: Colors.textMuted, fontSize: 11, fontWeight: '600' },

  timeLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
    marginVertical: 6,
    fontWeight: '500',
  },

  msgRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    marginBottom: 2,
  },
  msgRowMe: { flexDirection: 'row-reverse' },

  avatarSlot: { width: 28, alignItems: 'center', justifyContent: 'flex-end' },

  bubble: {
    maxWidth: '75%',
    paddingHorizontal: 13,
    paddingTop: 9,
    paddingBottom: 6,
    borderRadius: Radius.lg,
  },
  bubbleThem: {
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderBottomLeftRadius: 4,
  },
  bubbleMe: {
    backgroundColor: Colors.lime,
    borderBottomRightRadius: 4,
  },
  bubbleText: { color: Colors.textPrimary, fontSize: 14, lineHeight: 20 },
  bubbleTextMe: { color: Colors.bg },
  bubbleTime: {
    color: Colors.textMuted,
    fontSize: 10,
    textAlign: 'right',
    marginTop: 3,
  },
  bubbleTimeMe: { color: 'rgba(10,10,15,0.55)' },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.md,
    paddingTop: 10,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
    backgroundColor: Colors.bg,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: Radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: Colors.textPrimary,
    fontSize: 14,
    maxHeight: 120,
    minHeight: 44,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: Colors.bgSecondary },
});
