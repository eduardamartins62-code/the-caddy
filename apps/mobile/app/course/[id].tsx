import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Modal, Alert
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { Colors, Gradients } from '../../constants/theme';
import WeatherWidget from '../../components/ui/WeatherWidget';
import * as SecureStore from 'expo-secure-store';

export default function CourseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [course, setCourse] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [difficulty, setDifficulty] = useState(0);
  const [wouldPlay, setWouldPlay] = useState(true);

  const apiUrl = process.env.EXPO_PUBLIC_API_URL;

  React.useEffect(() => {
    fetch(`${apiUrl}/api/courses/${id}`).then(r => r.json()).then(d => setCourse(d)).catch(() => {});
    fetch(`${apiUrl}/api/reviews/course/${id}`).then(r => r.json()).then(d => {
      setReviews(d.reviews || []);
      setAvgRating(d.averageRating);
    }).catch(() => {});
  }, [id]);

  const submitReview = async () => {
    const token = await SecureStore.getItemAsync('auth_token');
    try {
      await fetch(`${apiUrl}/api/reviews/course/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rating, review: reviewText, difficulty, wouldPlayAgain: wouldPlay }),
      });
      setShowReviewModal(false);
      // Refresh reviews
      fetch(`${apiUrl}/api/reviews/course/${id}`).then(r => r.json()).then(d => {
        setReviews(d.reviews || []);
        setAvgRating(d.averageRating);
      });
    } catch { Alert.alert('Error', 'Failed to submit review'); }
  };

  const openTeeTimes = () => {
    if (course) WebBrowser.openBrowserAsync(
      `https://www.golfnow.com/tee-times/search#search/facility-name=${encodeURIComponent(course.name)}`
    );
  };

  if (!course) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: Colors.textSecondary }}>Loading...</Text>
    </SafeAreaView>
  );

  const today = new Date().toISOString().split('T')[0];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ScrollView>
        {/* Hero image */}
        <View style={styles.heroWrap}>
          {course.photoUrl ? (
            <Image source={course.photoUrl} style={styles.heroImage} contentFit="cover" />
          ) : (
            <LinearGradient colors={Gradients.hero as any} style={styles.heroImage} />
          )}
          <LinearGradient colors={Gradients.cardOverlay as any} style={StyleSheet.absoluteFill} />
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.heroContent}>
            <Text style={styles.courseName}>{course.name}</Text>
            <Text style={styles.location}>{[course.city, course.state].filter(Boolean).join(', ')}</Text>
          </View>
        </View>

        <View style={styles.content}>
          {/* Stats row */}
          <View style={styles.statsRow}>
            {course.par && <View style={styles.statPill}><Text style={styles.statLabel}>Par</Text><Text style={styles.statValue}>{course.par}</Text></View>}
            {course.courseRating && <View style={styles.statPill}><Text style={styles.statLabel}>Rating</Text><Text style={styles.statValue}>{course.courseRating}</Text></View>}
            {course.courseSlope && <View style={styles.statPill}><Text style={styles.statLabel}>Slope</Text><Text style={styles.statValue}>{course.courseSlope}</Text></View>}
            {avgRating && <View style={styles.statPill}><Text style={styles.statLabel}>⭐</Text><Text style={styles.statValue}>{avgRating.toFixed(1)}</Text></View>}
          </View>

          {/* Weather */}
          {course.latitude && course.longitude && (
            <WeatherWidget latitude={course.latitude} longitude={course.longitude} date={today} />
          )}

          {/* Action buttons */}
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.teeTimeBtn} onPress={openTeeTimes}>
              <Ionicons name="calendar-outline" size={16} color={Colors.teal} />
              <Text style={styles.teeTimeText}>Book Tee Time</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.reviewBtn} onPress={() => setShowReviewModal(true)}>
              <Ionicons name="star-outline" size={16} color={Colors.gold} />
              <Text style={styles.reviewBtnText}>Write a Review</Text>
            </TouchableOpacity>
          </View>

          {/* Reviews */}
          <Text style={styles.sectionTitle}>Reviews ({reviews.length})</Text>
          {reviews.map(r => (
            <View key={r.id} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <Text style={styles.reviewerName}>{r.user?.name}</Text>
                <Text style={styles.reviewRating}>{'⭐'.repeat(r.rating)}</Text>
                <Text style={styles.reviewDate}>{new Date(r.createdAt).toLocaleDateString()}</Text>
              </View>
              {r.review && <Text style={styles.reviewText}>{r.review}</Text>}
              {r.wouldPlayAgain && <Text style={styles.wouldPlay}>Would play again ✓</Text>}
            </View>
          ))}
          {reviews.length === 0 && (
            <Text style={styles.emptyText}>No reviews yet. Be the first!</Text>
          )}
        </View>
      </ScrollView>

      {/* Review Modal */}
      <Modal visible={showReviewModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Write a Review</Text>
            <Text style={styles.modalLabel}>Rating</Text>
            <View style={styles.starsRow}>
              {[1,2,3,4,5].map(n => (
                <TouchableOpacity key={n} onPress={() => setRating(n)}>
                  <Text style={{ fontSize: 28 }}>{n <= rating ? '⭐' : '☆'}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.reviewInput}
              placeholder="Your review (optional)"
              placeholderTextColor={Colors.textMuted}
              multiline
              value={reviewText}
              onChangeText={setReviewText}
              maxLength={280}
            />
            <View style={styles.toggleRow}>
              <Text style={styles.modalLabel}>Would play again?</Text>
              <TouchableOpacity onPress={() => setWouldPlay(!wouldPlay)}>
                <Ionicons name={wouldPlay ? 'checkbox' : 'square-outline'} size={24} color={Colors.gold} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowReviewModal(false)}>
                <Text style={{ color: Colors.textSecondary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={submitReview}>
                <LinearGradient colors={Gradients.gold as any} style={styles.submitGradient}>
                  <Text style={styles.submitText}>Submit</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  heroWrap: { height: 240, position: 'relative' },
  heroImage: { width: '100%', height: '100%' },
  backBtn: { position: 'absolute', top: 16, left: 16, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 20, padding: 8 },
  heroContent: { position: 'absolute', bottom: 16, left: 20 },
  courseName: { fontFamily: 'CormorantGaramond_700Bold', fontSize: 26, color: Colors.textPrimary },
  location: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  content: { padding: 20 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statPill: { backgroundColor: Colors.bgSecondary, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  statLabel: { fontFamily: 'DMSans_400Regular', fontSize: 10, color: Colors.textMuted },
  statValue: { fontFamily: 'DMMono_400Regular', fontSize: 16, color: Colors.textPrimary },
  actionsRow: { flexDirection: 'row', gap: 12, marginVertical: 16 },
  teeTimeBtn: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgSecondary, borderWidth: 1, borderColor: Colors.teal, borderRadius: 999, paddingVertical: 10 },
  teeTimeText: { fontFamily: 'DMSans_500Medium', fontSize: 13, color: Colors.teal },
  reviewBtn: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgSecondary, borderWidth: 1, borderColor: Colors.gold, borderRadius: 999, paddingVertical: 10 },
  reviewBtnText: { fontFamily: 'DMSans_500Medium', fontSize: 13, color: Colors.gold },
  sectionTitle: { fontFamily: 'CormorantGaramond_600SemiBold', fontSize: 20, color: Colors.textPrimary, marginBottom: 12 },
  reviewCard: { backgroundColor: Colors.bgSecondary, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  reviewerName: { fontFamily: 'DMSans_500Medium', fontSize: 14, color: Colors.textPrimary, flex: 1 },
  reviewRating: { fontSize: 12 },
  reviewDate: { fontFamily: 'DMSans_400Regular', fontSize: 11, color: Colors.textMuted },
  reviewText: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  wouldPlay: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: Colors.teal, marginTop: 6 },
  emptyText: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: Colors.textMuted, textAlign: 'center', paddingVertical: 24 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: { backgroundColor: Colors.bgSecondary, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28, borderWidth: 1, borderColor: Colors.border },
  modalTitle: { fontFamily: 'CormorantGaramond_600SemiBold', fontSize: 22, color: Colors.textPrimary, marginBottom: 20, textAlign: 'center' },
  modalLabel: { fontFamily: 'DMSans_500Medium', fontSize: 13, color: Colors.textSecondary, marginBottom: 8 },
  starsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  reviewInput: { backgroundColor: Colors.bgTertiary, borderRadius: 12, padding: 14, color: Colors.textPrimary, fontFamily: 'DMSans_400Regular', minHeight: 80, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  modalBtns: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, backgroundColor: Colors.bgTertiary, borderRadius: 999 },
  submitBtn: { flex: 1, borderRadius: 999, overflow: 'hidden' },
  submitGradient: { paddingVertical: 14, alignItems: 'center' },
  submitText: { fontFamily: 'DMSans_500Medium', fontSize: 15, color: Colors.bg },
});
