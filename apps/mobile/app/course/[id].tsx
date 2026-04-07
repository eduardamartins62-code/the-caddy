import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Modal, Alert, ActivityIndicator, Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Gradients, Radius, Spacing } from '../../constants/theme';
import { API_BASE } from '../../constants/api';
import WeatherWidget from '../../components/ui/WeatherWidget';
import * as SecureStore from 'expo-secure-store';

async function getToken(): Promise<string | null> {
  try { return await SecureStore.getItemAsync('auth_token'); } catch { return null; }
}

export default function CourseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [course, setCourse]           = useState<any>(null);
  const [reviews, setReviews]         = useState<any[]>([]);
  const [avgRating, setAvgRating]     = useState<number | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [settingHome, setSettingHome] = useState(false);

  // Review modal state
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [rating, setRating]         = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [wouldPlay, setWouldPlay]   = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  async function loadCourse() {
    setLoading(true);
    setError(null);
    try {
      const [courseRes, reviewRes] = await Promise.all([
        fetch(`${API_BASE}/courses/${id}`),
        fetch(`${API_BASE}/courses/${id}/reviews`),
      ]);
      if (!courseRes.ok) throw new Error('Failed to load course');
      const courseData = await courseRes.json();
      setCourse(courseData?.data ?? courseData);
      if (reviewRes.ok) {
        const reviewData = await reviewRes.json();
        setReviews(reviewData?.reviews ?? reviewData ?? []);
        setAvgRating(reviewData?.averageRating ?? null);
      }
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load course');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) loadCourse();
  }, [id]);

  // Spec: "Set as Home Course" → PUT /api/users/me { homeCourseId: id }
  async function handleSetHomeCourse() {
    setSettingHome(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/users/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ homeCourseId: id }),
      });
      if (!res.ok) throw new Error('Failed to set home course');
      Alert.alert('Home Course Set', `${course?.name ?? 'Course'} is now your home course.`);
    } catch {
      Alert.alert('Error', 'Could not set home course. Please try again.');
    } finally {
      setSettingHome(false);
    }
  }

  // Spec: "Book a Tee Time" → GolfNow
  function openTeeTimes() {
    if (!course) return;
    Linking.openURL(
      `https://www.golfnow.com/tee-times/search#facility-name=${encodeURIComponent(course.name)}`
    );
  }

  async function submitReview() {
    if (rating === 0) { Alert.alert('Rating required', 'Please select a star rating.'); return; }
    setSubmitting(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/courses/${id}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rating, review: reviewText, wouldPlayAgain: wouldPlay }),
      });
      if (!res.ok) throw new Error('Failed to submit review');
      setShowReviewModal(false);
      setRating(0);
      setReviewText('');
      // Refresh reviews
      const reviewRes = await fetch(`${API_BASE}/courses/${id}/reviews`);
      if (reviewRes.ok) {
        const data = await reviewRes.json();
        setReviews(data?.reviews ?? data ?? []);
        setAvgRating(data?.averageRating ?? null);
      }
    } catch {
      Alert.alert('Error', 'Failed to submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Loading state ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.centerState}>
          <ActivityIndicator color={Colors.gold} size="large" />
          <Text style={styles.centerText}>Loading course...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Error state ──────────────────────────────────────────────────────────

  if (error || !course) {
    return (
      <SafeAreaView style={styles.screen}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.centerState}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
          <Text style={styles.errorTitle}>Could not load course</Text>
          <Text style={styles.centerText}>{error ?? 'Unknown error'}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadCourse}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Scorecard ────────────────────────────────────────────────────────────

  const scorecard = (() => {
    try { return typeof course.scorecard === 'string' ? JSON.parse(course.scorecard) : course.scorecard; }
    catch { return null; }
  })();

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero image */}
        <View style={styles.heroWrap}>
          {course.photoUrl ? (
            <Image source={course.photoUrl} style={styles.heroImage} contentFit="cover" />
          ) : (
            <LinearGradient colors={Gradients.hero as any} style={styles.heroImage} />
          )}
          <LinearGradient colors={Gradients.cardOverlay as any} style={StyleSheet.absoluteFill} />
          <TouchableOpacity style={styles.backBtnOverlay} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.heroContent}>
            <Text style={styles.courseName}>{course.name}</Text>
            {(course.city || course.state) && (
              <Text style={styles.location}>{[course.city, course.state].filter(Boolean).join(', ')}</Text>
            )}
          </View>
        </View>

        <View style={styles.content}>
          {/* Stats row: par + courseRating + slopeRating + avg star rating */}
          <View style={styles.statsRow}>
            {course.par != null && (
              <View style={styles.statPill}>
                <Text style={styles.statLabel}>Par</Text>
                <Text style={styles.statValue}>{course.par}</Text>
              </View>
            )}
            {(course.courseRating ?? course.rating) != null && (
              <View style={styles.statPill}>
                <Text style={styles.statLabel}>Rating</Text>
                <Text style={styles.statValue}>{(course.courseRating ?? course.rating).toFixed(1)}</Text>
              </View>
            )}
            {(course.slopeRating ?? course.courseSlope ?? course.slope) != null && (
              <View style={styles.statPill}>
                <Text style={styles.statLabel}>Slope</Text>
                <Text style={styles.statValue}>{course.slopeRating ?? course.courseSlope ?? course.slope}</Text>
              </View>
            )}
            {avgRating != null && (
              <View style={styles.statPill}>
                <Ionicons name="star" size={12} color={Colors.gold} />
                <Text style={styles.statValue}>{avgRating.toFixed(1)}</Text>
              </View>
            )}
          </View>

          {/* Weather widget — only if course has lat/lng */}
          {(course.latitude ?? course.lat) && (course.longitude ?? course.lng) && (
            <WeatherWidget
              latitude={course.latitude ?? course.lat}
              longitude={course.longitude ?? course.lng}
              date={today}
            />
          )}

          {/* Action buttons */}
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.teeTimeBtn} onPress={openTeeTimes}>
              <Ionicons name="calendar-outline" size={16} color={Colors.teal} />
              <Text style={styles.teeTimeText}>Book a Tee Time</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.homeBtn}
              onPress={handleSetHomeCourse}
              disabled={settingHome}
            >
              {settingHome ? (
                <ActivityIndicator size="small" color={Colors.gold} />
              ) : (
                <>
                  <Ionicons name="home-outline" size={16} color={Colors.gold} />
                  <Text style={styles.homeBtnText}>Set as Home Course</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Scorecard (from course.scorecard JSON) */}
          {scorecard && Array.isArray(scorecard) && scorecard.length > 0 && (
            <View style={styles.scorecardWrap}>
              <Text style={styles.sectionTitle}>Scorecard</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View>
                  {/* Header */}
                  <View style={styles.scorecardRow}>
                    <Text style={[styles.scorecardCell, styles.scorecardHeader]}>Hole</Text>
                    <Text style={[styles.scorecardCell, styles.scorecardHeader]}>Par</Text>
                    <Text style={[styles.scorecardCell, styles.scorecardHeader]}>Yds</Text>
                    <Text style={[styles.scorecardCell, styles.scorecardHeader]}>HCP</Text>
                  </View>
                  {scorecard.map((hole: any, i: number) => (
                    <View key={i} style={[styles.scorecardRow, i % 2 === 0 && styles.scorecardRowAlt]}>
                      <Text style={styles.scorecardCell}>{hole.hole ?? i + 1}</Text>
                      <Text style={styles.scorecardCell}>{hole.par ?? '–'}</Text>
                      <Text style={styles.scorecardCell}>{hole.yards ?? hole.yardage ?? '–'}</Text>
                      <Text style={styles.scorecardCell}>{hole.handicap ?? hole.hcp ?? '–'}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Write a Review button */}
          <TouchableOpacity style={styles.reviewBtn} onPress={() => setShowReviewModal(true)}>
            <Ionicons name="star-outline" size={16} color={Colors.gold} />
            <Text style={styles.reviewBtnText}>Write a Review</Text>
          </TouchableOpacity>

          {/* Reviews list */}
          <Text style={styles.sectionTitle}>Reviews ({reviews.length})</Text>
          {reviews.length === 0 ? (
            <Text style={styles.emptyText}>No reviews yet. Be the first!</Text>
          ) : (
            reviews.map(r => (
              <View key={r.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewerName}>{r.user?.name ?? 'Golfer'}</Text>
                  <View style={styles.starsRow}>
                    {[1,2,3,4,5].map(n => (
                      <Ionicons key={n} name={n <= r.rating ? 'star' : 'star-outline'} size={12} color={Colors.gold} />
                    ))}
                  </View>
                  <Text style={styles.reviewDate}>{new Date(r.createdAt).toLocaleDateString()}</Text>
                </View>
                {r.review ? <Text style={styles.reviewText}>{r.review}</Text> : null}
                {r.wouldPlayAgain && <Text style={styles.wouldPlay}>Would play again ✓</Text>}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Review Modal */}
      <Modal visible={showReviewModal} transparent animationType="slide" onRequestClose={() => setShowReviewModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Write a Review</Text>
            <Text style={styles.modalLabel}>Rating</Text>
            <View style={styles.starPickRow}>
              {[1,2,3,4,5].map(n => (
                <TouchableOpacity key={n} onPress={() => setRating(n)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                  <Ionicons name={n <= rating ? 'star' : 'star-outline'} size={32} color={Colors.gold} />
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
                <Text style={{ color: Colors.textSecondary, fontFamily: 'DMSans_400Regular' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={submitReview} disabled={submitting}>
                <LinearGradient colors={Gradients.gold as any} style={styles.submitGradient}>
                  {submitting
                    ? <ActivityIndicator color={Colors.bg} />
                    : <Text style={styles.submitText}>Submit</Text>}
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
  screen: { flex: 1, backgroundColor: Colors.bg },

  // States
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: Spacing.lg },
  centerText: { color: Colors.textSecondary, fontSize: 14, fontFamily: 'DMSans_400Regular', textAlign: 'center' },
  errorTitle: { color: Colors.textPrimary, fontSize: 18, fontFamily: 'CormorantGaramond_600SemiBold' },
  retryBtn: {
    backgroundColor: Colors.goldDim,
    borderRadius: Radius.pill,
    paddingHorizontal: 24, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.gold + '40',
    marginTop: 8,
  },
  retryText: { color: Colors.gold, fontSize: 14, fontFamily: 'DMSans_500Medium' },
  backBtn: { padding: Spacing.md },

  // Hero
  heroWrap: { height: 240, position: 'relative' },
  heroImage: { width: '100%', height: '100%' },
  backBtnOverlay: {
    position: 'absolute', top: 16, left: 16,
    backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 20, padding: 8,
  },
  heroContent: { position: 'absolute', bottom: 16, left: 20 },
  courseName: { fontFamily: 'CormorantGaramond_700Bold', fontSize: 26, color: Colors.textPrimary },
  location: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: Colors.textSecondary, marginTop: 4 },

  // Content
  content: { padding: Spacing.md },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  statPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.bgSecondary, borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: Colors.border,
  },
  statLabel: { fontFamily: 'DMSans_400Regular', fontSize: 10, color: Colors.textMuted },
  statValue: { fontFamily: 'DMMono_400Regular', fontSize: 15, color: Colors.textPrimary },

  actionsRow: { flexDirection: 'row', gap: 10, marginVertical: 16, flexWrap: 'wrap' },
  teeTimeBtn: {
    flex: 1, minWidth: 140,
    flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.bgSecondary, borderWidth: 1, borderColor: Colors.teal,
    borderRadius: 999, paddingVertical: 10,
  },
  teeTimeText: { fontFamily: 'DMSans_500Medium', fontSize: 13, color: Colors.teal },
  homeBtn: {
    flex: 1, minWidth: 140,
    flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.bgSecondary, borderWidth: 1, borderColor: Colors.gold,
    borderRadius: 999, paddingVertical: 10,
  },
  homeBtnText: { fontFamily: 'DMSans_500Medium', fontSize: 13, color: Colors.gold },

  // Scorecard
  scorecardWrap: { marginBottom: 16 },
  sectionTitle: {
    fontFamily: 'CormorantGaramond_600SemiBold', fontSize: 20,
    color: Colors.textPrimary, marginBottom: 12, marginTop: 8,
  },
  scorecardRow: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  scorecardRowAlt: { backgroundColor: Colors.bgSecondary },
  scorecardCell: {
    width: 52, paddingHorizontal: 6, paddingVertical: 8,
    color: Colors.textPrimary, fontSize: 13, fontFamily: 'DMMono_400Regular',
    textAlign: 'center',
  },
  scorecardHeader: { color: Colors.textMuted, fontFamily: 'DMSans_500Medium', fontWeight: '600', fontSize: 11 },

  // Review button
  reviewBtn: {
    flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.bgSecondary, borderWidth: 1, borderColor: Colors.gold,
    borderRadius: 999, paddingVertical: 12, marginBottom: 16,
  },
  reviewBtnText: { fontFamily: 'DMSans_500Medium', fontSize: 13, color: Colors.gold },

  // Reviews
  starsRow: { flexDirection: 'row', gap: 2 },
  reviewCard: {
    backgroundColor: Colors.bgSecondary, borderRadius: 12, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: Colors.border,
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  reviewerName: { fontFamily: 'DMSans_500Medium', fontSize: 14, color: Colors.textPrimary, flex: 1 },
  reviewDate: { fontFamily: 'DMSans_400Regular', fontSize: 11, color: Colors.textMuted },
  reviewText: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  wouldPlay: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: Colors.teal, marginTop: 6 },
  emptyText: {
    fontFamily: 'DMSans_400Regular', fontSize: 14, color: Colors.textMuted,
    textAlign: 'center', paddingVertical: 24,
  },

  // Review modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: Colors.bgSecondary, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 28, borderWidth: 1, borderColor: Colors.border,
  },
  modalTitle: {
    fontFamily: 'CormorantGaramond_600SemiBold', fontSize: 22,
    color: Colors.textPrimary, marginBottom: 20, textAlign: 'center',
  },
  modalLabel: { fontFamily: 'DMSans_500Medium', fontSize: 13, color: Colors.textSecondary, marginBottom: 8 },
  starPickRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  reviewInput: {
    backgroundColor: Colors.bgTertiary, borderRadius: 12, padding: 14,
    color: Colors.textPrimary, fontFamily: 'DMSans_400Regular',
    minHeight: 80, marginBottom: 16, borderWidth: 1, borderColor: Colors.border,
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  modalBtns: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, backgroundColor: Colors.bgTertiary, borderRadius: 999 },
  submitBtn: { flex: 1, borderRadius: 999, overflow: 'hidden' },
  submitGradient: { paddingVertical: 14, alignItems: 'center' },
  submitText: { fontFamily: 'DMSans_500Medium', fontSize: 15, color: Colors.bg },
});
