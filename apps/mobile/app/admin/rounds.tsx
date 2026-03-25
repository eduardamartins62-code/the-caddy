import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Alert, Modal, RefreshControl, ActivityIndicator,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { eventsApi, roundsApi } from '../../services/api';
import GlassCard from '../../components/ui/GlassCard';
import SkeletonLoader from '../../components/ui/SkeletonLoader';
import { Colors, Radius, Spacing } from '../../constants/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

type RoundStatus = 'SCHEDULED' | 'LIVE' | 'COMPLETED';

interface Round {
  id: string;
  courseName?: string;
  date: string;
  status?: RoundStatus;
  playerCount?: number;
  players?: any[];
}

interface Event {
  id: string;
  name: string;
  isActive?: boolean;
  status?: string;
  rounds?: Round[];
}

// ─── Status helpers ───────────────────────────────────────────────────────────

function statusColor(status?: RoundStatus | string): string {
  switch (status) {
    case 'LIVE': return Colors.lime;
    case 'COMPLETED': return Colors.success;
    default: return Colors.textSecondary;
  }
}

function statusLabel(status?: RoundStatus | string): string {
  switch (status) {
    case 'LIVE': return 'LIVE';
    case 'COMPLETED': return 'COMPLETE';
    default: return 'SCHEDULED';
  }
}

