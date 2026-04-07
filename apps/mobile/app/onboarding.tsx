import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../context/AuthContext';
import { Colors, Radius, Spacing } from '../constants/theme';
import { API_BASE } from '../constants/api';

const TOTAL_STEPS = 5;

const HANDICAP_PRESETS = [
  { label: 'Scratch', value: '0' },
  { label: '5',       value: '5' },
  { label: '10',      value: '10' },
  { label: '15',      value: '15' },
  { label: '20',      value: '20' },
  { label: '25+',     value: '25' },
];

async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    try { return localStorage.getItem('auth_token'); } catch { return null; }
  }
  return SecureStore.getItemAsync('auth_token');
}

export default function OnboardingScreen() {
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const { user, updateUser } = useAuth();

  const [step, setStep]     = useState(1); // 1-5

  // Step 2: Name + Username
  const [name, setName]                     = useState(user?.name?.includes('@') ? '' : (user?.name ?? ''));
  const [username, setUsername]             = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername]   = useState(false);
  const usernameDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Step 3: Handicap
  const [handicap, setHandicap]       = useState('');
  const [noHandicap, setNoHandicap]   = useState(false);

  // Step 4: Home Course
  const [courseSearch, setCourseSearch]   = useState('');
  const [courseResults, setCourseResults] = useState<any[]>([]);
  const [searchingCourse, setSearchingCourse] = useState(false);
  const [selectedCourse, setSelectedCourse]   = useState<{ id: string; name: string } | null>(null);
  const courseDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Step 5: Location + Bio
  const [location, setLocation] = useState('');
  const [bio, setBio]           = useState('');

  const [saving, setSaving] = useState(false);

  function next() { setStep(s => Math.min(s + 1, TOTAL_STEPS)); }
  function back() { if (step > 1) setStep(s => s - 1); }

  // ─── Username availability check ─────────────────────────────────────────

  const checkUsername = useCallback((val: string) => {
    if (usernameDebounce.current) clearTimeout(usernameDebounce.current);
    if (val.length < 3) { setUsernameAvailable(null); return; }
    setCheckingUsername(true);
    usernameDebounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/users/check-username?username=${encodeURIComponent(val)}`);
        const data = await res.json();
        setUsernameAvailable(data?.available ?? false);
      } catch {
        setUsernameAvailable(null);
      } finally {
        setCheckingUsername(false);
      }
    }, 400);
  }, []);

  useEffect(() => {
    if (username) checkUsername(username);
    return () => { if (usernameDebounce.current) clearTimeout(usernameDebounce.current); };
  }, [username]);

  // ─── Course search ────────────────────────────────────────────────────────

  useEffect(() => {
    if (courseDebounce.current) clearTimeout(courseDebounce.current);
    if (courseSearch.length < 2) { setCourseResults([]); return; }
    setSearchingCourse(true);
    courseDebounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/courses/search?q=${encodeURIComponent(courseSearch)}`);
        const data = await res.json();
        setCourseResults(Array.isArray(data) ? data : (data?.courses ?? []));
      } catch {
        setCourseResults([]);
      } finally {
        setSearchingCourse(false);
      }
    }, 500);
    return () => { if (courseDebounce.current) clearTimeout(courseDebounce.current); };
  }, [courseSearch]);

  // ─── Finish: PUT /api/users/me ────────────────────────────────────────────

  async function finish() {
    if (!user) return;
    setSaving(true);
    try {
      const token = await getToken();
      const body: Record<string, any> = {
        name:          name.trim() || user.name,
        username:      username.trim() || undefined,
        handicap:      noHandicap ? null : (handicap ? parseFloat(handicap) : null),
        homeCourseId:  selectedCourse?.id ?? null,
        location:      location.trim() || null,
        bio:           bio.trim() || null,
        isOnboarded:   true,
        onboardingComplete: true,
      };
      await fetch(`${API_BASE}/users/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      await updateUser({
        name:              name.trim() || user.name,
        handicap:          noHandicap ? null : (handicap ? parseFloat(handicap) : null),
        location:          location.trim() || undefined,
        bio:               bio.trim() || null,
        isOnboarded:       true,
        onboardingComplete: true,
      } as any);
      router.replace('/(tabs)/home');
    } catch {
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  // ─── Progress dots ────────────────────────────────────────────────────────

  function ProgressDots() {
    return (
      <View style={styles.dotsRow}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i + 1 < step  ? styles.dotComplete :
              i + 1 === step ? styles.dotActive :
              styles.dotMuted,
            ]}
          />
        ))}
      </View>
    );
  }

  // ─── Username indicator ───────────────────────────────────────────────────

  function UsernameIndicator() {
    if (!username || username.length < 3) return null;
    if (checkingUsername) return <ActivityIndicator size="small" color={Colors.gold} />;
    if (usernameAvailable === true)  return <Ionicons name="checkmark-circle" size={20} color={Colors.teal} />;
    if (usernameAvailable === false) return <Ionicons name="close-circle" size={20} color={Colors.error} />;
    return null;
  }

  const step2Valid = name.trim().length >= 3 && name.trim().length <= 50 && usernameAvailable === true;

  // ─── Step renderers ───────────────────────────────────────────────────────

  // Step 1: Welcome
  if (step === 1) {
    return (
      <KeyboardAvoidingView style={[styles.screen, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[styles.progressWrap]}>
          <View style={{ width: 32 }} />
          <ProgressDots />
          <View style={{ width: 32 }} />
        </View>
        <View style={styles.welcomeContent}>
          <Text style={styles.brandName}>THE CADDY</Text>
          <Text style={styles.welcomeTagline}>Your game. Your people.</Text>
          <Text style={styles.welcomeDesc}>
            Set up your golfer profile in a few quick steps. Tell us who you are, your game level, and where you play.
          </Text>
          <TouchableOpacity onPress={next} activeOpacity={0.85}>
            <LinearGradient colors={['#F0C866', '#C4912A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaBtn}>
              <Text style={styles.ctaText}>Get Started</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // Step 2: Name + Username
  if (step === 2) {
    return (
      <KeyboardAvoidingView style={[styles.screen, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.progressWrap}>
          <TouchableOpacity onPress={back} style={styles.backArrow}>
            <Ionicons name="chevron-back" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
          <ProgressDots />
          <View style={{ width: 32 }} />
        </View>
        <ScrollView contentContainerStyle={styles.stepContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.stepHeading}>Your Profile</Text>
          <Text style={styles.stepSub}>Tell your crew who you are on the course.</Text>

          <Text style={styles.fieldLabel}>Full Name</Text>
          <TextInput
            style={styles.bigInput}
            placeholder="e.g. Tiger Woods"
            placeholderTextColor={Colors.textMuted}
            value={name}
            onChangeText={setName}
            autoFocus
            autoCapitalize="words"
            returnKeyType="next"
          />
          {name.trim().length > 0 && (name.trim().length < 3 || name.trim().length > 50) && (
            <Text style={styles.fieldError}>Name must be 3–50 characters</Text>
          )}

          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Username</Text>
          <View style={styles.usernameWrap}>
            <Text style={styles.usernameAt}>@</Text>
            <TextInput
              style={[styles.bigInput, styles.usernameInput]}
              placeholder="e.g. tigerwoodsgolf"
              placeholderTextColor={Colors.textMuted}
              value={username}
              onChangeText={v => setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
            />
            <View style={styles.usernameIndicator}>
              <UsernameIndicator />
            </View>
          </View>
          {username.length > 0 && username.length < 3 && (
            <Text style={styles.fieldError}>Username must be at least 3 characters</Text>
          )}
          {usernameAvailable === false && username.length >= 3 && (
            <Text style={styles.fieldError}>Username is taken</Text>
          )}
          {usernameAvailable === true && (
            <Text style={styles.fieldSuccess}>Username is available</Text>
          )}

          <TouchableOpacity
            onPress={next}
            disabled={!step2Valid}
            activeOpacity={0.85}
            style={{ marginTop: 28, opacity: step2Valid ? 1 : 0.4 }}
          >
            <LinearGradient colors={['#F0C866', '#C4912A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaBtn}>
              <Text style={styles.ctaText}>Continue</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // Step 3: Handicap
  if (step === 3) {
    return (
      <KeyboardAvoidingView style={[styles.screen, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.progressWrap}>
          <TouchableOpacity onPress={back} style={styles.backArrow}>
            <Ionicons name="chevron-back" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
          <ProgressDots />
          <View style={{ width: 32 }} />
        </View>
        <ScrollView contentContainerStyle={styles.stepContent} keyboardShouldPersistTaps="handled">
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
              {noHandicap && <Ionicons name="checkmark" size={12} color={Colors.bg} />}
            </View>
            <Text style={styles.checkLabel}>I don't have an official handicap</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={next} activeOpacity={0.85} style={{ marginTop: 24 }}>
            <LinearGradient colors={['#F0C866', '#C4912A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaBtn}>
              <Text style={styles.ctaText}>Continue</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={styles.skipBtn} onPress={next}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // Step 4: Home Course
  if (step === 4) {
    return (
      <KeyboardAvoidingView style={[styles.screen, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.progressWrap}>
          <TouchableOpacity onPress={back} style={styles.backArrow}>
            <Ionicons name="chevron-back" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
          <ProgressDots />
          <View style={{ width: 32 }} />
        </View>
        <ScrollView contentContainerStyle={styles.stepContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.stepHeading}>Where do you play most?</Text>
          <Text style={styles.stepSub}>Your home course — the one you know like the back of your hand.</Text>

          {selectedCourse ? (
            <View style={styles.selectedCourse}>
              <Ionicons name="flag" size={16} color={Colors.gold} />
              <Text style={styles.selectedCourseName} numberOfLines={1}>{selectedCourse.name}</Text>
              <TouchableOpacity onPress={() => setSelectedCourse(null)}>
                <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TextInput
                style={styles.bigInput}
                placeholder="Search courses..."
                placeholderTextColor={Colors.textMuted}
                value={courseSearch}
                onChangeText={setCourseSearch}
                autoCapitalize="none"
                returnKeyType="search"
              />
              {searchingCourse && (
                <ActivityIndicator style={{ marginTop: 8 }} color={Colors.gold} />
              )}
              {courseResults.map((c: any) => (
                <TouchableOpacity
                  key={c.id}
                  style={styles.courseResult}
                  onPress={() => { setSelectedCourse({ id: c.id, name: c.name }); setCourseSearch(''); setCourseResults([]); }}
                >
                  <Ionicons name="flag-outline" size={14} color={Colors.gold} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.courseResultName} numberOfLines={1}>{c.name}</Text>
                    {(c.city || c.state) && (
                      <Text style={styles.courseResultLocation}>{[c.city, c.state].filter(Boolean).join(', ')}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </>
          )}

          <TouchableOpacity
            onPress={next}
            disabled={!selectedCourse}
            activeOpacity={0.85}
            style={{ marginTop: 28, opacity: selectedCourse ? 1 : 0.4 }}
          >
            <LinearGradient colors={['#F0C866', '#C4912A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaBtn}>
              <Text style={styles.ctaText}>Continue</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={styles.skipBtn} onPress={next}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // Step 5: Location + Bio
  return (
    <KeyboardAvoidingView style={[styles.screen, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.progressWrap}>
        <TouchableOpacity onPress={back} style={styles.backArrow}>
          <Ionicons name="chevron-back" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
        <ProgressDots />
        <View style={{ width: 32 }} />
      </View>
      <ScrollView contentContainerStyle={styles.stepContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.stepHeading}>Almost done!</Text>
        <Text style={styles.stepSub}>Add your location and a short bio so your crew can find you.</Text>

        <Text style={styles.fieldLabel}>Location</Text>
        <TextInput
          style={styles.bigInput}
          placeholder="e.g. San Diego, CA"
          placeholderTextColor={Colors.textMuted}
          value={location}
          onChangeText={setLocation}
          autoCapitalize="words"
          returnKeyType="next"
        />

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
          <Text style={styles.fieldLabel}>Bio</Text>
          <Text style={styles.charCount}>{bio.length}/160</Text>
        </View>
        <TextInput
          style={[styles.bigInput, styles.bioInput]}
          placeholder="Tell your crew about your game..."
          placeholderTextColor={Colors.textMuted}
          value={bio}
          onChangeText={v => setBio(v.slice(0, 160))}
          multiline
          textAlignVertical="top"
          maxLength={160}
          returnKeyType="done"
        />

        <TouchableOpacity
          onPress={finish}
          disabled={saving}
          activeOpacity={0.85}
          style={{ marginTop: 28 }}
        >
          <LinearGradient colors={['#F0C866', '#C4912A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaBtn}>
            {saving ? (
              <ActivityIndicator color={Colors.bg} />
            ) : (
              <Text style={styles.ctaText}>Finish</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity style={styles.skipBtn} onPress={finish} disabled={saving}>
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },

  progressWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    justifyContent: 'space-between',
  },
  backArrow: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.bgSecondary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },

  dotsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { backgroundColor: Colors.gold, width: 20 },
  dotComplete: { backgroundColor: Colors.gold },
  dotMuted: { backgroundColor: Colors.bgTertiary, borderWidth: 1, borderColor: Colors.border },

  // Welcome step
  welcomeContent: {
    flex: 1, padding: Spacing.lg, alignItems: 'center', justifyContent: 'center',
  },
  brandName: {
    color: Colors.gold,
    fontSize: 42,
    fontFamily: 'CormorantGaramond_700Bold',
    letterSpacing: 4,
    marginBottom: 8,
    textAlign: 'center',
  },
  welcomeTagline: {
    color: Colors.textSecondary,
    fontSize: 16,
    fontFamily: 'DMSans_400Regular',
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 24,
  },
  welcomeDesc: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontFamily: 'DMSans_400Regular',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
    paddingHorizontal: 8,
  },

  stepContent: { padding: Spacing.lg, paddingTop: 16, paddingBottom: 60 },
  stepHeading: {
    color: Colors.textPrimary,
    fontSize: 28,
    fontFamily: 'CormorantGaramond_700Bold',
    marginBottom: 8,
  },
  stepSub: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontFamily: 'DMSans_400Regular',
    lineHeight: 22,
    marginBottom: 20,
  },

  fieldLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 4,
  },
  fieldError: {
    color: Colors.error,
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    marginTop: 4,
  },
  fieldSuccess: {
    color: Colors.teal,
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    marginTop: 4,
  },

  bigInput: {
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: Colors.textPrimary,
    fontSize: 16,
    fontFamily: 'DMSans_400Regular',
  },
  bioInput: { height: 100, textAlignVertical: 'top' },
  charCount: {
    color: Colors.textMuted,
    fontSize: 11,
    fontFamily: 'DMSans_400Regular',
  },

  // Username field
  usernameWrap: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  usernameAt: { color: Colors.textSecondary, fontSize: 18, fontFamily: 'DMSans_400Regular', paddingLeft: 4 },
  usernameInput: { flex: 1 },
  usernameIndicator: { paddingHorizontal: 8 },

  // Handicap presets
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  preset: {
    paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: Radius.pill, borderWidth: 1.5,
    borderColor: Colors.border, backgroundColor: Colors.bgTertiary,
  },
  presetActive: { borderColor: Colors.gold, backgroundColor: Colors.goldDim },
  presetText: { color: Colors.textSecondary, fontSize: 14, fontFamily: 'DMSans_500Medium' },
  presetTextActive: { color: Colors.gold },
  orLabel: { color: Colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 16, marginBottom: 4, fontFamily: 'DMSans_400Regular' },
  checkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 16, padding: 12,
    borderRadius: Radius.md, backgroundColor: Colors.bgSecondary,
    borderWidth: 1, borderColor: Colors.border,
  },
  checkRowActive: { borderColor: Colors.gold + '60', backgroundColor: Colors.goldDim },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.bgTertiary,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  checkLabel: { color: Colors.textSecondary, fontSize: 13, flex: 1, fontFamily: 'DMSans_400Regular' },

  // Course search
  selectedCourse: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.goldDim, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.gold + '40',
    padding: 14, marginTop: 8,
  },
  selectedCourseName: { flex: 1, color: Colors.textPrimary, fontSize: 15, fontFamily: 'DMSans_500Medium' },
  courseResult: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, marginTop: 4,
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
  },
  courseResultName: { color: Colors.textPrimary, fontSize: 14, fontFamily: 'DMSans_500Medium' },
  courseResultLocation: { color: Colors.textMuted, fontSize: 12, fontFamily: 'DMSans_400Regular', marginTop: 1 },

  ctaBtn: {
    height: 52, borderRadius: Radius.pill,
    alignItems: 'center', justifyContent: 'center',
  },
  ctaText: {
    color: Colors.bg, fontSize: 16,
    fontFamily: 'DMSans_500Medium', letterSpacing: 0.5,
  },

  skipBtn: { alignItems: 'center', paddingVertical: 14 },
  skipText: { color: Colors.textMuted, fontSize: 13, fontFamily: 'DMSans_400Regular' },
});
