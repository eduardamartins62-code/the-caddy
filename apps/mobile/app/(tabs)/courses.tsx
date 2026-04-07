import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Linking, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import GlassCard from '../../components/ui/GlassCard';
import { coursesApi } from '../../services/api';
import { Colors, Radius, Spacing, Typography } from '../../constants/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterType = 'All' | 'Public' | 'Private' | 'Municipal' | 'Resort' | 'Par3';

interface Course {
  id: string;
  name: string;
  city?: string;
  state?: string;
  holes?: number;
  par?: number;
  rating?: number;
  slope?: number;
  type?: string;
  lat?: number;
  lng?: number;
  photoUrl?: string;
  isBookmarked?: boolean;
}

const FILTER_LABELS: { key: FilterType; label: string }[] = [
  { key: 'All',       label: 'All' },
  { key: 'Public',    label: 'Public' },
  { key: 'Private',   label: 'Private' },
  { key: 'Municipal', label: 'Municipal' },
  { key: 'Resort',    label: 'Resort' },
  { key: 'Par3',      label: 'Par 3' },
];

// ─── Course Card ─────────────────────────────────────────────────────────────

function CourseCard({
  course,
  onSetHome,
  isHome,
  onPress,
}: {
  course: Course;
  onSetHome: (id: string) => void;
  isHome: boolean;
  onPress?: () => void;
}) {
  const openMap = () => {
    if (course.lat && course.lng) {
      Linking.openURL(
        `https://maps.google.com/?q=${course.lat},${course.lng}`
      );
    } else {
      const q = encodeURIComponent(
        [course.name, course.city, course.state].filter(Boolean).join(' ')
      );
      Linking.openURL(`https://maps.google.com/?q=${q}`);
    }
  };

  const placeholderColors: [string, string] = ['#1A2E1A', '#0A1A0A'];

  return (
    // Spec: tap card → router.push(`/course/${course.id}`)
    <TouchableOpacity activeOpacity={onPress ? 0.85 : 1} onPress={onPress} disabled={!onPress}>
    <GlassCard style={styles.courseCard} padding={0}>
      {/* Photo / Gradient placeholder */}
      <View style={styles.coursePhotoWrap}>
        <LinearGradient colors={placeholderColors} style={styles.coursePhoto}>
          <View style={styles.coursePhotoOverlay} />
        </LinearGradient>

        {/* Home badge or bookmark */}
        <TouchableOpacity
          style={styles.bookmarkBtn}
          onPress={() => onSetHome(course.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={isHome ? 'bookmark' : 'bookmark-outline'}
            size={18}
            color={isHome ? Colors.gold : Colors.textSecondary}
          />
        </TouchableOpacity>

        {isHome && (
          <View style={styles.homeBadge}>
            <Ionicons name="home" size={10} color={Colors.bg} />
            <Text style={styles.homeBadgeText}>Home</Text>
          </View>
        )}

        {/* Par badge */}
        {course.par && (
          <View style={styles.parBadge}>
            <Text style={styles.parBadgeText}>Par {course.par}</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.courseInfo}>
        <Text style={styles.courseName} numberOfLines={1}>{course.name}</Text>
        {(course.city || course.state) && (
          <Text style={styles.courseLocation} numberOfLines={1}>
            {[course.city, course.state].filter(Boolean).join(', ')}
          </Text>
        )}
        <View style={styles.courseMeta}>
          <Text style={styles.courseMetaText}>
            {course.holes ?? 18} Holes
          </Text>
          {course.rating != null && (
            <>
              <Text style={styles.courseMetaDot}>·</Text>
              <Ionicons name="star" size={11} color={Colors.gold} />
              <Text style={styles.courseMetaText}>{course.rating.toFixed(1)}</Text>
            </>
          )}
          {course.slope != null && (
            <>
              <Text style={styles.courseMetaDot}>·</Text>
              <Text style={styles.courseMetaText}>Slope {course.slope}</Text>
            </>
          )}
        </View>
      </View>

      {/* Buttons row */}
      <View style={styles.courseActions}>
        <TouchableOpacity
          style={[styles.courseActionBtn, styles.courseActionBtnPrimary]}
          onPress={() => onSetHome(course.id)}
          activeOpacity={0.7}
        >
          <Ionicons name="home-outline" size={13} color={Colors.gold} />
          <Text style={styles.courseActionBtnText}>
            {isHome ? 'Home Course' : 'Set Home'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.courseActionBtn}
          onPress={openMap}
          activeOpacity={0.7}
        >
          <Ionicons name="map-outline" size={13} color={Colors.teal} />
          <Text style={[styles.courseActionBtnText, { color: Colors.teal }]}>Open in Maps</Text>
        </TouchableOpacity>
      </View>
    </GlassCard>
    </TouchableOpacity>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function CoursesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('All');
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [homeCourse, setHomeCourse] = useState<Course | null>(null);
  const [homeLoading, setHomeLoading] = useState(true);
  const [searchFocused, setSearchFocused] = useState(false);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Fetch home course on mount ─────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const fetchHome = async () => {
      try {
        const data = await coursesApi.getHome();
        if (!cancelled) setHomeCourse(data ?? null);
      } catch {
        if (!cancelled) setHomeCourse(null);
      } finally {
        if (!cancelled) setHomeLoading(false);
      }
    };
    fetchHome();
    return () => { cancelled = true; };
  }, []);

  // ─── Search with debounce ────────────────────────────────────────────────
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (searchQuery.length < 2) {
      setCourses([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    // Spec: debounce 300ms
    debounceTimer.current = setTimeout(async () => {
      try {
        const results = await coursesApi.search(searchQuery);
        setCourses(results ?? []);
      } catch {
        setCourses([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [searchQuery]);

  // ─── Set home course ─────────────────────────────────────────────────────
  const handleSetHome = useCallback(async (courseId: string) => {
    try {
      await coursesApi.setHome(courseId);
      const course = courses.find(c => c.id === courseId) ?? homeCourse;
      setHomeCourse(course ?? null);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not set home course');
    }
  }, [courses, homeCourse]);

  // ─── Filter courses locally ──────────────────────────────────────────────
  const filteredCourses = courses.filter(c => {
    if (filterType === 'All') return true;
    if (filterType === 'Municipal') return c.type?.toLowerCase() === 'municipal';
    if (filterType === 'Par3') return c.holes === 3 || c.type?.toLowerCase() === 'par3';
    return c.type?.toLowerCase() === filterType.toLowerCase();
  });

  const showEmptySearch = searchQuery.length < 2 && !homeLoading;
  const showResults = searchQuery.length >= 2;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>COURSES</Text>
      </View>

      {/* Search bar */}
      <View style={styles.searchRow}>
        <View style={[styles.searchInputWrap, searchFocused && styles.searchInputWrapFocused]}>
          <Ionicons name="search-outline" size={16} color={searchFocused ? Colors.gold : Colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search courses..."
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterScrollContent}
      >
        {FILTER_LABELS.map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[
              styles.filterChip,
              filterType === key && styles.filterChipActive,
            ]}
            onPress={() => setFilterType(key)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterChipText,
                filterType === key && styles.filterChipTextActive,
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.list}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Home Course section at top if set */}
        {!homeLoading && homeCourse && !showResults && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="home" size={13} color={Colors.gold} />
              <Text style={styles.sectionLabel}>YOUR HOME COURSE</Text>
            </View>
            <CourseCard
              course={homeCourse}
              onSetHome={handleSetHome}
              isHome={true}
              onPress={() => router.push(`/course/${homeCourse.id}` as any)}
            />
          </View>
        )}

        {/* Home Course prompt — only if no home course and not searching */}
        {!homeLoading && !homeCourse && showEmptySearch && (
          <GlassCard style={styles.setHomeCard}>
            <View style={styles.setHomeRow}>
              <Ionicons name="location-outline" size={20} color={Colors.gold} />
              <View style={styles.setHomeText}>
                <Text style={styles.setHomeTitle}>Choose Your Home Course</Text>
                <Text style={styles.setHomeSubtitle}>Pick the course you play most often</Text>
              </View>
            </View>
            <Text style={styles.setHomeHint}>Search for a course above to set it as your home course</Text>
          </GlassCard>
        )}

        {/* Loading */}
        {loading && (
          <View style={styles.centeredState}>
            <ActivityIndicator color={Colors.gold} size="large" />
          </View>
        )}

        {/* Empty search initial state */}
        {showEmptySearch && (
          <View style={styles.centeredState}>
            <Ionicons name="search-outline" size={36} color={Colors.textMuted} />
            <Text style={styles.emptyText}>Search for a course</Text>
            <Text style={styles.emptySubtext}>Search by name, city, or state</Text>
          </View>
        )}

        {/* Results */}
        {showResults && !loading && (
          <>
            {filteredCourses.length === 0 ? (
              <View style={styles.centeredState}>
                <Text style={styles.emptyText}>No courses found</Text>
                <Text style={styles.emptySubtext}>Try a different search term</Text>
              </View>
            ) : (
              <>
                <Text style={styles.resultsCount}>
                  {filteredCourses.length} result{filteredCourses.length !== 1 ? 's' : ''}
                </Text>
                {filteredCourses.map(course => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    onSetHome={handleSetHome}
                    isHome={homeCourse?.id === course.id}
                    onPress={() => router.push(`/course/${course.id}` as any)}
                  />
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },

  header: {
    paddingHorizontal: Spacing.md,
    paddingTop: 8,
    paddingBottom: 4,
  },
  headerTitle: {
    color: Colors.gold,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 2,
  },

  // Search bar
  searchRow: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInputWrapFocused: { borderColor: Colors.gold },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: Typography.md,
  },

  // Filter chips
  filterScroll: { flexGrow: 0 },
  filterScrollContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 10,
    gap: 8,
    flexDirection: 'row',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  filterChipActive: {
    backgroundColor: Colors.goldDim,
    borderColor: Colors.gold + '60',
  },
  filterChipText: {
    color: Colors.textSecondary,
    fontSize: Typography.sm,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: Colors.gold,
  },

  // List
  list: { flex: 1 },
  listContent: { paddingHorizontal: Spacing.md, paddingTop: 4, gap: 12 },

  // Section header
  section: { gap: 8 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionLabel: {
    color: Colors.gold,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },

  // Set home card
  setHomeCard: {
    gap: 10,
    marginBottom: 4,
  },
  setHomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  setHomeText: { flex: 1, gap: 2 },
  setHomeTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.md,
    fontWeight: '700',
  },
  setHomeSubtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.sm,
  },
  setHomeHint: {
    color: Colors.textMuted,
    fontSize: Typography.xs,
  },

  // Course card
  courseCard: { overflow: 'hidden' },
  coursePhotoWrap: { position: 'relative' },
  coursePhoto: { height: 100, justifyContent: 'flex-end' },
  coursePhotoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  bookmarkBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(10,10,15,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.gold,
    borderRadius: Radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  homeBadgeText: {
    color: Colors.bg,
    fontSize: 10,
    fontWeight: '800',
  },
  parBadge: {
    position: 'absolute',
    bottom: 8,
    left: 10,
    backgroundColor: 'rgba(10,10,15,0.7)',
    borderRadius: Radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.gold + '40',
  },
  parBadgeText: { color: Colors.gold, fontSize: 10, fontWeight: '700' },
  courseInfo: {
    padding: 12,
    paddingBottom: 6,
    gap: 3,
  },
  courseName: {
    color: Colors.textPrimary,
    fontSize: Typography.md,
    fontWeight: '700',
  },
  courseLocation: {
    color: Colors.textSecondary,
    fontSize: Typography.sm,
  },
  courseMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  courseMetaText: {
    color: Colors.textSecondary,
    fontSize: Typography.xs,
  },
  courseMetaDot: {
    color: Colors.textMuted,
  },

  // Course action buttons
  courseActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
    marginTop: 2,
  },
  courseActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  courseActionBtnPrimary: {
    borderRightWidth: 1,
    borderRightColor: Colors.cardBorder,
  },
  courseActionBtnText: {
    color: Colors.gold,
    fontSize: Typography.sm,
    fontWeight: '600',
  },

  // States
  centeredState: {
    alignItems: 'center',
    paddingTop: 40,
    gap: 8,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: Typography.md,
    fontWeight: '600',
  },
  emptySubtext: {
    color: Colors.textMuted,
    fontSize: Typography.sm,
  },
  resultsCount: {
    color: Colors.textMuted,
    fontSize: Typography.sm,
    marginBottom: 4,
  },
});
