import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, StyleSheet, KeyboardAvoidingView,
  Platform, TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { authApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import GradientButton from '../../components/ui/GradientButton';
import { Colors, Radius, Spacing } from '../../constants/theme';

export default function VerifyScreen() {
  const { contact, via } = useLocalSearchParams<{ contact: string; via: 'email' | 'phone' }>();
  const [code, setCode]     = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const { signIn } = useAuth();
  const router     = useRouter();
  const inputs     = useRef<(TextInput | null)[]>([]);

  function handleDigit(value: string, index: number) {
    if (value.length > 1) {
      const digits = value.slice(0, 6).split('');
      const newCode = [...code];
      digits.forEach((d, i) => { if (index + i < 6) newCode[index + i] = d; });
      setCode(newCode);
      inputs.current[Math.min(index + digits.length, 5)]?.focus();
      return;
    }
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    if (value && index < 5) inputs.current[index + 1]?.focus();
  }

  function handleBackspace(index: number) {
    if (!code[index] && index > 0) {
      const newCode = [...code];
      newCode[index - 1] = '';
      setCode(newCode);
      inputs.current[index - 1]?.focus();
    }
  }

  async function handleVerify() {
    const fullCode = code.join('');
    if (fullCode.length !== 6) { setError('Enter all 6 digits'); return; }
    setError('');
    setLoading(true);
    try {
      const result = await authApi.verifyOtp(contact!, fullCode, via ?? 'email');
      await signIn(result.token, result.user);
      // Navigation is handled by _layout.tsx based on onboardingComplete
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Invalid code. Try again.');
      setCode(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  const isPhone = via === 'phone';

  return (
    <View style={styles.screen}>
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={[styles.iconCircle, isPhone && { backgroundColor: Colors.lime }]}>
            <Ionicons
              name={isPhone ? 'phone-portrait-outline' : 'mail-outline'}
              size={32}
              color={Colors.bg}
            />
          </View>
          <Text style={styles.title}>{isPhone ? 'Check your texts' : 'Check your email'}</Text>
          <Text style={styles.sub}>We sent a 6-digit code to</Text>
          <Text style={styles.contact}>{contact}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.codeRow}>
            {code.map((digit, i) => (
              <TextInput
                key={i}
                ref={el => { inputs.current[i] = el; }}
                style={[styles.digitBox, digit ? styles.digitBoxFilled : undefined]}
                value={digit}
                onChangeText={v => handleDigit(v, i)}
                onKeyPress={({ nativeEvent }) => nativeEvent.key === 'Backspace' && handleBackspace(i)}
                keyboardType="number-pad"
                maxLength={6}
                selectTextOnFocus
              />
            ))}
          </View>

          {!!error && (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle-outline" size={14} color={Colors.error} />
              <Text style={styles.error}>{error}</Text>
            </View>
          )}

          <GradientButton
            label="Verify Code"
            onPress={handleVerify}
            loading={loading}
            style={{ marginTop: 4 }}
          />

          <TouchableOpacity
            style={styles.resendBtn}
            onPress={() => {
              if (isPhone) authApi.requestOtp(undefined, contact!);
              else authApi.requestOtp(contact!);
              setCode(['', '', '', '', '', '']);
              inputs.current[0]?.focus();
            }}
          >
            <Text style={styles.resendText}>Didn't get it? </Text>
            <Text style={styles.resendLink}>Resend code</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },

  glowTop: {
    position: 'absolute', top: -80, left: '50%', marginLeft: -100,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: Colors.purple, opacity: 0.09,
  },
  glowBottom: {
    position: 'absolute', bottom: -60, right: -60,
    width: 220, height: 220, borderRadius: 110,
    backgroundColor: Colors.lime, opacity: 0.06,
  },

  container: { flex: 1, justifyContent: 'center', padding: Spacing.lg },

  backBtn: {
    position: 'absolute', top: 56, left: 24,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.bgSecondary, borderWidth: 1, borderColor: Colors.cardBorder,
    alignItems: 'center', justifyContent: 'center',
  },

  header: { alignItems: 'center', marginBottom: 36 },
  iconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.purple,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
    shadowColor: Colors.purple,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5, shadowRadius: 20, elevation: 12,
  },
  title:   { color: Colors.textPrimary, fontSize: 24, fontWeight: '800', marginBottom: 8 },
  sub:     { color: Colors.textSecondary, fontSize: 14 },
  contact: { color: Colors.lime, fontSize: 15, fontWeight: '600', marginTop: 4 },

  card: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.xl, borderWidth: 1,
    borderColor: Colors.glassBorder, padding: Spacing.lg,
  },

  codeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, gap: 8 },
  digitBox: {
    flex: 1, height: 58,
    borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: Colors.cardBorder,
    backgroundColor: Colors.bgTertiary,
    textAlign: 'center', fontSize: 24, fontWeight: '700',
    color: Colors.textPrimary,
  },
  digitBoxFilled: {
    borderColor: Colors.lime, backgroundColor: Colors.limeDim,
    shadowColor: Colors.lime, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },

  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  error:    { color: Colors.error, fontSize: 13 },

  resendBtn:  { flexDirection: 'row', marginTop: 16, justifyContent: 'center' },
  resendText: { color: Colors.textSecondary, fontSize: 13 },
  resendLink: { color: Colors.lime, fontSize: 13, fontWeight: '600' },
});