const DEFAULT_HOLES = Array.from({ length: 18 }, (_, i) => ({
  holeNumber: i + 1,
  par: [4, 5, 4, 3, 4, 3, 4, 5, 4, 4, 4, 3, 5, 4, 5, 3, 4, 4][i],
}));

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminRoundsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [expandedRounds, setExpandedRounds] = useState<Set<string>>(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Create form state
  const [formCourseName, setFormCourseName] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formFormat, setFormFormat] = useState('STROKE_PLAY');

  // ── Data fetching ─────────────────────────────────────────────────────────

  const { data: events = [], isLoading, error, refetch } = useQuery<Event[]>({
    queryKey: ['admin-events-rounds'],
    queryFn: () => eventsApi.list() as Promise<Event[]>,
    onSuccess: (data: Event[]) => {
      if (!selectedEventId && data.length > 0) {
        const active = data.find(e => e.isActive || e.status === 'ACTIVE') ?? data[0];
        setSelectedEventId(active.id);
      }
    },
  } as any);

  // Set default event on first load
  React.useEffect(() => {
    if (events.length > 0 && !selectedEventId) {
      const active = events.find(e => e.isActive || e.status === 'ACTIVE') ?? events[0];
      setSelectedEventId(active.id);
    }
  }, [events]);

  const selectedEvent = events.find(e => e.id === selectedEventId);
  const rounds: Round[] = (selectedEvent as any)?.rounds ?? [];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // ── Mutations ─────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (data: unknown) => roundsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-events-rounds'] });
      setShowCreate(false);
      setFormCourseName('');
      setFormDate(new Date().toISOString().split('T')[0]);
      Alert.alert('Success', 'Round created successfully.');
    },
    onError: (e: any) => {
      Alert.alert('Error', e?.message ?? 'Failed to create round.');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      roundsApi.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-events-rounds'] });
    },
    onError: () => Alert.alert('Error', 'Failed to update round status.'),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  function toggleExpand(id: string) {
    setExpandedRounds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleCreateRound() {
    if (!formCourseName.trim()) {
      Alert.alert('Error', 'Course name is required.'); return;
    }
    if (!selectedEventId) {
      Alert.alert('Error', 'Please select an event.'); return;
    }
    createMutation.mutate({
      eventId: selectedEventId,
      courseId: formCourseName.toLowerCase().replace(/\s+/g, '-'),
      courseName: formCourseName.trim(),
      date: new Date(formDate).toISOString(),
      format: formFormat,
      holes: DEFAULT_HOLES,
    });
  }

  function handleStatusChange(round: Round, status: RoundStatus) {
    Alert.alert(
      `Mark as ${statusLabel(status)}`,
      `Set "${round.courseName ?? 'Round'}" to ${statusLabel(status)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => updateStatusMutation.mutate({ id: round.id, status }),
        },
      ]
    );
  }

  function handleDelete(round: Round) {
    Alert.alert(
      'Delete Round',
      `Delete "${round.courseName ?? 'Round'}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // roundsApi.delete not defined yet — show placeholder
            Alert.alert('Info', 'Delete endpoint not yet available.');
          },
        },
      ]
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Manage Rounds</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowCreate(true)}
          disabled={createMutation.isPending}
        >
          <Ionicons name="add" size={20} color={Colors.bg} />
        </TouchableOpacity>
      </View>

      {/* Error state */}
      {error && (
        <GlassCard style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={20} color={Colors.error} />
          <Text style={styles.errorText}>Failed to load events.</Text>
          <TouchableOpacity onPress={() => refetch()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </GlassCard>
      )}

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.lime} />
        }
      >
        {/* Event selector */}
        <Text style={styles.sectionLabel}>SELECT EVENT</Text>
        {isLoading ? (
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
            {[1, 2, 3].map(i => (
              <SkeletonLoader key={i} width={100} height={34} borderRadius={Radius.pill} />
            ))}
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
            {events.map(e => (
              <TouchableOpacity
                key={e.id}
                style={[styles.chip, selectedEventId === e.id && styles.chipActive]}
                onPress={() => setSelectedEventId(e.id)}
              >
                <Text style={[styles.chipText, selectedEventId === e.id && styles.chipTextActive]}>
                  {e.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Rounds list */}
        <Text style={styles.sectionLabel}>
          ROUNDS {rounds.length > 0 ? `(${rounds.length})` : ''}
        </Text>

        {isLoading ? (
          <>
            {[1, 2].map(i => (
              <GlassCard key={i} style={{ marginBottom: 10 }}>
                <SkeletonLoader height={14} width="60%" />
                <SkeletonLoader height={11} width="40%" style={{ marginTop: 8 }} />
              </GlassCard>
            ))}
          </>
        ) : rounds.length === 0 ? (
          <GlassCard style={styles.emptyCard}>
            <Ionicons name="flag-outline" size={36} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No rounds yet</Text>
            <Text style={styles.emptySub}>Tap + to create the first round.</Text>
          </GlassCard>
        ) : (
          rounds.map(round => {
            const isExpanded = expandedRounds.has(round.id);
            const sc = statusColor(round.status);
            const sl = statusLabel(round.status);
            const playerCount = round.playerCount ?? round.players?.length ?? 0;

            return (
              <GlassCard key={round.id} style={styles.roundCard} padding={0}>
                {/* Round header row */}
                <Pressable
                  style={({ pressed }) => [styles.roundHeader, pressed && { opacity: 0.8 }]}
                  onPress={() => toggleExpand(round.id)}
                >
                  <View style={styles.roundHeaderLeft}>
                    <View style={[styles.statusDot, { backgroundColor: sc }]} />
                    <View>
                      <Text style={styles.roundName}>
                        {round.courseName ?? 'Unknown Course'}
                      </Text>
                      <Text style={styles.roundDate}>
                        {new Date(round.date).toLocaleDateString('en-US', {
                          weekday: 'short', month: 'short', day: 'numeric',
                        })}
                        {playerCount > 0 ? ` · ${playerCount} players` : ''}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.roundHeaderRight}>
                    <View style={[styles.statusPill, { backgroundColor: sc + '22', borderColor: sc + '44' }]}>
                      <Text style={[styles.statusText, { color: sc }]}>{sl}</Text>
                    </View>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={Colors.textSecondary}
                    />
                  </View>
                </Pressable>

                {/* Expanded actions */}
                {isExpanded && (
                  <View style={styles.roundActions}>
                    {round.status !== 'LIVE' && (
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: Colors.lime + '22', borderColor: Colors.lime + '44' }]}
                        onPress={() => handleStatusChange(round, 'LIVE')}
                        disabled={updateStatusMutation.isPending}
                      >
                        <Ionicons name="radio-outline" size={14} color={Colors.lime} />
                        <Text style={[styles.actionBtnText, { color: Colors.lime }]}>Mark Live</Text>
                      </TouchableOpacity>
                    )}
                    {round.status !== 'COMPLETED' && (
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: Colors.success + '22', borderColor: Colors.success + '44' }]}
                        onPress={() => handleStatusChange(round, 'COMPLETED')}
                        disabled={updateStatusMutation.isPending}
                      >
                        <Ionicons name="checkmark-circle-outline" size={14} color={Colors.success} />
                        <Text style={[styles.actionBtnText, { color: Colors.success }]}>Mark Complete</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: Colors.error + '11', borderColor: Colors.error + '33' }]}
                      onPress={() => handleDelete(round)}
                    >
                      <Ionicons name="trash-outline" size={14} color={Colors.error} />
                      <Text style={[styles.actionBtnText, { color: Colors.error }]}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </GlassCard>
            );
          })
        )}
      </ScrollView>

      {/* Create Round Modal */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modal, { paddingTop: insets.top + 16 }]}>
          {/* Modal header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCreate(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>New Round</Text>
            <TouchableOpacity
              style={[styles.createBtn, createMutation.isPending && { opacity: 0.6 }]}
              onPress={handleCreateRound}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <ActivityIndicator color={Colors.bg} size="small" />
              ) : (
                <Text style={styles.createBtnText}>Create</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Event selector in modal */}
            <Text style={styles.fieldLabel}>Event *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
              {events.map(e => (
                <TouchableOpacity
                  key={e.id}
                  style={[styles.chip, selectedEventId === e.id && styles.chipActive]}
                  onPress={() => setSelectedEventId(e.id)}
                >
                  <Text style={[styles.chipText, selectedEventId === e.id && styles.chipTextActive]}>
                    {e.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.fieldLabel}>Course Name *</Text>
            <TextInput
              style={styles.input}
              value={formCourseName}
              onChangeText={setFormCourseName}
              placeholder="Augusta National"
              placeholderTextColor={Colors.textMuted}
            />

            <Text style={styles.fieldLabel}>Date *</Text>
            <TextInput
              style={styles.input}
              value={formDate}
              onChangeText={setFormDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.textMuted}
              keyboardType="numbers-and-punctuation"
            />

            <Text style={styles.fieldLabel}>Format</Text>
            <View style={styles.formatRow}>
              {['STROKE_PLAY', 'MATCH_PLAY', 'STABLEFORD'].map(fmt => (
                <TouchableOpacity
                  key={fmt}
                  style={[styles.formatChip, formFormat === fmt && styles.formatChipActive]}
                  onPress={() => setFormFormat(fmt)}
                >
                  <Text style={[styles.formatChipText, formFormat === fmt && styles.formatChipTextActive]}>
                    {fmt.replace('_', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.hintText}>
              Round will be created with standard 18-hole par layout.
            </Text>
          </ScrollView>
        </View>
      </Modal>
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
  addBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.lime, alignItems: 'center', justifyContent: 'center',
  },

  errorCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    margin: Spacing.md,
    backgroundColor: Colors.error + '11', borderColor: Colors.error + '33',
  },
  errorText: { flex: 1, color: Colors.error, fontSize: 13 },
  retryText:  { color: Colors.lime, fontSize: 13, fontWeight: '700' },

  content: { paddingHorizontal: Spacing.md, paddingBottom: 120 },

  sectionLabel: {
    color: Colors.textSecondary, fontSize: 11, fontWeight: '700',
    letterSpacing: 1, marginBottom: 10, marginTop: 16,
  },

  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: Radius.pill, borderWidth: 1.5, borderColor: Colors.cardBorder,
    backgroundColor: Colors.bgSecondary, marginRight: 8,
  },
  chipActive:     { backgroundColor: Colors.lime + '22', borderColor: Colors.lime + '66' },
  chipText:       { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: Colors.lime },

  emptyCard: {
    alignItems: 'center', gap: 8, paddingVertical: 32,
  },
  emptyText: { color: Colors.textSecondary, fontSize: 15, fontWeight: '600' },
  emptySub:  { color: Colors.textMuted, fontSize: 12 },

  // Round card
  roundCard: { marginBottom: 10, overflow: 'hidden' },

  roundHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  roundHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  roundHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  statusDot: { width: 8, height: 8, borderRadius: 4 },
  roundName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  roundDate: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },

  statusPill: {
    borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1,
  },
  statusText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

  roundActions: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    paddingHorizontal: 16, paddingBottom: 14,
    borderTopWidth: 1, borderTopColor: Colors.cardBorder,
    paddingTop: 10,
  },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.pill,
    borderWidth: 1,
  },
  actionBtnText: { fontSize: 12, fontWeight: '600' },

  // Modal
  modal: {
    flex: 1, backgroundColor: Colors.bg, paddingHorizontal: Spacing.md,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 24,
  },
  cancelText: { color: Colors.textSecondary, fontSize: 15 },
  modalTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700' },
  createBtn: {
    backgroundColor: Colors.lime, borderRadius: Radius.pill,
    paddingHorizontal: 18, paddingVertical: 8,
    minWidth: 64, alignItems: 'center',
  },
  createBtnText: { color: Colors.bg, fontSize: 14, fontWeight: '700' },

  fieldLabel: {
    color: Colors.textPrimary, fontSize: 13, fontWeight: '600', marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.bgSecondary, borderWidth: 1.5, borderColor: Colors.cardBorder,
    borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 12,
    color: Colors.textPrimary, fontSize: 15, marginBottom: 16,
  },

  formatRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  formatChip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: Radius.pill, borderWidth: 1.5, borderColor: Colors.cardBorder,
    backgroundColor: Colors.bgSecondary,
  },
  formatChipActive:     { backgroundColor: Colors.lime + '22', borderColor: Colors.lime + '66' },
  formatChipText:       { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  formatChipTextActive: { color: Colors.lime },

  hintText: { color: Colors.textMuted, fontSize: 12, marginTop: 4, lineHeight: 18 },
});
