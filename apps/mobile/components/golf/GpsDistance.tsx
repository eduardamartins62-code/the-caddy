import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';
import { Colors, Radius, Spacing } from '../../constants/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GpsDistanceProps {
  holeCoordinates?: {
    front?:  { lat: number; lng: number };
    center?: { lat: number; lng: number };
    back?:   { lat: number; lng: number };
  };
}

// ─── Haversine formula (meters → yards) ──────────────────────────────────────

function haversineYards(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R  = 6371000; // meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a  =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c  = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 1.0936); // convert meters to yards
}

// ─── Component ────────────────────────────────────────────────────────────────

type PermState = 'loading' | 'denied' | 'granted';

export default function GpsDistance({ holeCoordinates }: GpsDistanceProps) {
  const [permState, setPermState] = useState<PermState>('loading');
  const [position, setPosition]   = useState<{ lat: number; lng: number } | null>(null);
  const subRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (cancelled) return;

      if (status !== 'granted') {
        setPermState('denied');
        return;
      }

      setPermState('granted');

      subRef.current = await Location.watchPositionAsync(
        {
          accuracy:     Location.Accuracy.High,
          timeInterval: 3000,
          distanceInterval: 1,
        },
        (loc) => {
          if (!cancelled) {
            setPosition({
              lat: loc.coords.latitude,
              lng: loc.coords.longitude,
            });
          }
        },
      );
    })();

    return () => {
      cancelled = true;
      subRef.current?.remove();
    };
  }, []);

  // ─── No coordinates provided ──────────────────────────────────────────────
  if (!holeCoordinates || (
    !holeCoordinates.front &&
    !holeCoordinates.center &&
    !holeCoordinates.back
  )) {
    return (
      <View style={styles.row}>
        <Text style={styles.naText}>GPS N/A</Text>
      </View>
    );
  }

  // ─── Permission denied ────────────────────────────────────────────────────
  if (permState === 'denied') {
    return (
      <View style={styles.row}>
        <Text style={styles.offText}>📍 Location off</Text>
      </View>
    );
  }

  // ─── Still acquiring GPS / permission ─────────────────────────────────────
  if (permState === 'loading' || !position) {
    return (
      <View style={styles.row}>
        <ActivityIndicator size="small" color={Colors.lime} />
      </View>
    );
  }

  // ─── Compute distances ────────────────────────────────────────────────────
  const front = holeCoordinates.front
    ? haversineYards(position.lat, position.lng, holeCoordinates.front.lat, holeCoordinates.front.lng)
    : null;

  const center = holeCoordinates.center
    ? haversineYards(position.lat, position.lng, holeCoordinates.center.lat, holeCoordinates.center.lng)
    : null;

  const back = holeCoordinates.back
    ? haversineYards(position.lat, position.lng, holeCoordinates.back.lat, holeCoordinates.back.lng)
    : null;

  const pills: { label: string; yards: number | null; highlight: boolean }[] = [
    { label: 'FRONT',  yards: front,  highlight: false },
    { label: 'CENTER', yards: center, highlight: true  },
    { label: 'BACK',   yards: back,   highlight: false },
  ];

  return (
    <View style={styles.row}>
      {pills.map((pill) =>
        pill.yards !== null ? (
          <View
            key={pill.label}
            style={[styles.pill, pill.highlight && styles.pillHighlight]}
          >
            <Text style={[styles.pillLabel, pill.highlight && styles.pillLabelHighlight]}>
              {pill.label}
            </Text>
            <Text style={[styles.pillYards, pill.highlight && styles.pillYardsHighlight]}>
              {pill.yards}y
            </Text>
          </View>
        ) : null,
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },

  naText: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },

  offText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },

  // Base pill
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },

  // Highlighted (center) pill
  pillHighlight: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderColor: Colors.lime,
    backgroundColor: Colors.limeDim,
  },

  pillLabel: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  pillLabelHighlight: {
    color: Colors.lime,
  },

  pillYards: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  pillYardsHighlight: {
    fontSize: 17,
    color: Colors.lime,
  },
});
