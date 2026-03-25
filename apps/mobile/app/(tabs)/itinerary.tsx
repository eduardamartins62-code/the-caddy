import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, Image, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { eventsApi } from '../../services/api';
import { Event, ItineraryItem, ItineraryItemType } from '@the-caddy/shared';
import GlassCard from '../../components/ui/GlassCard';
import { SkeletonCard } from '../../components/ui/SkeletonLoader';
import { Colors, Radius, Spacing } from '../../constants/theme';

const typeConfig: Record<ItineraryItemType, { icon: string; color: string; label: string }> = {
  HOTEL:     { icon: 'bed-outline',        color: Colors.purple,  label: 'Hotel' },
  DINING:    { icon: 'restaurant-outline', color: Colors.orange,  label: 'Dining' },
  GOLF:      { icon: 'golf-outline',       color: Colors.lime,    label: 'Golf' },
  TRANSPORT: { icon: 'car-outline',        color: '#38BDF8',      label: 'Transport' },
  NIGHTLIFE: { icon: 'wine-outline',       color: '#EC4899',      label: 'Nightlife' },
};

export default function ItineraryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [items, setItems] = useState<ItineraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeDay, setActiveDay] = useState<number | null>(null);

  async function load() {
    try {
      const events = await eventsApi.list();
      const active = events.find((e: Event) => e.isActive) || events[0] || null;
      setEvent(active);
      if (active) {
        const itinerary = await eventsApi.itinerary(active.id);
        setItems(itinerary);
      }
    } catch { } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, []);

  const byDay: Record<number, ItineraryItem[]> = {};
  for (const item of items) {
    if (!byDay[item.day]) byDay[item.day] = [];
    byDay[item.day].push(item);
  }
  const days = Object.keys(byDay).map(Number).sort((a, b) => a - b);

  // Default to first day
  const selectedDay = activeDay ?? days[0] ?? null;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.pageTitle}>Itinerary</Text>
        <View style={{ width: 36 }} />
      </View>

      {event && (
        <View style={styles.eventInfo}>
          <Text style={styles.eventName}>{event.name}</Text>
          <Text style={styles.eventSub}>{event.location}</Text>
        </View>
      )}

      {/* Day selector */}
      {!loading && days.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.daySelector}
          style={styles.daySelectorWrap}
        >
          {days.map(day => {
            const isActive = day === selectedDay;
            const date = event
              ? new Date(new Date(event.startDate).getTime() + (day - 1) * 86400000)
              : null;
            return (
              <TouchableOpacity
                key={day}
                onPress={() => setActiveDay(day)}
                style={[styles.dayPill, isActive && styles.dayPillActive]}
                activeOpacity={0.75}
              >
                <Text style={[styles.dayPillText, isActive && styles.dayPillTextActive]}>
                  Day {day}
                </Text>
                {date && (
                  <Text style={[styles.dayPillDate, isActive && styles.dayPillDateActive]}>
                    {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 100 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.lime} />}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          [1, 2, 3].map(i => <SkeletonCard key={i} />)
        ) : !selectedDay || days.length === 0 ? (
          <GlassCard><Text style={styles.empty}>No itinerary items yet.</Text></GlassCard>
        ) : (byDay[selectedDay] || []).map((item, i) => {
          const cfg = typeConfig[item.type];
          return (
            <View key={item.id} style={styles.timelineItem}>
              {/* Timeline line */}
              <View style={styles.timelineLeft}>
                <View style={[styles.typeDot, { backgroundColor: cfg.color + '20', borderColor: cfg.color + '60' }]}>
                  <Ionicons name={cfg.icon as any} size={16} color={cfg.color} />
                </View>
                {i < (byDay[selectedDay] || []).length - 1 && (
                  <View style={styles.timelineLine} />
                )}
              </View>

              {/* Card */}
              <GlassCard style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <View style={styles.itemMeta}>
                    <Text style={[styles.itemTypeLabel, { color: cfg.color }]}>{cfg.label}</Text>
                    {item.time && (
                      <View style={[styles.timePill, { backgroundColor: cfg.color + '15', borderColor: cfg.color + '40' }]}>
                        <Ionicons name="time-outline" size={11} color={cfg.color} />
                        <Text style={[styles.timeText, { color: cfg.color }]}>{item.time}</Text>
                      </View>
                    )}
                  </View>
                </View>

                <Text style={styles.itemTitle}>{item.title}</Text>

                {item.description && (
                  <Text style={styles.itemDesc}>{item.description}</Text>
                )}

                {item.photoUrl && (
                  <Image source={{ uri: item.photoUrl }} style={styles.itemPhoto} resizeMode="cover" />
                )}

                <View style={styles.itemFooter}>
                  {item.location && (
                    <View style={styles.locationRow}>
                      <Ionicons name="location-outline" size={12} color={Colors.textSecondary} />
                      <Text style={styles.locationText}>{item.location}</Text>
                    </View>
                  )}
                  {item.mapLink && (
                    <TouchableOpacity
                      style={styles.directionsBtn}
                      onPress={() => Linking.openURL(item.mapLink!)}
                    >
                      <Ionicons name="navigate-outline" size={12} color={Colors.lime} />
                      <Text style={styles.directionsBtnText}>Directions</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </GlassCard>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },

  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: 16 },
  backBtn:   { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.bgSecondary, borderWidth: 1, borderColor: Colors.cardBorder, alignItems: 'center', justifyContent: 'center' },
  pageTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700' },
  eventInfo: { paddingHorizontal: Spacing.md, marginBottom: 12 },
  eventName: { color: Colors.textPrimary, fontSize: 20, fontWeight: '800' },
  eventSub:  { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },

  daySelectorWrap: { maxHeight: 76 },
  daySelector: { paddingHorizontal: Spacing.md, gap: 8, paddingVertical: 8, paddingBottom: 12 },
  dayPill: {
    borderRadius: Radius.pill, paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: Colors.bgSecondary, borderWidth: 1, borderColor: Colors.cardBorder,
    alignItems: 'center',
  },
  dayPillActive:    { backgroundColor: Colors.limeDim, borderColor: Colors.lime + '60' },
  dayPillText:      { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
  dayPillTextActive: { color: Colors.lime },
  dayPillDate:      { color: Colors.textMuted, fontSize: 10, marginTop: 2 },
  dayPillDateActive: { color: Colors.lime + 'AA' },

  scroll: { padding: Spacing.md },
  empty:  { color: Colors.textSecondary, textAlign: 'center', paddingVertical: 12 },

  timelineItem: { flexDirection: 'row', marginBottom: 14 },
  timelineLeft: { width: 44, alignItems: 'center', paddingTop: 2 },
  typeDot:      { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  timelineLine: { flex: 1, width: 1.5, backgroundColor: Colors.cardBorder, marginTop: 6 },

  itemCard:   { flex: 1, marginLeft: 10 },
  itemHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  itemMeta:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemTypeLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  timePill:   { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  timeText:   { fontSize: 11, fontWeight: '600' },

  itemTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 6 },
  itemDesc:  { color: Colors.textSecondary, fontSize: 13, lineHeight: 18, marginBottom: 10 },
  itemPhoto: { width: '100%', height: 140, borderRadius: Radius.md, marginBottom: 10 },

  itemFooter:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  locationRow:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText:   { color: Colors.textSecondary, fontSize: 12 },
  directionsBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  directionsBtnText: { color: Colors.lime, fontSize: 12, fontWeight: '600' },
});
