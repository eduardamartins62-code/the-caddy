import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Linking, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Bookmark, Home, Star, MapPin, Search, SlidersHorizontal } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import GlassCard from '../../components/ui/GlassCard';
import { coursesApi } from '../../services/api';
import { Colors, Radius, Spacing, Typography } from '../../constants/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterType = 'All' | 'Public' | 'Private' | 'Resort' | 'Par3' | 'NineHole';

interface Course {
  id: string;
  name: string;
  city?: string;
  state?: string;
  holes?: number;
  rating?: number;
  type?: string;
  lat?: number;
  lng?: number;
  photoUrl?: string;
  isBookmarked?: boolean;
}

const FILTER_LABELS: { key: FilterType; label: string }[] = [
  { key: 'All', label: 'All' },
  { key: 'Public', label: 'Public' },
  { key: 'Private', label: 'Private' },
  { key: 'Resort', label: 'Resort' },
  { key: 'Par3', label: 'Par 3' },
  { key: 'NineHole', label: '9-Hole' },
];

function bookTeeTime(courseName: string) {
  const url = `https://www.golfnow.com/tee-times/search#search/facility-name=${encodeURIComponent(courseName)}`;
  WebBrowser.openBrowserAsync(url);
}

// ─── Course Card ─────────────────────────────────────────────────────────────

function CourseCard({
  course,
  onSetHome,
  isHome,
}: {
  course: Course;
  onSetHome: (id: string) => void;
  isHome: boolean;
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
    <GlassCard style={styles.courseCard} padding={0}>
      {/* Photo / Gradient placeholder */}
      <View style={styles.coursePhotoWrap}>
        <LinearGradient colors={placeholderColors} style={styles.coursePhoto}>
          <View style={styles.coursePhotoOverlay} />
        </LinearGradient>

        {/* Bookmark icon top-right */}
        <TouchableOpacity
          style={styles.bookmarkBtn}
          onPress={() => onSetHome(course.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Bookmark
            size={18}
            stroke={isHome ? Colors.lime : Colors.textSecondary}
            fill={isHome ? Colors.lime : 'transparent'}
            strokeWidth={2}
          />
        </TouchableOpacity>

        {isHome && (
          <View style={styles.homeBadge}>
            <Home size={10} stroke={Colors.bg} strokeWidth={2.5} />
            <Text style={styles.homeBadgeText}>Home</Text>
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
              <Star size={11} stroke={Colors.lime} fill={Colors.lime} strokeWidth={0} />
              <Text style={styles.courseMetaText}>{course.rating.toFixed(1)}</Text>
            </>
          )}
        </View>
      </View>

      {/* Map button */}
      <TouchableOpacity style={styles.mapBtn} onPress={openMap} activeOpacity={0.7}>
        <MapPin size={14} stroke={Colors.lime} strokeWidth={2} />
        <Text style={styles.mapBtnText}>Map</Text>
      </TouchableOpacity>
    </GlassCard>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function CoursesScreen() {
  const insets = useSafeAreaInsets();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('All');
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [homeCourse, setHomeCourse] = useState<Course | null>(null);
  const [homeLoading, setHomeLoading] = useState(true);

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
    debounceTimer.current = setTimeout(async () => {
      try {
        const results = await coursesApi.search(searchQuery);
        setCourses(results ?? []);
      } catch {
        setCourses([]);
      } finally {
        setLoading(false);
      }
    }, 400);

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
    if (filterType === 'Par3') return c.holes === 3 || c.type?.toLowerCase() === 'par3';
    if (filterType === 'NineHole') return c.holes === 9;
    return c.type?.toLowerCase() === filterType.toLowerCase();
  });

  const showEmptySearch = searchQuery.length < 2 && !homeLoading;
  const showResults = searchQuery.length >= 2;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Courses</Text>
      </View>

      {/* Search bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchInputWrap}>
          <Search size={16} stroke={Colors.textSecondary} strokeWidth={2} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search Course"
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <TouchableOpacity style={styles.filterIconBtn}>
          <SlidersHorizontal size={18} stroke={Colors.textSecondary} strokeWidth={2} />
        </TouchableOpacity>
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
        {/* Home Course prompt — only if no home course and not searching */}
        {!homeLoading && !homeCourse && showEmptySearch && (
          <GlassCard style={styles.setHomeCard} glow="lime">
            <View style={styles.setHomeRow}>
              <MapPin size={20} stroke={Colors.lime} strokeWidth={2} />
              <View style={styles.setHomeText}>
                <Text style={styles.setHomeTitle}>Choose Your Home Course</Text>
                <Text style={styles.setHomeSubtitle}>Pick the course you play most often</Text>
              </View>
            </View>
            <Text style={styles.setHomeHint}>Search for a course above to set it as your home course</Text>
          </GlassCard>
        )}

        {/* Home Course card */}
        {!homeLoading && homeCourse && !showResults && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Home size={13} stroke={Colors.lime} strokeWidth={2} />
              <Text style={styles.sectionLabel}>YOUR HOME COURSE</Text>
            </View>
            <CourseCard
              course={homeCourse}
              onSetHome={handleSetHome}
              isHome={true}
            />
          </View>
        )}

        {/* Loading */}
        {loading && (
          <View style={styles.centeredState}>
            <ActivityIndicator color={Colors.lime} size="large" />
          </View>
        )}

        {/* Empty search hint */}
        {showEmptySearch && (
          <View style={styles.centeredState}>
            <Search size={36} stroke={Colors.textMuted} strokeWidth={1.5} />
            <Text style={styles.emptyText}>Type to search for a course</Text>
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
    color: Colors.textPrimary,
    fontSize: Typography.xl,
    fontWeight: '800',
    letterSpacing: -0.5,
  },

  // Search bar
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: Typography.md,
  },
  filterIconBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: Colors.limeDim,
    borderColor: Colors.lime + '60',
  },
  filterChipText: {
    color: Colors.textSecondary,
    fontSize: Typography.sm,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: Colors.lime,
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
    color: Colors.lime,
    fontSize: 11,
    fontWeight: '800',
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
    backgroundColor: Colors.lime,
    borderRadius: Radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  homeBadgeText: {
    color: Colors.bg,
    fontSize: 10,
    fontWeight: '800',
  },
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
  mapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
    marginTop: 2,
  },
  mapBtnText: {
    color: Colors.lime,
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
