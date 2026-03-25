import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  User, TrendingUp, Flag, MapPin, FileText, Check, ChevronRight,
} from 'lucide-react-native';
import { usersApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import GradientButton from '../components/ui/GradientButton';
import { Colors, Radius, Spacing } from '../constants/theme';

const TOTAL_STEPS = 5;

const HANDICAP_PRESETS = [
  { label: 'Scratch', value: '0' },
  { label: '5', value: '5' },
  { label: '10', value: '10' },
  { label: '15', value: '15' },
  { label: '20', value: '20' },
  { label: '25+', value: '25' },
];

export default function OnboardingScreen() {
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const { user, updateUser } = useAuth();

  const [step, setStep]               = useState(0);
  const [saving, setSaving]           = useState(false);

  // Form fields
  const [name, setName]               = useState(user?.name?.includes('@') ? '' : (user?.name ?? ''));
  const [handicap, setHandicap]       = useState('');
  const [noHandicap, setNoHandicap]   = useState(false);
  const [homeCourse, setHomeCourse]   = useState('');
  const [location, setLocation]       = useState('');
  const [bio, setBio]                 = useState('');

  function next() { setStep(s => Math.min(s + 1, TOTAL_STEPS - 1)); }
  function back() { if (step > 0) setStep(s => s - 1); }

  async function finish() {
    if (!user) return;
    setSaving(true);
    try {
      await usersApi.updateUser(user.id, {
        name:               name.trim() || user.name,
        handicap:           noHandicap ? null : (handicap ? parseFloat(handicap) : null),
        homeCourse:         homeCourse.trim() || null,
        location:           location.trim() || null,
        bio:                bio.trim() || null,
        onboardingComplete: true,
      } as any);
      await updateUser({
        name:               name.trim() || user.name,
        handicap:           noHandicap ? null : (handicap ? parseFloat(handicap) : null),
        homeCourse:         homeCourse.trim() || undefined,
        location:           location.trim() || undefined,
        bio:                bio.trim() || null,
        onboardingComplete: true,
      });
      router.replace('/(tabs)/home');
    } catch { /* silently handle */ } finally {
      setSaving(false);
    }
  }

  // ─── Step renderers ───────────────────────────────────────────────────────

  const steps = [
    // Step 0 — Welcome
    <View key="welcome" style={styles.stepContent}>
      <View style={styles.stepIcon}>
        <LinearGradient colors={[Colors.lime, Colors.purple]} style={styles.stepIconGrad}>
          <User size={32} color={Colors.bg} strokeWidth={2} />
        </LinearGradient>
      </View>
      <Text style={styles.stepHeading}>Welcome to{'\n'}The Caddy</Text>
      <Text style={styles.stepSub}>
        Let's take 60 seconds to set up your profile so your crew knows who you are on the course.
      </Text>
      <GradientButton label="Let's Go" onPress={next} style={{ marginTop: 32 }} />
    </View>,

    // Step 1 — Name
    <View key="name" style={styles.stepContent}>
      <View style={styles.stepIcon}>
        <View style={[styles.stepIconPlain, { backgroundColor: Colors.lime + '20' }]}>
          <User size={28} color={Colors.lime} strokeWidth={1.8} />
        </View>
      </View>
      <Text style={styles.stepHeading}>What's your name?</Text>
      <Text style={styles.stepSub}>This is how you'll appear to other golfers.</Text>
      <TextInput
        style={styles.bigInput}
        placeholder="Full name"
        placeholderTextColor={Colors.textMuted}
        value={name}
        onChangeText={setName}
        autoFocus
        autoCapitalize="words"
        returnKeyType="done"
        onSubmitEditing={() => name.trim() && next()}
      />
      <GradientButton
        label="Continue"
        onPress={() => name.trim() ? next() : undefined}
        style={{ marginTop: 24, opacity: name.trim() ? 1 : 0.4 }}
      />
    </View>,

    // Step 2 — Handicap
    <ScrollView key="handicap" contentContainerStyle={styles.stepContent} keyboardShouldPersistTaps="handled">
      <View style={styles.stepIcon}>
        <View style={[styles.stepIconPlain, { backgroundColor: Colors.purple + '20' }]}>
          <TrendingUp size={28} color={Colors.purple} strokeWidth={1.8} />
        </View>
      </View>
      <Text style={styles.stepHeading}>What's your handicap?</Text>
      <Text style={styles.stepSub}>Helps us match you with the right players.</Text>

      <View style={styles.presetGrid}>
        {HANDICAP_PRESETS.map(p => (
          <TouchableOpacity
            key={p.label}
            style={[styles.preset, handicap === p.value && !noHandicap && styles.presetActive]}
            onPress={() => { setHandicap(p.value); setNoHandicap(false); }}
          >
            <Text style={[styles.presetText, handicap === p.value && !noHandicap && styles.presetTextActive]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.orLabel}>or enter manually</Text>
      <TextInput
        style={[styles.bigInput, noHandicap && { opacity: 0.4 }]}
        placeholder="e.g. 12.4"
        placeholderTextColor={Colors.textMuted}
        value={handicap}
        onChangeText={v => { setHandicap(v); setNoHandicap(false); }}
        keyboardType="decimal-pad"
        editable={!noHandicap}
      />

      <TouchableOpacity
        style={[styles.checkRow, noHandicap && styles.checkRowActive]}
        onPress={() => { setNoHandicap(v => !v); setHandicap(''); }}
      >
        <View style={[styles.checkbox, noHandicap && styles.checkboxChecked]}>
          {noHandicap && <Check size={12} color={Colors.bg} strokeWidth={3} />}
        </View>
        <Text style={styles.checkLabel}>I don't have an official handicap</Text>
      </TouchableOpacity>

      <GradientButton label="Continue" onPress={next} style={{ marginTop: 24 }} />
      <TouchableOpacity style={styles.skipBtn} onPress={next}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>
    </ScrollView>,

    // Step 3 — Home course
    <View key="course" style={styles.stepContent}>
      <View style={styles.stepIcon}>
        <View style={[styles.stepIconPlain, { backgroundColor: Colors.lime + '20' }]}>
          <Flag size={28} color={Colors.lime} strokeWidth={1.8} />
        </View>
      </View>
      <Text style={styles.stepHeading}>Where do you play most?</Text>
      <Text style={styles.stepSub}>Your home course — the one you know like the back of your hand.</Text>
      <TextInput
        style={styles.bigInput}
        placeholder="e.g. Augusta National"
        placeholderTextColor={Colors.textMuted}
        value={homeCourse}
        onChangeText={setHomeCourse}
        autoCapitalize="words"
        returnKeyType="done"
        onSubmitEditing={next}
      />
      <GradientButton label="Continue" onPress={next} style={{ marginTop: 24 }} />
      <TouchableOpacity style={styles.skipBtn} onPress={next}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>
    </View>,

    // Step 4 — Location + bio
    <ScrollView key="bio" contentContainerStyle={styles.stepContent} keyboardShouldPersistTaps="handled">
      <View style={styles.stepIcon}>
        <View style={[styles.stepIconPlain, { backgroundColor: Colors.purple + '20' }]}>
          <FileText size={28} color={Colors.purple} strokeWidth={1.8} />
        </View>
      </View>
      <Text style={styles.stepHeading}>Last bit — about you</Text>
      <Text style={styles.stepSub}>Optional. Other golfers will see this on your profile.</Text>

      <Text style={styles.fieldLabel}>Where are you based?</Text>
      <TextInput
        style={styles.bigInput}
        placeholder="e.g. Atlanta, GA"
        placeholderTextColor={Colors.textMuted}
        value={location}
        onChangeText={setLocation}
        autoCapitalize="words"
      />

      <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Short bio</Text>
      <TextInput
        style={[styles.bigInput, styles.bioInput]}
        placeholder="e.g. Weekend warrior, 18 handicap, always looking for a game..."
        placeholderTextColor={Colors.textMuted}
        value={bio}
        onChangeText={v => setBio(v.slice(0, 160))}
        multiline
        numberOfLines={3}
      />
      <Text style={styles.charCount}>{bio.length}/160</Text>

      <GradientButton
        label="Complete Profile"
        onPress={finish}
        loading={saving}
        style={{ marginTop: 24 }}
      />
      <TouchableOpacity style={styles.skipBtn} onPress={finish}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>
    </ScrollView>,
  ];

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Progress bar */}
      {step > 0 && (
        <View style={styles.progressWrap}>
          {step > 1 && (
            <TouchableOpacity onPress={back} style={styles.backArrow}>
              <ChevronRight
                size={20} color={Colors.textSecondary}
                strokeWidth={2}
                style={{ transform: [{ rotate: '180deg' }] }}
              />
            </TouchableOpacity>
          )}
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${(step / (TOTAL_STEPS - 1)) * 100}%` as any }]} />
          </View>
          <Text style={styles.progressLabel}>{step}/{TOTAL_STEPS - 1}</Text>
        </View>
      )}

      {steps[step]}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },

  progressWrap: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: 12, gap: 10,
  },
  backArrow: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.bgSecondary,
    alignItems: 'center', justifyContent: 'center',
  },
  progressTrack: {
    flex: 1, height: 4, borderRadius: 2,
    backgroundColor: Colors.bgTertiary, overflow: 'hidden',
  },
  progressFill: {
    height: '100%', backgroundColor: Colors.lime, borderRadius: 2,
  },
  progressLabel: { color: Colors.textMuted, fontSize: 12, fontWeight: '600', width: 30 },

  stepContent: {
    flex: 1, padding: Spacing.lg, paddingTop: 32,
  },

  stepIcon: { alignItems: 'center', marginBottom: 28 },
  stepIconGrad: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
  },
  stepIconPlain: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.cardBorder,
  },

  stepHeading: {
    color: Colors.textPrimary, fontSize: 28, fontWeight: '800',
    lineHeight: 34, marginBottom: 10,
  },
  stepSub: {
    color: Colors.textSecondary, fontSize: 15, lineHeight: 22, marginBottom: 4,
  },

  bigInput: {
    backgroundColor: Colors.bgSecondary, borderWidth: 1.5,
    borderColor: Colors.cardBorder, borderRadius: Radius.lg,
    paddingHorizontal: 16, paddingVertical: 14,
    color: Colors.textPrimary, fontSize: 16,
    marginTop: 16,
  },
  bioInput: { height: 90, textAlignVertical: 'top' },
  charCount: { color: Colors.textMuted, fontSize: 11, textAlign: 'right', marginTop: 4 },

  fieldLabel: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600', marginTop: 4 },

  presetGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 20,
  },
  preset: {
    paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: Radius.pill, borderWidth: 1.5,
    borderColor: Colors.cardBorder, backgroundColor: Colors.bgSecondary,
  },
  presetActive: {
    borderColor: Colors.lime, backgroundColor: Colors.limeDim,
  },
  presetText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
  presetTextActive: { color: Colors.lime },

  orLabel: {
    color: Colors.textMuted, fontSize: 12, textAlign: 'center',
    marginTop: 16, marginBottom: 0,
  },

  checkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 16, padding: 12,
    borderRadius: Radius.md, backgroundColor: Colors.bgSecondary,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  checkRowActive: { borderColor: Colors.lime + '60', backgroundColor: Colors.limeDim },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 1.5, borderColor: Colors.cardBorder,
    backgroundColor: Colors.bgTertiary,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: Colors.lime, borderColor: Colors.lime },
  checkLabel: { color: Colors.textSecondary, fontSize: 13, flex: 1 },

  skipBtn: { alignItems: 'center', paddingVertical: 14 },
  skipText: { color: Colors.textMuted, fontSize: 13 },
});
