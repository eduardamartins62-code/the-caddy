import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';

const BADGE_ICONS: Record<string, string> = {
  FIRST_ROUND: 'golf',
  FIRST_BIRDIE: 'leaf',
  EAGLE_SCOUT: 'eye',
  ACE: 'star',
  TEN_ROUNDS: 'ribbon',
  FIFTY_ROUNDS: 'medal',
  BIRDIE_MACHINE: 'flash',
  GLOBE_TROTTER: 'globe',
  SOCIAL_BUTTERFLY: 'heart',
  CHAMPION: 'trophy',
};

interface Badge {
  type: string;
  name: string;
  description: string;
  earned: { earnedAt: string } | null;
}

export default function BadgeGrid({ userId }: { userId: string }) {
  const [badges, setBadges] = React.useState<Badge[]>([]);
  const [selected, setSelected] = React.useState<Badge | null>(null);

  React.useEffect(() => {
    fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/badges/${userId}`)
      .then(r => r.json())
      .then(data => Array.isArray(data) && setBadges(data))
      .catch(() => {});
  }, [userId]);

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {badges.map(badge => (
          <TouchableOpacity key={badge.type} style={styles.badge} onPress={() => setSelected(badge)}>
            <View style={[styles.iconWrap, badge.earned ? styles.iconEarned : styles.iconLocked]}>
              <Ionicons
                name={(BADGE_ICONS[badge.type] || 'ribbon') as any}
                size={20}
                color={badge.earned ? Colors.gold : Colors.textMuted}
              />
              {!badge.earned && (
                <View style={styles.lockOverlay}>
                  <Ionicons name="lock-closed" size={10} color={Colors.textMuted} />
                </View>
              )}
            </View>
            <Text style={[styles.label, !badge.earned && styles.labelLocked]} numberOfLines={1}>
              {badge.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <TouchableOpacity style={styles.overlay} onPress={() => setSelected(null)}>
          <View style={styles.modal}>
            {selected && (
              <>
                <View style={[styles.modalIcon, selected.earned ? styles.iconEarned : styles.iconLocked]}>
                  <Ionicons name={(BADGE_ICONS[selected.type] || 'ribbon') as any} size={36} color={selected.earned ? Colors.gold : Colors.textMuted} />
                </View>
                <Text style={styles.modalTitle}>{selected.name}</Text>
                <Text style={styles.modalDesc}>{selected.description}</Text>
                {selected.earned ? (
                  <Text style={styles.modalDate}>
                    Earned {new Date(selected.earned.earnedAt).toLocaleDateString()}
                  </Text>
                ) : (
                  <Text style={styles.modalLocked}>Not yet earned</Text>
                )}
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingVertical: 12 },
  badge: { alignItems: 'center', width: 64 },
  iconWrap: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  iconEarned: { backgroundColor: Colors.goldDim, borderWidth: 1, borderColor: Colors.border },
  iconLocked: { backgroundColor: Colors.bgTertiary },
  lockOverlay: { position: 'absolute', bottom: 2, right: 2, backgroundColor: Colors.bgTertiary, borderRadius: 8, padding: 2 },
  label: { fontFamily: 'DMSans_400Regular', fontSize: 10, color: Colors.textSecondary, textAlign: 'center' },
  labelLocked: { color: Colors.textMuted },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' },
  modal: { backgroundColor: Colors.bgSecondary, borderRadius: 20, padding: 32, alignItems: 'center', width: 280, borderWidth: 1, borderColor: Colors.border },
  modalIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  modalTitle: { fontFamily: 'CormorantGaramond_600SemiBold', fontSize: 22, color: Colors.textPrimary, marginBottom: 8 },
  modalDesc: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginBottom: 12 },
  modalDate: { fontFamily: 'DMMono_400Regular', fontSize: 12, color: Colors.gold },
  modalLocked: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: Colors.textMuted },
});
