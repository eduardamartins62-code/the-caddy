import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Alert, Modal, RefreshControl, ActivityIndicator,
  Image, Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { historyApi, usersApi } from '../../services/api';
import AvatarRing from '../../components/ui/AvatarRing';
import GlassCard from '../../components/ui/GlassCard';
import SkeletonLoader from '../../components/ui/SkeletonLoader';
import { Colors, Radius, Spacing } from '../../constants/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

interface HistoryEntry {
  id: string;
  title: string;
  year: number;
  description?: string;
  winner?: string;
  winnerUser?: { id: string; name: string; avatar?: string | null };
  photos?: string[];
  champion?: string;
  recap?: string;
}

interface HistoryFormState {
  title: string;
  year: string;
  description: string;
  winner: string;
  winnerUserId: string;
}

const INITIAL_FORM: HistoryFormState = {
  title: '',
  year: new Date().getFullYear().toString(),
  description: '',
  winner: '',
  winnerUserId: '',
};

// ─── History entry card ───────────────────────────────────────────────────────

function HistoryCard({
  entry,
  onPress,
  onLongPress,
}: {
  entry: HistoryEntry;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const winnerName = entry.winner ?? entry.winnerUser?.name ?? entry.champion ?? 'Unknown';
  const desc = entry.description ?? entry.recap ?? '';
  const photoCount = entry.photos?.length ?? 0;

  return (
    <Pressable
      style={({ pressed }) => [cardStyles.card, pressed && { opacity: 0.85 }]}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      {/* Year badge */}
      <View style={cardStyles.yearBadge}>
        <Text style={cardStyles.yearText}>{entry.year}</Text>
      </View>

      <View style={cardStyles.body}>
        <Text style={cardStyles.title} numberOfLines={1}>{entry.title}</Text>

        <View style={cardStyles.winnerRow}>
          <Ionicons name="trophy" size={13} color={Colors.lime} />
          <Text style={cardStyles.winnerName} numberOfLines={1}>{winnerName}</Text>
        </View>

        {desc.length > 0 && (
          <Text style={cardStyles.desc} numberOfLines={2}>{desc}</Text>
        )}

        {photoCount > 0 && (
          <View style={cardStyles.photoCountRow}>
            <Ionicons name="images-outline" size={12} color={Colors.textMuted} />
            <Text style={cardStyles.photoCountText}>{photoCount} photo{photoCount !== 1 ? 's' : ''}</Text>
          </View>
        )}
      </View>

      <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
    </Pressable>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.bgSecondary, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.cardBorder,
    padding: 14, marginBottom: 10,
  },
  yearBadge: {
    backgroundColor: Colors.lime, borderRadius: Radius.sm,
    paddingHorizontal: 10, paddingVertical: 8, minWidth: 56, alignItems: 'center',
  },
  yearText:    { color: Colors.bg, fontSize: 18, fontWeight: '900' },
  body:        { flex: 1 },
  title:       { color: Colors.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 4 },
  winnerRow:   { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  winnerName:  { color: Colors.lime, fontSize: 13, fontWeight: '600' },
  desc:        { color: Colors.textSecondary, fontSize: 12, lineHeight: 17 },
  photoCountRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  photoCountText: { color: Colors.textMuted, fontSize: 11 },
});

// ─── Detail modal ─────────────────────────────────────────────────────────────

function DetailModal({
  entry,
  onClose,
  onEdit,
}: {
  entry: HistoryEntry | null;
  onClose: () => void;
  onEdit: (entry: HistoryEntry) => void;
}) {
  const insets = useSafeAreaInsets();
  if (!entry) return null;

  const winnerName = entry.winner ?? entry.winnerUser?.name ?? entry.champion ?? 'Unknown';
  const desc = entry.description ?? entry.recap ?? '';
  const photos = entry.photos ?? [];

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <View style={[detailStyles.sheet, { paddingTop: insets.top + 16 }]}>
        <View style={detailStyles.header}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={detailStyles.title}>{entry.title}</Text>
          <TouchableOpacity onPress={() => onEdit(entry)}>
            <Ionicons name="create-outline" size={22} color={Colors.lime} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
          {/* Year + winner */}
          <View style={detailStyles.metaRow}>
            <View style={detailStyles.yearChip}>
              <Text style={detailStyles.yearChipText}>{entry.year}</Text>
            </View>
            <View style={detailStyles.winnerBlock}>
              <Ionicons name="trophy" size={16} color={Colors.lime} />
              <Text style={detailStyles.winnerLabel}>Champion</Text>
              <Text style={detailStyles.winnerValue}>{winnerName}</Text>
            </View>
          </View>

          {/* Description */}
          {desc.length > 0 && (
            <>
              <Text style={detailStyles.sectionLabel}>RECAP</Text>
              <Text style={detailStyles.descText}>{desc}</Text>
            </>
          )}

          {/* Photos */}
          {photos.length > 0 && (
            <>
              <Text style={detailStyles.sectionLabel}>PHOTOS</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                {photos.map((uri, idx) => (
                  <Image
                    key={idx}
                    source={{ uri }}
                    style={detailStyles.photo}
                    resizeMode="cover"
                  />
                ))}
              </ScrollView>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const detailStyles = StyleSheet.create({
  sheet: {
    flex: 1, backgroundColor: Colors.bg, paddingHorizontal: Spacing.md,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 20,
  },
  title:    { color: Colors.textPrimary, fontSize: 18, fontWeight: '800', flex: 1, textAlign: 'center' },
  metaRow:  { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24 },
  yearChip: {
    backgroundColor: Colors.lime, borderRadius: Radius.md,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  yearChipText:  { color: Colors.bg, fontSize: 22, fontWeight: '900' },
  winnerBlock:   { flex: 1, gap: 2 },
  winnerLabel:   { color: Colors.textSecondary, fontSize: 11, letterSpacing: 0.5 },
  winnerValue:   { color: Colors.lime, fontSize: 16, fontWeight: '700' },
  sectionLabel:  { color: Colors.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8, marginTop: 20 },
  descText:      { color: Colors.textPrimary, fontSize: 14, lineHeight: 22 },
  photo:         { width: 200, height: 150, borderRadius: Radius.md },
});

// ─── History form modal ───────────────────────────────────────────────────────

function HistoryFormModal({
  visible,
  editEntry,
  onClose,
  onSaved,
}: {
  visible: boolean;
  editEntry: HistoryEntry | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<HistoryFormState>(INITIAL_FORM);
  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const searchTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const isEditing = !!editEntry;

  useEffect(() => {
    if (visible) {
      if (editEntry) {
        setForm({
          title: editEntry.title ?? '',
          year: editEntry.year?.toString() ?? new Date().getFullYear().toString(),
          description: editEntry.description ?? editEntry.recap ?? '',
          winner: editEntry.winner ?? editEntry.winnerUser?.name ?? editEntry.champion ?? '',
          winnerUserId: editEntry.winnerUser?.id ?? '',
        });
        setUserSearch(editEntry.winnerUser?.name ?? editEntry.winner ?? editEntry.champion ?? '');
      } else {
        setForm(INITIAL_FORM);
        setUserSearch('');
        setUserResults([]);
      }
    }
  }, [visible, editEntry]);

  // User search with debounce
  useEffect(() => {
    if (!userSearch.trim()) { setUserResults([]); return; }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await usersApi.list({ q: userSearch.trim() });
        setUserResults((results as any[]).slice(0, 5));
      } catch {
        setUserResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [userSearch]);

  async function handleSave() {
    if (!form.title.trim()) {
      Alert.alert('Error', 'Title is required.'); return;
    }
    if (!form.year || isNaN(parseInt(form.year, 10))) {
      Alert.alert('Error', 'Valid year is required.'); return;
    }
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      year: parseInt(form.year, 10),
      description: form.description.trim(),
      winner: form.winner.trim() || undefined,
      winnerUserId: form.winnerUserId || undefined,
      photos: [],
    };
    try {
      if (isEditing && editEntry) {
        await historyApi.update(editEntry.id, payload);
      } else {
        await historyApi.create(payload);
      }
      onSaved();
    } catch {
      Alert.alert('Error', `Failed to ${isEditing ? 'update' : 'create'} history entry.`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[formStyles.sheet, { paddingTop: insets.top + 16 }]}>
        {/* Header */}
        <View style={formStyles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={formStyles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={formStyles.title}>{isEditing ? 'Edit Entry' : 'New Entry'}</Text>
          <TouchableOpacity
            style={[formStyles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color={Colors.bg} size="small" />
              : <Text style={formStyles.saveBtnText}>{isEditing ? 'Save' : 'Add'}</Text>
            }
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={formStyles.fieldLabel}>Title *</Text>
          <TextInput
            style={formStyles.input}
            value={form.title}
            onChangeText={t => setForm(prev => ({ ...prev, title: t }))}
            placeholder="Masters 2024"
            placeholderTextColor={Colors.textMuted}
          />

          <Text style={formStyles.fieldLabel}>Year *</Text>
          <TextInput
            style={formStyles.input}
            value={form.year}
            onChangeText={t => setForm(prev => ({ ...prev, year: t }))}
            keyboardType="number-pad"
            maxLength={4}
            placeholder="2024"
            placeholderTextColor={Colors.textMuted}
          />

          <Text style={formStyles.fieldLabel}>Description</Text>
          <TextInput
            style={[formStyles.input, formStyles.textArea]}
            value={form.description}
            onChangeText={t => setForm(prev => ({ ...prev, description: t }))}
            placeholder="Tournament recap..."
            placeholderTextColor={Colors.textMuted}
            multiline
            textAlignVertical="top"
          />

          {/* Winner search */}
          <Text style={formStyles.fieldLabel}>Winner</Text>
          <View style={formStyles.searchRow}>
            <Ionicons name="search-outline" size={16} color={Colors.textSecondary} />
            <TextInput
              style={formStyles.searchInput}
              value={userSearch}
              onChangeText={t => {
                setUserSearch(t);
                setForm(prev => ({ ...prev, winner: t, winnerUserId: '' }));
              }}
              placeholder="Search player..."
              placeholderTextColor={Colors.textMuted}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {searching && <ActivityIndicator color={Colors.lime} size="small" />}
          </View>

          {/* Search results */}
          {userResults.length > 0 && (
            <View style={formStyles.searchResults}>
              {userResults.map(u => (
                <TouchableOpacity
                  key={u.id}
                  style={formStyles.searchResultRow}
                  onPress={() => {
                    setForm(prev => ({ ...prev, winner: u.name, winnerUserId: u.id }));
                    setUserSearch(u.name);
                    setUserResults([]);
                  }}
                >
                  <AvatarRing uri={u.avatar} name={u.name} size={28} ring="none" />
                  <View style={{ marginLeft: 10 }}>
                    <Text style={formStyles.resultName}>{u.name}</Text>
                    {u.username && <Text style={formStyles.resultUsername}>@{u.username}</Text>}
                  </View>
                  {form.winnerUserId === u.id && (
                    <Ionicons name="checkmark-circle" size={18} color={Colors.lime} style={{ marginLeft: 'auto' }} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const formStyles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: Colors.bg, paddingHorizontal: Spacing.md },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 24,
  },
  cancelText: { color: Colors.textSecondary, fontSize: 15 },
  title:      { color: Colors.textPrimary, fontSize: 16, fontWeight: '700' },
  saveBtn: {
    backgroundColor: Colors.lime, borderRadius: Radius.pill,
    paddingHorizontal: 18, paddingVertical: 8, minWidth: 60, alignItems: 'center',
  },
  saveBtnText: { color: Colors.bg, fontSize: 14, fontWeight: '700' },

  fieldLabel: { color: Colors.textPrimary, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  input: {
    backgroundColor: Colors.bgSecondary, borderWidth: 1.5, borderColor: Colors.cardBorder,
    borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 12,
    color: Colors.textPrimary, fontSize: 15, marginBottom: 16,
  },
  textArea: { minHeight: 100 },

  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.bgSecondary, borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: Colors.cardBorder,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 8,
  },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: 14 },

  searchResults: {
    backgroundColor: Colors.bgSecondary, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.cardBorder, marginBottom: 16, overflow: 'hidden',
  },
  searchResultRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.cardBorder,
  },
  resultName:     { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  resultUsername: { color: Colors.textSecondary, fontSize: 12 },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function AdminHistoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [refreshing, setRefreshing] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editEntry, setEditEntry] = useState<HistoryEntry | null>(null);

  // ── Data ──────────────────────────────────────────────────────────────────

  const { data: entries = [], isLoading, error, refetch } = useQuery<HistoryEntry[]>({
    queryKey: ['history-admin'],
    queryFn: () => historyApi.list() as unknown as Promise<HistoryEntry[]>,
  });

  const sortedEntries = [...entries].sort((a, b) => b.year - a.year);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // ── Delete ────────────────────────────────────────────────────────────────

  function handleDelete(entry: HistoryEntry) {
    Alert.alert(
      'Delete Entry',
      `Delete "${entry.title}" (${entry.year})? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // historyApi.delete not yet defined — placeholder
              Alert.alert('Info', 'Delete not yet available via API.');
            } catch {
              Alert.alert('Error', 'Failed to delete entry.');
            }
          },
        },
      ]
    );
  }

  function openEdit(entry: HistoryEntry) {
    setSelectedEntry(null);
    setEditEntry(entry);
    setShowForm(true);
  }

  function openLongPress(entry: HistoryEntry) {
    Alert.alert(entry.title, `Year: ${entry.year}`, [
      { text: 'Edit', onPress: () => openEdit(entry) },
      { text: 'Delete', style: 'destructive', onPress: () => handleDelete(entry) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function handleFormSaved() {
    setShowForm(false);
    setEditEntry(null);
    queryClient.invalidateQueries({ queryKey: ['history-admin'] });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Tournament History</Text>
        <TouchableOpacity
          style={styles.fabBtn}
          onPress={() => { setEditEntry(null); setShowForm(true); }}
        >
          <Ionicons name="add" size={20} color={Colors.bg} />
        </TouchableOpacity>
      </View>

      {/* Error */}
      {error && (
        <GlassCard style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={20} color={Colors.error} />
          <Text style={styles.errorText}>Failed to load history.</Text>
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
        {isLoading ? (
          <>
            {[1, 2, 3].map(i => (
              <View key={i} style={{ flexDirection: 'row', gap: 14, marginBottom: 10 }}>
                <SkeletonLoader width={56} height={56} borderRadius={Radius.sm} />
                <View style={{ flex: 1, gap: 8 }}>
                  <SkeletonLoader height={14} width="60%" />
                  <SkeletonLoader height={11} width="40%" />
                  <SkeletonLoader height={11} width="80%" />
                </View>
              </View>
            ))}
          </>
        ) : sortedEntries.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="time-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No history yet</Text>
            <Text style={styles.emptySub}>Tap + to add the first tournament entry.</Text>
          </View>
        ) : (
          sortedEntries.map(entry => (
            <HistoryCard
              key={entry.id}
              entry={entry}
              onPress={() => setSelectedEntry(entry)}
              onLongPress={() => openLongPress(entry)}
            />
          ))
        )}
      </ScrollView>

      {/* Detail modal */}
      {selectedEntry && (
        <DetailModal
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
          onEdit={openEdit}
        />
      )}

      {/* Form modal */}
      <HistoryFormModal
        visible={showForm}
        editEntry={editEntry}
        onClose={() => { setShowForm(false); setEditEntry(null); }}
        onSaved={handleFormSaved}
      />
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
  fabBtn: {
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

  content: { paddingHorizontal: Spacing.md, paddingBottom: 120, paddingTop: 12 },

  emptyState: {
    alignItems: 'center', paddingTop: 60, gap: 10,
  },
  emptyText: { color: Colors.textSecondary, fontSize: 15, fontWeight: '600' },
  emptySub:  { color: Colors.textMuted, fontSize: 13, textAlign: 'center', paddingHorizontal: 40 },
});
