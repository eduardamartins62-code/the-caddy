import React from 'react';
import { ScrollView, Text, View, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';

export default function TermsScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Terms of Service</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.updated}>Last updated: March 2026</Text>

        <Text style={styles.h2}>Acceptance of Terms</Text>
        <Text style={styles.body}>By downloading or using The Caddy, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the app.</Text>

        <Text style={styles.h2}>User Conduct</Text>
        <Text style={styles.body}>You agree to:{'\n'}• Submit accurate and honest golf scores — we take integrity seriously{'\n'}• Treat other users respectfully{'\n'}• Not post offensive, harmful, or misleading content{'\n'}• Not use the platform for commercial solicitation without permission{'\n\n'}Violations may result in account suspension or termination.</Text>

        <Text style={styles.h2}>Intellectual Property</Text>
        <Text style={styles.body}>The Caddy platform, including its name, logo, design, and features, is owned by The Caddy and protected by applicable intellectual property laws. You may not copy, modify, or distribute any part of the platform without permission.</Text>

        <Text style={styles.h2}>Golf Handicap Disclaimer</Text>
        <Text style={styles.body}>Handicap calculations provided by The Caddy are for informal use only. They are not official USGA or WHS (World Handicap System) handicaps. For an official handicap index, please register with a USGA-affiliated golf association.</Text>

        <Text style={styles.h2}>Account Termination</Text>
        <Text style={styles.body}>We reserve the right to suspend or terminate accounts that violate these terms, engage in fraudulent activity, or misuse the platform. You may delete your account at any time through the app settings.</Text>

        <Text style={styles.h2}>Limitation of Liability</Text>
        <Text style={styles.body}>The Caddy is provided "as is" without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages arising from your use of the app. Our total liability shall not exceed the amount you paid for the service.</Text>

        <Text style={styles.h2}>Governing Law</Text>
        <Text style={styles.body}>These terms are governed by the laws of the State of Florida, United States. Any disputes shall be resolved in the courts of Florida.</Text>

        <Text style={styles.h2}>Contact</Text>
        <Text style={styles.body}>Questions about these terms? Contact us at legal@thecaddy.app</Text>
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
