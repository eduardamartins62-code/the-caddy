import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  Image, ScrollView, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import {
  Image as ImageIcon, Flag, MapPin, CircleX, Camera, FileText, Trophy,
} from 'lucide-react-native';
import GradientButton from '../../components/ui/GradientButton';
import { Colors, Radius, Spacing } from '../../constants/theme';
import { API_BASE } from '../../constants/api';

const POST_TYPES = [
  { id: 'post',  Icon: FileText,  label: 'Moment' },
  { id: 'score', Icon: Trophy,    label: 'Score'  },
  { id: 'photo', Icon: Camera,    label: 'Photo'  },
];

export default function CreateScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [activeType, setActiveType] = useState('post');
  const [content, setContent] = useState('');
  const [courseTag, setCourseTag] = useState('');
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function pickMedia() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.8,
    });
    if (!result.canceled) setMediaUri(result.assets[0].uri);
  }

  async function handlePost() {
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const formData = new FormData();
      formData.append('content', content.trim());
      if (courseTag) formData.append('courseTag', courseTag);
      if (mediaUri) {
        const filename = mediaUri.split('/').pop()!;
        const type = filename.endsWith('.mp4') || filename.endsWith('.mov') ? 'video/mp4' : 'image/jpeg';
        formData.append('media', { uri: mediaUri, name: filename, type } as unknown as Blob);
      }
      await fetch(`${API_BASE}/posts`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      setContent(''); setCourseTag(''); setMediaUri(null);
      Alert.alert('Posted!', 'Your post is live.', [{ text: 'OK', onPress: () => router.push('/(tabs)/social') }]);
    } catch {
      Alert.alert('Error', 'Failed to post. Try again.');
    } finally { setSubmitting(false); }
  }

  const placeholder = activeType === 'score'
    ? 'Share your round score, highlight holes, or brag a little...'
    : activeType === 'photo'
    ? 'Add a caption to your photo...'
    : "What's happening on the course? Share a tip, moment, or story...";

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Create</Text>
        <GradientButton
          label="Share"
          onPress={handlePost}
          loading={submitting}
          disabled={!content.trim()}
          size="sm"
        />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: 120 }]}>
        {/* Type selector */}
        <View style={styles.typeRow}>
          {POST_TYPES.map(type => {
            const active = activeType === type.id;
            return (
              <TouchableOpacity
                key={type.id}
                onPress={() => setActiveType(type.id)}
                style={[styles.typeBtn, active && styles.typeBtnActive]}
                activeOpacity={0.75}
              >
                {active ? (
                  <LinearGradient colors={['#C9F31D', '#7B61FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.typeGrad}>
                    <type.Icon size={16} color={Colors.bg} strokeWidth={2.5} />
                    <Text style={[styles.typeLabel, { color: Colors.bg }]}>{type.label}</Text>
                  </LinearGradient>
                ) : (
                  <View style={styles.typeInner}>
                    <type.Icon size={16} color={Colors.textSecondary} strokeWidth={2} />
                    <Text style={styles.typeLabel}>{type.label}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Media picker / preview */}
        {mediaUri ? (
          <View style={styles.mediaWrap}>
            <Image source={{ uri: mediaUri }} style={styles.mediaImg} resizeMode="cover" />
            <TouchableOpacity style={styles.removeMedia} onPress={() => setMediaUri(null)}>
              <CircleX size={28} color={Colors.error} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.mediaPicker} onPress={pickMedia} activeOpacity={0.75}>
            <View style={styles.mediaPickerIcon}>
              <ImageIcon size={28} color={Colors.textMuted} strokeWidth={1.5} />
            </View>
            <Text style={styles.mediaPickerTitle}>Add photo or video</Text>
            <Text style={styles.mediaPickerSub}>Tap to choose from your library</Text>
          </TouchableOpacity>
        )}

        {/* Content text box */}
        <View style={styles.textBox}>
          <TextInput
            style={styles.textInput}
            placeholder={placeholder}
            placeholderTextColor={Colors.textMuted}
            value={content}
            onChangeText={setContent}
            multiline
            maxLength={500}
          />
          <Text style={styles.charCount}>{content.length}/500</Text>
        </View>

        {/* Tags section */}
        <View style={styles.tagsSection}>
          <View style={styles.tagInputRow}>
            <View style={[styles.tagIcon, { backgroundColor: Colors.limeDim }]}>
              <Flag size={14} color={Colors.lime} strokeWidth={2} />
            </View>
            <TextInput
              style={styles.tagInput}
              placeholder="Tag a course"
              placeholderTextColor={Colors.textSecondary}
              value={courseTag}
              onChangeText={setCourseTag}
            />
          </View>
          <View style={styles.tagInputRow}>
            <View style={[styles.tagIcon, { backgroundColor: Colors.purpleDim }]}>
              <MapPin size={14} color={Colors.purple} strokeWidth={2} />
            </View>
            <TextInput
              style={styles.tagInput}
              placeholder="Add location"
              placeholderTextColor={Colors.textSecondary}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.cardBorder,
  },
  title:   { color: Colors.textPrimary, fontSize: 20, fontWeight: '700' },
  content: { padding: Spacing.md },

  typeRow:     { flexDirection: 'row', gap: 8, marginBottom: 20 },
  typeBtn:     {
    flex: 1, borderRadius: Radius.pill, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.bgSecondary,
  },
  typeBtnActive: { borderColor: 'transparent' },
  typeGrad:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11 },
  typeInner:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11 },
  typeLabel:   { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },

  mediaPicker: {
    height: 160, borderRadius: Radius.xl, borderWidth: 1.5, borderStyle: 'dashed',
    borderColor: Colors.cardBorder, alignItems: 'center', justifyContent: 'center',
    gap: 6, marginBottom: 20, backgroundColor: Colors.bgSecondary,
  },
  mediaPickerIcon:  {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.bgTertiary, alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  mediaPickerTitle: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
  mediaPickerSub:   { color: Colors.textMuted, fontSize: 12 },

  mediaWrap:   { marginBottom: 20, position: 'relative' },
  mediaImg:    { width: '100%', height: 240, borderRadius: Radius.xl },
  removeMedia: { position: 'absolute', top: 10, right: 10 },

  textBox: {
    backgroundColor: Colors.bgSecondary, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.cardBorder,
    padding: 14, marginBottom: 16,
  },
  textInput:  {
    color: Colors.textPrimary, fontSize: 15, lineHeight: 22,
    minHeight: 100, textAlignVertical: 'top',
  },
  charCount:  { color: Colors.textMuted, fontSize: 11, textAlign: 'right', marginTop: 8 },

  tagsSection:  { gap: 10 },
  tagInputRow:  {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.bgSecondary, borderRadius: Radius.lg,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  tagIcon:  { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  tagInput: { flex: 1, color: Colors.textPrimary, fontSize: 14 },
});
