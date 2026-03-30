import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, KeyboardAvoidingView,
  Platform, Switch, Modal,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { eventsApi, usersApi } from '../../services/api';
import GlassCard from '../../components/ui/GlassCard';
import GradientButton from '../../components/ui/GradientButton';
import AvatarRing from '../../components/ui/AvatarRing';
import CourseSearchInput, { GolfCourse } from '../../components/ui/CourseSearchInput';
import { Colors, Radius, Spacing } from '../../constants/theme';

// ─── Constants ────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 4;

const EVENT_FORMATS = [
  { id: 'STROKE_PLAY',  label: 'Stroke Play',  sub: 'Total strokes, lowest wins',   icon: 'golf-outline' },
  { id: 'MATCH_PLAY',   label: 'Match Play',   sub: 'Hole-by-hole competition',      icon: 'flag-outline' },
  { id: 'STABLEFORD',  label: 'Stableford',   sub: 'Points-based scoring system',   icon: 'star-outline' },
];

const EVENT_TYPES = [
  { id: 'TOURNAMENT', label: 'Tournament', emoji: '🏆' },
  { id: 'CASUAL',     label: 'Casual Round', emoji: '⛳' },
  { id: 'WEEKEND',    label: 'Weekend Game', emoji: '🤝' },
  { id: 'SOLO',       label: 'Solo Round',   emoji: '🚶' },
] as const;

type EventTypeId = typeof EVENT_TYPES[number]['id'];

const RECURRENCE_OPTIONS = [
  { id: 'ANNUAL',           label: 'Yearly' },
  { id: 'SEMI_ANNUAL',      label: 'Semi-Yearly' },
  { id: 'MONTHLY',          label: 'Monthly' },
  { id: 'RECURRING_CUSTOM', label: 'Custom' },
] as const;

type RecurrenceId = typeof RECURRENCE_OPTIONS[number]['id'];

