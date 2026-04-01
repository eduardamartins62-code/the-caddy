import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/theme';
import { roundsApi } from '../../services/api';

export default function ActiveRoundBar() {
  const [activeRound, setActiveRound] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const check = async () => {
      try {
        const data = await roundsApi.getActive();
        setActiveRound(data);
      } catch { setActiveRound(null); }
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!activeRound) return null;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => router.push(`/round/${activeRound.round.id}` as any)}
      activeOpacity={0.9}
    >
      <View style={styles.info}>
        <Text style={styles.label}>Thru {activeRound.holesPlayed}</Text>
        <Text style={styles.label}>
          To Par {activeRound.toPar >= 0 ? '+' : ''}{activeRound.toPar}
        </Text>
        <Text style={styles.label}>Gross {activeRound.gross}</Text>
      </View>
      <TouchableOpacity
        style={styles.finishBtn}
        onPress={() => router.push(`/round/${activeRound.round.id}` as any)}
      >
        <Text style={styles.finishText}>Finish Round</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.bgSecondary,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  info: { flexDirection: 'row', gap: 20 },
  label: { color: Colors.textPrimary, fontSize: 13, fontWeight: '600' },
  finishBtn: {
    backgroundColor: Colors.gold,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  finishText: { color: Colors.bg, fontSize: 13, fontWeight: '700' },
});
