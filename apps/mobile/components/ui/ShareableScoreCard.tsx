// TODO: Install react-native-view-shot to enable score card sharing:
//   npx expo install react-native-view-shot
// Also install expo-file-system if not present:
//   npx expo install expo-file-system

import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share, Platform } from 'react-native';
import { Colors } from '../../constants/theme';

interface ScoreCardProps {
  playerName: string;
  courseName: string;
  date: string;
  scores: Array<{ hole: number; par: number; strokes: number }>;
  handicap?: number;
}

function getScoreColor(strokes: number, par: number) {
  const diff = strokes - par;
  if (strokes === 1) return Colors.teal;
  if (diff <= -2) return Colors.teal;
  if (diff === -1) return Colors.gold;
  if (diff === 0) return Colors.textPrimary;
  if (diff === 1) return Colors.scoreBogey;
  return Colors.scoreDouble;
}

export default function ShareableScoreCard({ playerName, courseName, date, scores, handicap }: ScoreCardProps) {
  const cardRef = useRef<View>(null);
  const total = scores.reduce((s, h) => s + h.strokes, 0);
  const totalPar = scores.reduce((s, h) => s + h.par, 0);
  const diff = total - totalPar;
  const birdies = scores.filter(s => s.strokes === s.par - 1).length;
  const eagles = scores.filter(s => s.strokes <= s.par - 2).length;

  const handleShare = async () => {
    try {
      // TODO: Uncomment after installing react-native-view-shot:
      // const { captureRef } = await import('react-native-view-shot');
      // const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      // await Share.share({ url: uri, message: `Shot ${total} (${diff > 0 ? '+' : ''}${diff}) at ${courseName} — The Caddy 🏌️` });

      // Fallback: share as text until react-native-view-shot is installed
      await Share.share({
        message: `Shot ${total} (${diff > 0 ? '+' : ''}${diff === 0 ? 'E' : diff}) at ${courseName} on ${date} — The Caddy 🏌️`,
      });
    } catch (e) {
      console.log('Share error', e);
    }
  };

  return (
    <View>
      <View ref={cardRef} style={styles.card} collapsable={false}>
        <View style={styles.header}>
          <Text style={styles.brand}>THE CADDY</Text>
          <Text style={styles.course}>{courseName}</Text>
          <Text style={styles.date}>{date}</Text>
        </View>

        <View style={styles.playerRow}>
          <Text style={styles.playerName}>{playerName}</Text>
          {handicap != null && <Text style={styles.hcp}>HCP {handicap}</Text>}
          <Text style={[styles.totalScore, { color: diff <= 0 ? Colors.gold : Colors.scoreDouble }]}>
            {diff > 0 ? '+' : ''}{diff === 0 ? 'E' : diff}
          </Text>
        </View>

        <View style={styles.grid}>
          {/* Front 9 */}
          <View style={styles.gridRow}>
            {scores.slice(0, 9).map(s => (
              <View key={s.hole} style={[styles.cell, { backgroundColor: getScoreColor(s.strokes, s.par) + '22' }]}>
                <Text style={styles.cellHole}>{s.hole}</Text>
                <Text style={[styles.cellScore, { color: getScoreColor(s.strokes, s.par) }]}>{s.strokes}</Text>
              </View>
            ))}
          </View>
          {/* Back 9 */}
          <View style={styles.gridRow}>
            {scores.slice(9).map(s => (
              <View key={s.hole} style={[styles.cell, { backgroundColor: getScoreColor(s.strokes, s.par) + '22' }]}>
                <Text style={styles.cellHole}>{s.hole}</Text>
                <Text style={[styles.cellScore, { color: getScoreColor(s.strokes, s.par) }]}>{s.strokes}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.summary}>
          {eagles > 0 && <Text style={[styles.summaryItem, { color: Colors.teal }]}>🦅 {eagles} Eagle{eagles > 1 ? 's' : ''}</Text>}
          {birdies > 0 && <Text style={[styles.summaryItem, { color: Colors.gold }]}>🐦 {birdies} Birdie{birdies > 1 ? 's' : ''}</Text>}
          <Text style={styles.summaryItem}>Total: {total} ({diff > 0 ? '+' : ''}{diff === 0 ? 'E' : diff})</Text>
        </View>

        <Text style={styles.watermark}>The Caddy</Text>
      </View>

      <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
        <Text style={styles.shareBtnText}>Share Score Card</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.bg, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border, margin: 16 },
  header: { alignItems: 'center', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingBottom: 12 },
  brand: { fontFamily: 'CormorantGaramond_700Bold', fontSize: 14, color: Colors.gold, letterSpacing: 4 },
  course: { fontFamily: 'CormorantGaramond_600SemiBold', fontSize: 20, color: Colors.textPrimary, marginTop: 4 },
  date: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  playerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 },
  playerName: { fontFamily: 'DMSans_500Medium', fontSize: 16, color: Colors.textPrimary, flex: 1 },
  hcp: { fontFamily: 'DMMono_400Regular', fontSize: 12, color: Colors.textSecondary, backgroundColor: Colors.bgTertiary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  totalScore: { fontFamily: 'DMMono_400Regular', fontSize: 28, fontWeight: '700' },
  grid: { gap: 6 },
  gridRow: { flexDirection: 'row', gap: 3 },
  cell: { flex: 1, borderRadius: 6, padding: 4, alignItems: 'center' },
  cellHole: { fontFamily: 'DMMono_400Regular', fontSize: 9, color: Colors.textMuted },
  cellScore: { fontFamily: 'DMMono_400Regular', fontSize: 14, fontWeight: '700' },
  summary: { flexDirection: 'row', gap: 12, marginTop: 16, justifyContent: 'center' },
  summaryItem: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: Colors.textSecondary },
  watermark: { fontFamily: 'CormorantGaramond_600SemiBold', fontSize: 10, color: Colors.textMuted, textAlign: 'right', marginTop: 12, letterSpacing: 2 },
  shareBtn: { backgroundColor: Colors.bgSecondary, borderWidth: 1, borderColor: Colors.gold, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 24, alignItems: 'center', marginHorizontal: 16 },
  shareBtnText: { fontFamily: 'DMSans_500Medium', fontSize: 14, color: Colors.gold },
});