const PLAYER_ROLES = [
  { id: 'PLAYER',      label: 'Player' },
  { id: 'SCOREKEEPER', label: 'Scorekeeper' },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface SelectedPlayer {
  user: any;
  role: 'PLAYER' | 'SCOREKEEPER';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <View style={si.wrap}>
      {Array.from({ length: total }).map((_, i) => {
        const done    = i < current - 1;
        const active  = i === current - 1;
        return (
          <React.Fragment key={i}>
            <View style={[si.dot, done && si.dotDone, active && si.dotActive]}>
              {done
                ? <Ionicons name="checkmark" size={12} color={Colors.bg} />
                : <Text style={[si.dotNum, active && si.dotNumActive]}>{i + 1}</Text>
              }
            </View>
            {i < total - 1 && (
              <View style={[si.line, done && si.lineDone]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const si = StyleSheet.create({
  wrap:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
  dot:         { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.bgTertiary, borderWidth: 1.5, borderColor: Colors.cardBorder, alignItems: 'center', justifyContent: 'center' },
  dotActive:   { borderColor: Colors.lime, backgroundColor: Colors.limeDim },
  dotDone:     { backgroundColor: Colors.lime, borderColor: Colors.lime },
  dotNum:      { color: Colors.textMuted, fontSize: 12, fontWeight: '700' },
  dotNumActive:{ color: Colors.lime },
  line:        { flex: 1, height: 1.5, backgroundColor: Colors.cardBorder, marginHorizontal: 4 },
  lineDone:    { backgroundColor: Colors.lime },
});

function Label({ children, optional }: { children: string; optional?: boolean }) {
  return (
    <View style={lb.row}>
      <Text style={lb.text}>{children}</Text>
      {optional && <Text style={lb.opt}>(optional)</Text>}
    </View>
  );
}

const lb = StyleSheet.create({
  row:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, marginBottom: 10 },
  text: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  opt:  { color: Colors.textMuted, fontSize: 11 },
});

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function CreateEventScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ quickGame?: string }>();
  const isQuickGame = params.quickGame === 'true';

  const [step, setStep] = useState(1);
  const [creating, setCreating] = useState(false);

  // Step 1 - Basic Info
  const [name, setName]               = useState('');
  const [description, setDescription] = useState('');
  const [courseName, setCourseName]   = useState('');
  const [courseId, setCourseId]       = useState<string | null>(null);
  const [eventType, setEventType]     = useState<EventTypeId>(isQuickGame ? 'CASUAL' : 'TOURNAMENT');

  // Step 2 - Schedule
  const [startDate, setStartDate]         = useState<Date | null>(null);
  const [endDate, setEndDate]             = useState<Date | null>(null);
  const [format, setFormat]               = useState('STROKE_PLAY');
  const [isRecurring, setIsRecurring]     = useState(false);
  const [recurrence, setRecurrence]       = useState<RecurrenceId>('ANNUAL');
  const [recurrenceNote, setRecurrenceNote] = useState('');
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker]     = useState(false);

  function formatDateDisplay(d: Date | null) {
    if (!d) return '';
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  function formatDateISO(d: Date | null) {
    if (!d) return undefined;
    return d.toISOString();
  }

  // Step 3 - Players
  const [playerSearch, setPlayerSearch]     = useState('');
  const [searchResults, setSearchResults]   = useState<any[]>([]);
  const [searching, setSearching]           = useState(false);
  const [selectedPlayers, setSelectedPlayers] = useState<SelectedPlayer[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Effective total steps (skip step 3 for quick game) ──────────────────

  // We always render 4 steps but skip step 3 navigation when quickGame=true
  const effectiveTotalSteps = isQuickGame ? 3 : TOTAL_STEPS;

  // Map display step to actual step: when quickGame, step 3 in display = step 4 (review)
  function toActualStep(displayStep: number): number {
    if (isQuickGame && displayStep >= 3) return displayStep + 1;
    return displayStep;
  }

  // ─── Validation ─────────────────────────────────────────────────────────

  function validateStep() {
    if (step === 1) {
      if (!name.trim()) {
        Alert.alert('Required', 'Event name is required.');
        return false;
      }
    }
    if (step === 2) {
      if (!startDate) {
        Alert.alert('Required', 'Start date is required.');
        return false;
      }
    }
    return true;
  }

  function goNext() {
    if (!validateStep()) return;
    if (isQuickGame && step === 2) {
      // Skip player selection step — jump straight to review (step 4)
      setStep(4);
    } else {
      setStep((s) => Math.min(s + 1, TOTAL_STEPS));
    }
  }

  function goBack() {
    if (step === 1) {
      router.back();
    } else if (isQuickGame && step === 4) {
      // Go back to step 2, skipping player selection
      setStep(2);
    } else {
      setStep((s) => s - 1);
    }
  }

  // ─── Course selection ────────────────────────────────────────────────────

  function handleCourseSelect(course: GolfCourse) {
    setCourseName(course.name);
    setCourseId(course.id);
  }

  // ─── Player search ──────────────────────────────────────────────────────

  const handlePlayerSearch = useCallback((q: string) => {
    setPlayerSearch(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await usersApi.search(q.trim());
        setSearchResults(results || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
  }, []);

  function addPlayer(user: any) {
    if (selectedPlayers.some((p) => p.user.id === user.id)) return;
    setSelectedPlayers((prev) => [...prev, { user, role: 'PLAYER' }]);
    setPlayerSearch('');
    setSearchResults([]);
  }

  function removePlayer(userId: string) {
    setSelectedPlayers((prev) => prev.filter((p) => p.user.id !== userId));
  }

  function toggleRole(userId: string) {
    setSelectedPlayers((prev) =>
      prev.map((p) =>
        p.user.id === userId
          ? { ...p, role: p.role === 'PLAYER' ? 'SCOREKEEPER' : 'PLAYER' }
          : p
      )
    );
  }

  // ─── Submit ─────────────────────────────────────────────────────────────

  async function handleCreate() {
    if (!isQuickGame && selectedPlayers.length === 0) {
      const proceed = await new Promise<boolean>((resolve) =>
        Alert.alert(
          'No participants',
          'You haven\'t added any players. Create event anyway?',
          [
            { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
            { text: 'Create', onPress: () => resolve(true) },
          ]
        )
      );
      if (!proceed) return;
    }

    setCreating(true);
    try {
      const payload: any = {
        name: name.trim(),
        description: description.trim() || undefined,
        courseName: courseName.trim() || undefined,
        courseId: courseId || undefined,
        type: eventType,
        recurrence: isRecurring ? recurrence : 'ONE_TIME',
        recurrenceNote: isRecurring && recurrence === 'RECURRING_CUSTOM' ? recurrenceNote.trim() || undefined : undefined,
        startDate: formatDateISO(startDate),
        endDate:   formatDateISO(endDate),
        format,
        participants: selectedPlayers.map((p) => ({
          userId: p.user.id,
          role:   p.role,
        })),
      };

      await eventsApi.create(payload);

      Alert.alert('Event Created!', `${name} has been created.`, [
        { text: 'View Events', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to create event. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  // ─── Render steps ────────────────────────────────────────────────────────

  const renderStep1 = () => (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      keyboardVerticalOffset={80}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 120 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.stepHeading}>Basic Information</Text>
        <Text style={styles.stepSub}>Tell us about your event</Text>

        <Label>Event Name</Label>
        <TextInput
          style={[styles.input, !name.trim() && styles.inputRequired]}
          value={name}
          onChangeText={setName}
          placeholder="Masters Weekend 2026"
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="words"
          returnKeyType="next"
        />

        <Label optional>Description</Label>
        <TextInput
          style={[styles.input, styles.inputMulti]}
          value={description}
          onChangeText={setDescription}
          placeholder="Add a description for your event..."
          placeholderTextColor={Colors.textMuted}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        {/* Event Type chips */}
        <Label>Event Type</Label>
        <View style={styles.chipRow}>
          {EVENT_TYPES.map((et) => {
            const active = eventType === et.id;
            return (
              <TouchableOpacity
                key={et.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setEventType(et.id)}
                activeOpacity={0.75}
              >
                <Text style={styles.chipEmoji}>{et.emoji}</Text>
                <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                  {et.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Course search */}
        <Label optional>Golf Course</Label>
        <CourseSearchInput
          value={courseName}
          onSelect={handleCourseSelect}
          placeholder="Search for a golf course..."
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );

  const renderStep2 = () => (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      keyboardVerticalOffset={80}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 120 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.stepHeading}>Schedule & Format</Text>
      <Text style={styles.stepSub}>When is the event and how will it be scored?</Text>

      <Label>Start Date</Label>
      <TouchableOpacity style={styles.datePicker} onPress={() => setShowStartPicker(true)} activeOpacity={0.75}>
        <Ionicons name="calendar-outline" size={18} color={startDate ? Colors.lime : Colors.textMuted} />
        <Text style={[styles.datePickerText, !startDate && styles.datePickerPlaceholder]}>
          {startDate ? formatDateDisplay(startDate) : 'Select start date'}
        </Text>
        <Ionicons name="chevron-down-outline" size={16} color={Colors.textMuted} />
      </TouchableOpacity>

      {showStartPicker && (
        <DateTimePicker
          value={startDate || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          minimumDate={new Date()}
          onChange={(_e, date) => {
            setShowStartPicker(Platform.OS === 'ios');
            if (date) setStartDate(date);
          }}
          themeVariant="dark"
        />
      )}

      <Label optional>End Date</Label>
      <TouchableOpacity style={styles.datePicker} onPress={() => setShowEndPicker(true)} activeOpacity={0.75}>
        <Ionicons name="calendar-outline" size={18} color={endDate ? Colors.lime : Colors.textMuted} />
        <Text style={[styles.datePickerText, !endDate && styles.datePickerPlaceholder]}>
          {endDate ? formatDateDisplay(endDate) : 'Select end date (optional)'}
        </Text>
        {endDate
          ? <TouchableOpacity onPress={() => setEndDate(null)}><Ionicons name="close-circle" size={16} color={Colors.textMuted} /></TouchableOpacity>
          : <Ionicons name="chevron-down-outline" size={16} color={Colors.textMuted} />
        }
      </TouchableOpacity>

      {showEndPicker && (
        <DateTimePicker
          value={endDate || startDate || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          minimumDate={startDate || new Date()}
          onChange={(_e, date) => {
            setShowEndPicker(Platform.OS === 'ios');
            if (date) setEndDate(date);
          }}
          themeVariant="dark"
        />
      )}

      <Label>Scoring Format</Label>
      <View style={styles.formatGrid}>
        {EVENT_FORMATS.map((f) => {
          const active = format === f.id;
          return (
            <TouchableOpacity
              key={f.id}
              style={[styles.formatCard, active && styles.formatCardActive]}
              onPress={() => setFormat(f.id)}
              activeOpacity={0.75}
            >
              <Ionicons
                name={f.icon as any}
                size={22}
                color={active ? Colors.lime : Colors.textMuted}
              />
              <Text style={[styles.formatLabel, active && styles.formatLabelActive]}>
                {f.label}
              </Text>
              <Text style={styles.formatSub}>{f.sub}</Text>
              {active && (
                <View style={styles.formatCheck}>
                  <Ionicons name="checkmark-circle" size={16} color={Colors.lime} />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Recurring event toggle */}
      <View style={styles.recurringRow}>
        <View style={styles.recurringLabelWrap}>
          <Ionicons name="repeat-outline" size={18} color={Colors.textSecondary} />
          <Text style={styles.recurringLabel}>Recurring Event</Text>
        </View>
        <Switch
          value={isRecurring}
          onValueChange={setIsRecurring}
          trackColor={{ false: Colors.bgTertiary, true: Colors.limeDim }}
          thumbColor={isRecurring ? Colors.lime : Colors.textMuted}
          ios_backgroundColor={Colors.bgTertiary}
        />
      </View>

      {isRecurring && (
        <View style={styles.recurringOptions}>
          <Text style={styles.recurringFreqLabel}>Frequency</Text>
          <View style={styles.chipRow}>
            {RECURRENCE_OPTIONS.map((opt) => {
              const active = recurrence === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setRecurrence(opt.id)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {recurrence === 'RECURRING_CUSTOM' && (
            <>
              <Text style={styles.recurringFreqLabel}>Custom Recurrence Note</Text>
              <TextInput
                style={styles.input}
                value={recurrenceNote}
                onChangeText={setRecurrenceNote}
                placeholder="e.g. Every other month on Saturdays"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="sentences"
                returnKeyType="done"
              />
            </>
          )}
        </View>
      )}
      </ScrollView>
    </KeyboardAvoidingView>
  );

  const renderStep3 = () => (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      keyboardVerticalOffset={80}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 120 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.stepHeading}>Add Players</Text>
        <Text style={styles.stepSub}>Search and invite participants to your event</Text>

        {/* Search input */}
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={16} color={Colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={playerSearch}
            onChangeText={handlePlayerSearch}
            placeholder="Search by name or username..."
            placeholderTextColor={Colors.textMuted}
            returnKeyType="search"
            autoCapitalize="none"
          />
          {searching && <ActivityIndicator size="small" color={Colors.lime} style={{ marginRight: 10 }} />}
        </View>

        {/* Search results */}
        {searchResults.length > 0 && (
          <GlassCard style={styles.searchResults}>
            {searchResults.map((user: any) => {
              const alreadyAdded = selectedPlayers.some((p) => p.user.id === user.id);
              return (
                <TouchableOpacity
                  key={user.id}
                  style={styles.searchResultRow}
                  onPress={() => addPlayer(user)}
                  disabled={alreadyAdded}
                  activeOpacity={0.7}
                >
                  <AvatarRing uri={user.avatar} name={user.name} size={36} ring="none" />
                  <View style={styles.searchResultInfo}>
                    <Text style={styles.searchResultName}>{user.name}</Text>
                    {user.username && (
                      <Text style={styles.searchResultSub}>@{user.username}</Text>
                    )}
                  </View>
                  {alreadyAdded
                    ? <Ionicons name="checkmark-circle" size={20} color={Colors.lime} />
                    : <Ionicons name="add-circle-outline" size={20} color={Colors.textSecondary} />
                  }
                </TouchableOpacity>
              );
            })}
          </GlassCard>
        )}

        {playerSearch.trim().length > 0 && !searching && searchResults.length === 0 && (
          <Text style={styles.noResults}>No users found for "{playerSearch}"</Text>
        )}

        {/* Selected players */}
        {selectedPlayers.length > 0 && (
          <View style={styles.selectedSection}>
            <Text style={styles.selectedTitle}>
              Selected Players ({selectedPlayers.length})
            </Text>
            {selectedPlayers.map(({ user, role }) => (
              <GlassCard key={user.id} style={styles.selectedPlayerCard}>
                <View style={styles.selectedPlayerRow}>
                  <AvatarRing uri={user.avatar} name={user.name} size={38} ring={role === 'SCOREKEEPER' ? 'purple' : 'none'} />
                  <View style={styles.selectedPlayerInfo}>
                    <Text style={styles.selectedPlayerName}>{user.name}</Text>
                    {user.username && (
                      <Text style={styles.selectedPlayerSub}>@{user.username}</Text>
                    )}
                  </View>
                  {/* Role toggle */}
                  <TouchableOpacity
                    style={[styles.roleChip, role === 'SCOREKEEPER' && styles.roleChipActive]}
                    onPress={() => toggleRole(user.id)}
                  >
                    <Text style={[styles.roleChipText, role === 'SCOREKEEPER' && styles.roleChipTextActive]}>
                      {role === 'SCOREKEEPER' ? 'Scorekeeper' : 'Player'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => removePlayer(user.id)} style={styles.removeBtn}>
                    <Ionicons name="close-circle" size={20} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              </GlassCard>
            ))}
          </View>
        )}

        {selectedPlayers.length === 0 && (
          <View style={styles.noPlayersHint}>
            <Ionicons name="people-outline" size={36} color={Colors.textMuted} />
            <Text style={styles.noPlayersText}>No players added yet.</Text>
            <Text style={styles.noPlayersSubText}>You can still create the event and invite players later.</Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );

  const renderStep4 = () => {
    const selectedFormat = EVENT_FORMATS.find((f) => f.id === format);
    const selectedEventType = EVENT_TYPES.find((t) => t.id === eventType);
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={80}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: 120 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.stepHeading}>Review & Create</Text>
          <Text style={styles.stepSub}>Confirm your event details before creating</Text>

          {/* Summary card */}
          <GlassCard glow="lime" style={styles.summaryCard}>
            <Text style={styles.summaryEventName}>{name || 'Untitled Event'}</Text>
            {description ? (
              <Text style={styles.summaryDesc} numberOfLines={2}>{description}</Text>
            ) : null}

            <View style={styles.summaryDivider} />

            <SummaryRow icon="calendar-outline"    label="Start Date"  value={startDate ? formatDateDisplay(startDate) : '—'} />
            {endDate ? <SummaryRow icon="calendar-outline" label="End Date"    value={formatDateDisplay(endDate)} /> : null}
            <SummaryRow icon="location-outline"    label="Course"      value={courseName || '—'} />
            <SummaryRow icon="golf-outline"        label="Format"      value={selectedFormat?.label ?? format} />
            <SummaryRow icon="trophy-outline"      label="Type"        value={selectedEventType ? `${selectedEventType.emoji} ${selectedEventType.label}` : eventType} />
            <SummaryRow icon="repeat-outline"      label="Recurrence"  value={isRecurring ? (RECURRENCE_OPTIONS.find(r => r.id === recurrence)?.label ?? recurrence) : 'One-time'} />
            {!isQuickGame && (
              <SummaryRow icon="people-outline"    label="Players"     value={selectedPlayers.length > 0 ? `${selectedPlayers.length} invited` : 'None yet'} />
            )}
          </GlassCard>

          {/* Player list preview */}
          {!isQuickGame && selectedPlayers.length > 0 && (
            <GlassCard style={{ marginBottom: 16 }}>
              <Text style={styles.summarySubTitle}>Invited Players</Text>
              {selectedPlayers.map(({ user, role }) => (
                <View key={user.id} style={styles.summaryPlayerRow}>
                  <AvatarRing uri={user.avatar} name={user.name} size={32} ring="none" />
                  <Text style={styles.summaryPlayerName} numberOfLines={1}>{user.name}</Text>
                  <View style={[styles.roleChip, role === 'SCOREKEEPER' && styles.roleChipActive]}>
                    <Text style={[styles.roleChipText, role === 'SCOREKEEPER' && styles.roleChipTextActive]}>
                      {role}
                    </Text>
                  </View>
                </View>
              ))}
            </GlassCard>
          )}

          {/* Warning if no name */}
          {!name.trim() && (
            <View style={styles.warningBox}>
              <Ionicons name="warning-outline" size={16} color={Colors.warning} />
              <Text style={styles.warningText}>Event name is required to create.</Text>
            </View>
          )}

          <GradientButton
            label="Create Event"
            onPress={handleCreate}
            loading={creating}
            disabled={!name.trim() || creating}
            style={{ marginTop: 8 }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  };

  const renderCurrentStep = () => {
    switch (step) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      default: return null;
    }
  };

  // Compute display step number for the indicator (quickGame collapses step 3 out)
  const displayStep = isQuickGame && step === 4 ? 3 : step;

  // ─── Main render ────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={goBack}>
          <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isQuickGame ? 'Quick Game' : 'Create Event'}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Step indicator */}
      <StepIndicator current={displayStep} total={effectiveTotalSteps} />

      {/* Step content */}
      <View style={{ flex: 1 }}>
        {renderCurrentStep()}
      </View>

      {/* Footer nav */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        {step < TOTAL_STEPS && (
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={() => {
              if (isQuickGame && step === 2) {
                setStep(4);
              } else {
                setStep((s) => s + 1);
              }
            }}
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        )}
        {step < TOTAL_STEPS ? (
          <GradientButton
            label="Next"
            onPress={goNext}
            variant="lime"
            size="md"
            style={{ flex: 1, maxWidth: 200 }}
          />
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Summary row ──────────────────────────────────────────────────────────────

function SummaryRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={sr.row}>
      <Ionicons name={icon as any} size={14} color={Colors.lime} />
      <Text style={sr.label}>{label}</Text>
      <Text style={sr.value} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const sr = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  label: { color: Colors.textSecondary, fontSize: 13, width: 80, flexShrink: 0 },
  value: { color: Colors.textPrimary, fontSize: 13, flex: 1 },
});

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.cardBorder,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.bgSecondary,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800' },

  scroll: { padding: Spacing.md, paddingBottom: 24 },

  stepHeading: { color: Colors.textPrimary, fontSize: 22, fontWeight: '800', marginBottom: 6 },
  stepSub:     { color: Colors.textSecondary, fontSize: 14, marginBottom: 20, lineHeight: 20 },

  input: {
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1.5, borderColor: Colors.cardBorder,
    borderRadius: Radius.md,
    paddingHorizontal: 14, paddingVertical: 12,
    color: Colors.textPrimary, fontSize: 15,
    marginBottom: 16,
  },
  inputRequired: { borderColor: Colors.lime + '55' },
  inputMulti:    { height: 90, paddingTop: 12 },
  inputHint:     { color: Colors.textMuted, fontSize: 11, marginTop: -12, marginBottom: 16, marginLeft: 4 },

  // Date picker button
  datePicker: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1.5, borderColor: Colors.cardBorder,
    borderRadius: Radius.md,
    paddingHorizontal: 14, paddingVertical: 13,
    marginBottom: 16,
  },
  datePickerText: { flex: 1, color: Colors.textPrimary, fontSize: 15 },
  datePickerPlaceholder: { color: Colors.textMuted },

  // Event type chips
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: Radius.full, borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.bgSecondary,
  },
  chipActive: {
    borderColor: Colors.lime,
    backgroundColor: Colors.limeDim,
  },
  chipEmoji:      { fontSize: 14 },
  chipLabel:      { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  chipLabelActive:{ color: Colors.lime },

  // Format
  formatGrid: { gap: 10, marginBottom: 8 },
  formatCard: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.lg, borderWidth: 1.5, borderColor: Colors.cardBorder,
    padding: 16, gap: 4, position: 'relative',
  },
  formatCardActive: { borderColor: Colors.lime, backgroundColor: Colors.limeDim },
  formatLabel:      { color: Colors.textPrimary, fontSize: 15, fontWeight: '700', marginTop: 4 },
  formatLabelActive:{ color: Colors.lime },
  formatSub:        { color: Colors.textSecondary, fontSize: 12 },
  formatCheck:      { position: 'absolute', top: 12, right: 12 },

  // Recurring
  recurringRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1.5, borderColor: Colors.cardBorder,
    borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 12,
    marginTop: 8, marginBottom: 8,
  },
  recurringLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recurringLabel:     { color: Colors.textPrimary, fontSize: 15, fontWeight: '600' },
  recurringOptions:   { paddingTop: 4, paddingBottom: 8 },
  recurringFreqLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginBottom: 10, marginTop: 8 },

  // Search
  searchWrap:   {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1.5, borderColor: Colors.cardBorder,
    borderRadius: Radius.md, marginBottom: 12,
  },
  searchIcon:   { marginLeft: 12 },
  searchInput:  { flex: 1, paddingHorizontal: 10, paddingVertical: 12, color: Colors.textPrimary, fontSize: 15 },
  searchResults:{ marginBottom: 14, padding: 0, overflow: 'hidden' },
  searchResultRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder,
  },
  searchResultInfo: { flex: 1 },
  searchResultName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  searchResultSub:  { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  noResults:    { color: Colors.textMuted, fontSize: 13, textAlign: 'center', marginVertical: 12 },

  // Selected players
  selectedSection:    { marginTop: 4 },
  selectedTitle:      { color: Colors.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginBottom: 10 },
  selectedPlayerCard: { marginBottom: 8, padding: 12 },
  selectedPlayerRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  selectedPlayerInfo: { flex: 1 },
  selectedPlayerName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  selectedPlayerSub:  { color: Colors.textSecondary, fontSize: 11, marginTop: 2 },
  roleChip:           { paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.full, backgroundColor: Colors.bgTertiary, borderWidth: 1, borderColor: Colors.cardBorder },
  roleChipActive:     { backgroundColor: Colors.purpleDim, borderColor: Colors.purple },
  roleChipText:       { color: Colors.textSecondary, fontSize: 11, fontWeight: '600' },
  roleChipTextActive: { color: Colors.purple },
  removeBtn:          { padding: 2 },

  noPlayersHint:    { alignItems: 'center', paddingVertical: 32, gap: 8, marginTop: 8 },
  noPlayersText:    { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
  noPlayersSubText: { color: Colors.textMuted, fontSize: 12, textAlign: 'center', lineHeight: 18 },

  // Review step
  summaryCard:       { marginBottom: 16, padding: 20 },
  summaryEventName:  { color: Colors.textPrimary, fontSize: 20, fontWeight: '800', marginBottom: 6 },
  summaryDesc:       { color: Colors.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 10 },
  summaryDivider:    { height: 1, backgroundColor: Colors.cardBorder, marginBottom: 14 },
  summarySubTitle:   { color: Colors.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginBottom: 12 },
  summaryPlayerRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  summaryPlayerName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600', flex: 1 },

  warningBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.warning + '18',
    borderRadius: Radius.md, padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: Colors.warning + '44',
  },
  warningText: { color: Colors.warning, fontSize: 13, fontWeight: '600' },

  // Footer nav
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    paddingHorizontal: Spacing.md, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: Colors.cardBorder,
    backgroundColor: Colors.bg,
    gap: 12,
  },
  skipBtn:  { paddingHorizontal: 16, paddingVertical: 10 },
  skipText: { color: Colors.textSecondary, fontSize: 14 },
});
