import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, StyleSheet, KeyboardAvoidingView,
  Platform, TouchableOpacity, Animated,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Colors, Radius, Spacing } from '../../constants/theme';

const RESEND_TIMEOUT = 30;

export default function VerifyScreen() {
  const { contact, via } = useLocalSearchParams<{ contact: string; via: 'email' | 'phone' }>();
  const [code, setCode]         = useState(['', '', '', '', '', '']);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [focused, setFocused]   = useState<number | null>(0);
  const [resendTimer, setResendTimer] = useState(RESEND_TIMEOUT);
  const [resending, setResending]     = useState(false);
  const { signIn } = useAuth();
  const router     = useRouter();
  const inputs     = useRef<(TextInput | null)[]>([]);
  const shakeAnim  = useRef(new Animated.Value(0)).current;

  const isPhone = via === 'phone';

  // Countdown for resend
  useEffect(() => {
    if (resendTimer <= 0) return;
    const id = setInterval(() => setResendTimer(t => t - 1), 1000);
    return () => clearInterval(id);
  }, [resendTimer]);

  function handleDigit(value: string, index: number) {
    if (value.length > 1) {
      const digits = value.replace(/\D/g, '').slice(0, 6).split('');
      const newCode = [...code];
      digits.forEach((d, i) => { if (index + i < 6) newCode[index + i] = d; });
      setCode(newCode);
      const next = Math.min(index + digits.length, 5);
      inputs.current[next]?.focus();
      return;
    }
    const newCode = [...code];
    newCode[index] = value.replace(/\D/g, '');
    setCode(newCode);
    if (value && index < 5) {
      inputs.current[index + 1]?.focus();
    }
  }

  function handleBackspace(index: number) {
    if (!code[index] && index > 0) {
      const newCode = [...code];
      newCode[index - 1] = '';
      setCode(newCode);
      inputs.current[index - 1]?.focus();
    }
  }

  function shake() {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }

  async function handleVerify() {
    const fullCode = code.join('');
    if (fullCode.length !== 6) { setError('Enter all 6 digits'); return; }
    setError('');
    setLoading(true);
    try {
      const result = await authApi.verifyOtp(contact!, fullCode, via ?? 'email');
      await signIn(result.token, result.user);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Invalid code. Try again.');
      setCode(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
      shake();
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (resendTimer > 0 || resending) return;
    setResending(true);
    try {
      if (isPhone) await authApi.requestOtp(undefined, contact!);
      else await authApi.requestOtp(contact!);
      setCode(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
      setResendTimer(RESEND_TIMEOUT);
      setError('');
    } catch { /* silently ignore */ } finally {
      setResending(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.glowTop} pointerEvents="none" />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.kav}>
        {/* Back button */}
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.brandName}>THE CADDY</Text>
          <Text style={styles.title}>Enter your code</Text>
          <Text style={styles.sub}>
            Sent to{' '}
            <Text style={styles.contactHighlight}>{contact}</Text>
          </Text>
        </View>

        {/* OTP boxes */}
        <Animated.View style={[styles.codeRow, { transform: [{ translateX: shakeAnim }] }]}>
          {code.map((digit, i) => (
            <TextInput
              key={i}
              ref={el => { inputs.current[i] = el; }}
              style={[
                styles.digitBox,
                focused === i && styles.digitBoxFocused,
                digit && styles.digitBoxFilled,
                !!error && styles.digitBoxError,
              ]}
              value={digit}
              onChangeText={v => handleDigit(v, i)}
              onKeyPress={({ nativeEvent }) => nativeEvent.key === 'Backspace' && handleBackspace(i)}
              onFocus={() => setFocused(i)}
              onBlur={() => setFocused(null)}
              keyboardType="number-pad"
              maxLength={6}
              selectTextOnFocus
            />
          ))}
        </Animated.View>

        {!!error && (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle-outline" size={14} color={Colors.error} />
            <Text style={styles.error}>{error}</Text>
          </View>
        )}

        {/* Verify button */}
        <TouchableOpacity
          onPress={handleVerify}
          disabled={loading}
          activeOpacity={0.85}
          style={{ marginTop: 8 }}
        >
          <LinearGradient
            colors={['#F0C866', '#C4912A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.verifyBtn}
          >
            <Text style={styles.verifyBtnText}>
              {loading ? 'Verifying…' : 'Verify Code'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Resend */}
        <View style={styles.resendRow}>
          <Text style={styles.resendLabel}>Didn't get it? </Text>
          {resendTimer > 0 ? (
            <Text style={styles.resendTimer}>Resend in {resendTimer}s</Text>
          ) : (
            <TouchableOpacity onPress={handleResend} disabled={resending}>
              <Text style={styles.resendLink}>
                {resending ? 'Sending…' : 'Resend code'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },

  glowTop: {
    position: 'absolute',
    top: -100,
    left: '50%' as any,
    marginLeft: -120,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: Colors.teal,
    opacity: 0.07,
  },

  kav: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center',
  },

  backBtn: {
    position: 'absolute',
    top: 56,
    left: Spacing.lg,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  header: { alignItems: 'center', marginBottom: 40 },
  brandName: {
    color: Colors.gold,
    fontSize: 18,
    fontFamily: 'CormorantGaramond_600SemiBold',
    letterSpacing: 3,
    marginBottom: 24,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontFamily: 'CormorantGaramond_600SemiBold',
    marginBottom: 8,
  },
  sub: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    textAlign: 'center',
  },
  contactHighlight: {
    color: Colors.gold,
    fontFamily: 'DMSans_500Medium',
  },

  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  digitBox: {
    flex: 1,
    height: 60,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.bgSecondary,
    textAlign: 'center',
    fontSize: 24,
    fontFamily: 'DMMono_400Regular',
    color: Colors.textPrimary,
  },
  digitBoxFocused: {
    borderColor: Colors.gold,
    backgroundColor: Colors.bgElevated,
  },
  digitBoxFilled: {
    borderColor: Colors.gold,
    backgroundColor: Colors.goldDim,
  },
  digitBoxError: {
    borderColor: Colors.error,
  },

  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  error: { color: Colors.error, fontSize: 13, fontFamily: 'DMSans_400Regular' },

  verifyBtn: {
    height: 52,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyBtnText: {
    color: Colors.bg,
    fontSize: 16,
    fontFamily: 'DMSans_500Medium',
    letterSpacing: 0.5,
  },

  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  resendLabel: { color: Colors.textSecondary, fontSize: 13, fontFamily: 'DMSans_400Regular' },
  resendTimer: { color: Colors.textMuted, fontSize: 13, fontFamily: 'DMSans_400Regular' },
  resendLink: { color: Colors.gold, fontSize: 13, fontFamily: 'DMSans_500Medium' },
});
