import React, { useRef, useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  StyleSheet, ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing } from '../../constants/theme';
import { API_BASE } from '../../constants/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GolfCourse {
  id?: string;
  name: string;
  city: string;
  state: string;
  holes?: number;
  par?: number;
  courseRating?: number;
  slopeRating?: number;
}

interface CourseSearchInputProps {
  value: string;
  onSelect: (course: GolfCourse) => void;
  placeholder?: string;
  style?: ViewStyle;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CourseSearchInput({
  value,
  onSelect,
  placeholder = 'Search for a golf course...',
  style,
}: CourseSearchInputProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<GolfCourse[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/courses/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error('Search failed');
      const json = await res.json();
      const data: GolfCourse[] = json.data ?? json;
      setResults(Array.isArray(data) ? data : []);
      setOpen(true);
    } catch {
      setResults([]);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    debounceRef.current = setTimeout(() => search(text.trim()), 400);
  }, [search]);

  const handleSelect = useCallback((course: GolfCourse) => {
    setQuery(course.name);
    setResults([]);
    setOpen(false);
    onSelect(course);
  }, [onSelect]);

  return (
    <View style={[styles.container, style]}>
      {/* Input row */}
      <View style={styles.inputRow}>
        <Ionicons name="search-outline" size={16} color={Colors.textMuted} style={styles.icon} />
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={handleChange}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="words"
          returnKeyType="search"
        />
        {loading && (
          <ActivityIndicator size="small" color={Colors.lime} style={styles.spinner} />
        )}
        {!loading && query.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              setQuery('');
              setResults([]);
              setOpen(false);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.clearBtn}
          >
            <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Dropdown results */}
      {open && results.length > 0 && (
        <View style={styles.dropdown}>
          {results.map((course, idx) => (
            <TouchableOpacity
              key={course.id ?? idx}
              style={[
                styles.resultRow,
                styles.resultRowBorder,
              ]}
              onPress={() => handleSelect(course)}
              activeOpacity={0.7}
            >
              <View style={styles.resultIconWrap}>
                <Ionicons name="golf-outline" size={14} color={Colors.lime} />
              </View>
              <View style={styles.resultInfo}>
                <Text style={styles.resultName} numberOfLines={1}>{course.name}</Text>
                <Text style={styles.resultSub} numberOfLines={1}>
                  {[course.city, course.state].filter(Boolean).join(', ')}
                  {course.holes ? `  ·  ${course.holes} holes` : ''}
                  {course.par ? `  ·  Par ${course.par}` : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
            </TouchableOpacity>
          ))}
          {query.trim().length >= 2 && (
            <TouchableOpacity
              style={styles.customCourseRow}
              onPress={() => {
                onSelect({ id: undefined, name: query.trim(), city: '', state: '' });
                setResults([]);
                setOpen(false);
                setQuery('');
              }}
            >
              <Text style={styles.customCourseText}>+ Use "{query.trim()}" as custom course</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* No results state */}
      {open && !loading && results.length === 0 && query.length >= 2 && (
        <View style={styles.dropdown}>
          <View style={styles.noResults}>
            <Text style={styles.noResultsText}>No courses found for "{query}"</Text>
          </View>
          <TouchableOpacity
            style={styles.customCourseRow}
            onPress={() => {
              onSelect({ id: undefined, name: query.trim(), city: '', state: '' });
              setResults([]);
              setOpen(false);
              setQuery('');
            }}
          >
            <Text style={styles.customCourseText}>+ Use "{query.trim()}" as custom course</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    borderRadius: Radius.md,
  },
  icon: {
    marginLeft: 12,
  },
  input: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 12,
    color: Colors.textPrimary,
    fontSize: 15,
  },
  spinner: {
    marginRight: 12,
  },
  clearBtn: {
    marginRight: 12,
  },
  dropdown: {
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1.5,
    borderColor: Colors.cardBorderActive,
    borderRadius: Radius.md,
    marginTop: 4,
    overflow: 'hidden',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    gap: 10,
  },
  resultRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  resultIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.limeDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  resultSub: {
    color: Colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  noResults: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
  },
  noResultsText: {
    color: Colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
  customCourseRow: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
  customCourseText: {
    color: Colors.lime,
    fontSize: 13,
  },
});
