import React from 'react';
import { ScrollView, Text, View, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';

export default function PrivacyScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Privacy Policy</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.updated}>Last updated: March 2026</Text>

        <Text style={styles.h2}>Information We Collect</Text>
        <Text style={styles.body}>We collect information you provide directly: name, email, phone number, golf handicap, profile photo, and activity within The Caddy platform (rounds, scores, posts, messages).</Text>

        <Text style={styles.h2}>How We Use Your Information</Text>
        <Text style={styles.body}>We use your information to: provide and improve the app, personalize your experience, send notifications you've enabled, calculate handicaps, and display your profile to other users per your privacy settings.</Text>

        <Text style={styles.h2}>Third-Party Services</Text>
        <Text style={styles.body}>We use the following third-party services:{'\n'}• Cloudinary — media storage and delivery{'\n'}• SendGrid — email delivery{'\n'}• Railway — app hosting and database{'\n'}• Golf Course API — course data{'\n\n'}Each service has its own privacy policy governing their data use.</Text>

        <Text style={styles.h2}>Data Sharing</Text>
        <Text style={styles.body}>We do not sell your personal information. Your profile data is visible to other Caddy users based on your privacy settings. We may share aggregate anonymized data for platform improvement.</Text>

        <Text style={styles.h2}>Your Rights</Text>
        <Text style={styles.body}>You may request deletion of your account and data at any time by contacting us. You can update your profile information and privacy settings within the app.</Text>

        <Text style={styles.h2}>Contact</Text>
        <Text style={styles.body}>Questions? Contact us at privacy@thecaddy.app</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontFamily: 'CormorantGaramond_600SemiBold',
    fontSize: 20,
    color: Colors.textPrimary,
  },
  scroll: { flex: 1 },
  content: { padding: 24, paddingBottom: 60 },
  updated: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 24,
  },
  h2: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 16,
    color: Colors.gold,
    marginTop: 24,
    marginBottom: 8,
  },
  body: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
});
