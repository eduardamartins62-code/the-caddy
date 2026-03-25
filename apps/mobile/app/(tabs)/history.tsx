import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { historyApi } from '../../services/api';
import { HistoryEntry } from '@the-caddy/shared';
import GlassCard from '../../components/ui/GlassCard';
import { SkeletonCard } from '../../components/ui/SkeletonLoader';
import { Colors, Radius, Spacing } from '../../constants/theme';

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    try {
      const data = await historyApi.list();
      setEntries(data);
    } catch { } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, []);

  const years = [...new Set(entries.map(e => e.year))].sort((a, b) => b - a);
  const filtered = selectedYear ? entries.filter(e => e.year === selectedYear) : entries;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 100 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.lime} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Hall of Champions hero */}
        <LinearGradient colors={['#1A1A2E', '#0A0A0F']} style={styles.heroBanner}>
          <View style={styles.heroGlow} />
          <Text style={styles.heroEmoji}>🏆</Text>
          <Text style={styles.heroTitle}>HALL OF{'\n'}CHAMPIONS</Text>
          <Text style={styles.heroSub}>The legacy of The Caddy</Text>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>{entries.length} Tournaments</Text>
          </View>
        </LinearGradient>

        {/* Year filter */}
        {years.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.yearRow} style={{ marginBottom: 20 }}>
            <TouchableOpacity
              style={[styles.yearChip, !selectedYear && styles.yearChipActive]}
              onPress={() => setSelectedYear(null)}
            >
              <Text style={[styles.yearChipText, !selectedYear && styles.yearChipTextActive]}>All</Text>
            </TouchableOpacity>
            {years.map(y => (
              <TouchableOpacity
                key={y}
                style={[styles.yearChip, selectedYear === y && styles.yearChipActive]}
                onPress={() => setSelectedYear(y === selectedYear ? null : y)}
              >
                <Text style={[styles.yearChipText, selectedYear === y && styles.yearChipTextActive]}>{y}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Entries */}
        {loading ? (
          [1, 2].map(i => <SkeletonCard key={i} />)
        ) : filtered.length === 0 ? (
          <GlassCard>
            <Text style={styles.empty}>No history entries yet.</Text>
          </GlassCard>
        ) : filtered.map(entry => (
          <GlassCard key={entry.id} style={styles.entryCard} padding={0}>
            {/* Champion banner */}
            <LinearGradient colors={['#1A1A2E', '#13131A']} style={styles.championBanner}>
              <View style={styles.championBannerGlow} />
              <View style={styles.yearBadge}>
                <Text style={styles.yearBadgeText}>{entry.year}</Text>
              </View>
              <View style={styles.championInfo}>
                <Text style={styles.championLabel}>Champion</Text>
                <View style={styles.championNameRow}>
                  <Text style={styles.championTrophy}>🏆</Text>
                  <Text style={styles.championName}>{entry.champion}</Text>
                </View>
              </View>
            </LinearGradient>

            {/* Recap + photos */}
            <View style={styles.entryBody}>
              <Text style={styles.recapText} numberOfLines={expanded === entry.id ? undefined : 3}>
                {entry.recap}
              </Text>
              {entry.recap.length > 120 && (
                <TouchableOpacity onPress={() => setExpanded(expanded === entry.id ? null : entry.id)}>
                  <Text style={styles.readMore}>
                    {expanded === entry.id ? 'Show less ↑' : 'Read more ↓'}
                  </Text>
                </TouchableOpacity>
              )}

              {entry.photos?.length > 0 && (
                <>
                  <Text style={styles.photosLabel}>Photos</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
                    {entry.photos.map((url: string, i: number) => (
                      <Image key={i} source={{ uri: url }} style={styles.galleryPhoto} resizeMode="cover" />
                    ))}
                  </ScrollView>
                </>
              )}
            </View>
          </GlassCard>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },

  header:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingTop: 8, paddingBottom: 4 },
  backBtn:  { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.bgSecondary, borderWidth: 1, borderColor: Colors.cardBorder, alignItems: 'center', justifyContent: 'center' },

  scroll: { padding: Spacing.md },

  // Hero
  heroBanner: {
    borderRadius: Radius.xl, padding: 28, alignItems: 'center',
    marginBottom: 24, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.lime + '25',
  },
  heroGlow: {
    position: 'absolute', top: -50, width: 200, height: 200,
    borderRadius: 100, backgroundColor: Colors.lime, opacity: 0.07,
  },
  heroEmoji: { fontSize: 48, marginBottom: 12 },
  heroTitle: {
    color: Colors.textPrimary, fontSize: 30, fontWeight: '900',
    letterSpacing: 4, textAlign: 'center', lineHeight: 34,
  },
  heroSub:   { color: Colors.textSecondary, fontSize: 14, marginTop: 8, marginBottom: 16 },
  heroBadge: {
    backgroundColor: Colors.limeDim, borderRadius: Radius.pill,
    paddingHorizontal: 16, paddingVertical: 6,
    borderWidth: 1, borderColor: Colors.lime + '40',
  },
  heroBadgeText: { color: Colors.lime, fontSize: 12, fontWeight: '700' },

  // Year filter
  yearRow:          { paddingVertical: 4, gap: 8 },
  yearChip:         { borderRadius: Radius.pill, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.bgSecondary },
  yearChipActive:   { backgroundColor: Colors.limeDim, borderColor: Colors.lime + '60' },
  yearChipText:     { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  yearChipTextActive: { color: Colors.lime },

  empty: { color: Colors.textSecondary, textAlign: 'center', paddingVertical: 12 },

  // Entry card
  entryCard:      { marginBottom: 16, overflow: 'hidden' },
  championBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 16, position: 'relative', overflow: 'hidden',
  },
  championBannerGlow: {
    position: 'absolute', left: -30, top: -30,
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: Colors.lime, opacity: 0.07,
  },
  yearBadge: {
    backgroundColor: Colors.lime, borderRadius: Radius.md,
    paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center',
  },
  yearBadgeText: { color: Colors.bg, fontSize: 16, fontWeight: '900' },
  championInfo:    { flex: 1 },
  championLabel:   { color: Colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  championNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  championTrophy:  { fontSize: 16 },
  championName:    { color: Colors.textPrimary, fontSize: 17, fontWeight: '700' },

  entryBody:   { padding: 16 },
  recapText:   { color: Colors.textSecondary, fontSize: 14, lineHeight: 22, marginBottom: 6 },
  readMore:    { color: Colors.lime, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  photosLabel: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700', marginTop: 12, marginBottom: 8 },
  photoRow:    { marginHorizontal: -4 },
  galleryPhoto: { width: 160, height: 110, borderRadius: Radius.md, marginRight: 8 },
});
