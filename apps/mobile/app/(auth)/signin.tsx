import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform,
  TouchableOpacity, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Mail, Phone } from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { authApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import GradientButton from '../../components/ui/GradientButton';
import { Colors, Radius, Spacing } from '../../constants/theme';

WebBrowser.maybeCompleteAuthSession();

// ─── Google OAuth config ─────────────────────────────────────────────────────
// Add these to your .env file to enable Google Sign-In:
//   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your_web_client_id
//   EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=your_ios_client_id
//   EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=your_android_client_id
// Get credentials at: https://console.cloud.google.com/apis/credentials
const GOOGLE_WEB_CLIENT_ID     = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID     ?? '';
const GOOGLE_IOS_CLIENT_ID     = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID     ?? '';
const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '';
const GOOGLE_CONFIGURED        = !!(GOOGLE_WEB_CLIENT_ID || GOOGLE_IOS_CLIENT_ID || GOOGLE_ANDROID_CLIENT_ID);

function isPhone(input: string): boolean {
  const digits = input.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15 && !/[@.]/.test(input) && digits.length > 0;
}

export default function SignInScreen() {
  const [tab, setTab]         = useState<'login' | 'create'>('login');
  const [contact, setContact] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const router = useRouter();
  const { signIn } = useAuth();

  const usePhone = contact.trim().length > 0 && isPhone(contact.trim()) && !contact.includes('@');
  const isEmail  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.trim());
  const isValid  = usePhone || isEmail;

  async function handleSocialToken(provider: 'google' | 'apple', token: string) {
    setLoading(true);
    try {
      const result = await authApi.socialAuth(provider, token);
      await signIn(result.token, result.user);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Sign in failed. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    if (!GOOGLE_CONFIGURED) {
      Alert.alert(
        'Google Sign-In',
        'Add your Google OAuth client IDs to .env to enable this.\n\nSee comments in app/(auth)/signin.tsx for setup instructions.'
      );
      return;
    }
    try {
      const clientId = Platform.OS === 'ios' ? GOOGLE_IOS_CLIENT_ID
        : Platform.OS === 'android' ? GOOGLE_ANDROID_CLIENT_ID
        : GOOGLE_WEB_CLIENT_ID;
      const redirectUri = makeRedirectUri({ scheme: 'thecaddy' });
      const result = await WebBrowser.openAuthSessionAsync(
        `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=email%20profile`,
        redirectUri
      );
      if (result.type === 'success' && result.url) {
        const match = result.url.match(/access_token=([^&]+)/);
        if (match) await handleSocialToken('google', match[1]);
      }
    } catch (e) {
      setError('Google Sign-In failed. Try another method.');
    }
  }

  async function handleAppleSignIn() {
    // expo-apple-authentication is iOS-only
    if (Platform.OS !== 'ios') {
      Alert.alert('Not available', 'Apple Sign-In is only available on iPhone.');
      return;
    }
    try {
      const AppleAuthentication = await import('expo-apple-authentication');
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (credential.identityToken) {
        await handleSocialToken('apple', credential.identityToken);
      }
    } catch (e: any) {
      if (e.code !== 'ERR_REQUEST_CANCELED') {
        setError('Apple Sign-In failed. Try another method.');
      }
    }
  }

  async function handleOtpSubmit() {
    const trimmed = contact.trim();
    if (!trimmed) { setError('Enter your email or phone number'); return; }
    if (!isValid) { setError('Enter a valid email or phone number'); return; }
    setError('');
    setLoading(true);
    try {
      if (usePhone) {
        await authApi.requestOtp(undefined, trimmed);
        router.push({ pathname: '/(auth)/verify', params: { contact: trimmed, via: 'phone' } });
      } else {
        await authApi.requestOtp(trimmed.toLowerCase());
        router.push({ pathname: '/(auth)/verify', params: { contact: trimmed.toLowerCase(), via: 'email' } });
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to send code. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.logoMark}>
            <Ionicons name="golf" size={38} color={Colors.bg} />
          </View>
          <Text style={styles.brandName}>THE CADDY</Text>
          <Text style={styles.subtitle}>Your golf social platform</Text>
        </View>

        {/* Tab selector */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, tab === 'login' && styles.tabActive]}
            onPress={() => { setTab('login'); setError(''); }}
          >
            <Text style={[styles.tabText, tab === 'login' && styles.tabTextActive]}>Log In</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'create' && styles.tabActive]}
            onPress={() => { setTab('create'); setError(''); }}
          >
            <Text style={[styles.tabText, tab === 'create' && styles.tabTextActive]}>Create Account</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          {/* Social buttons */}
          {Platform.OS === 'ios' && (
            <TouchableOpacity style={styles.socialBtn} onPress={handleAppleSignIn} disabled={loading}>
              <Ionicons name="logo-apple" size={20} color={Colors.textPrimary} />
              <Text style={styles.socialBtnText}>
                {tab === 'create' ? 'Sign up' : 'Sign in'} with Apple
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.socialBtn} onPress={handleGoogleSignIn} disabled={loading}>
            <GoogleIcon />
            <Text style={styles.socialBtnText}>
              {tab === 'create' ? 'Sign up' : 'Sign in'} with Google
            </Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with email</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* OTP input */}
          <View style={[styles.inputWrap, error ? styles.inputWrapError : undefined]}>
            {usePhone
              ? <Phone size={18} color={Colors.textSecondary} strokeWidth={1.8} />
              : <Mail size={18} color={Colors.textSecondary} strokeWidth={1.8} />
            }
            <TextInput
              style={styles.input}
              placeholder="Email or phone number"
              placeholderTextColor={Colors.textSecondary}
              value={contact}
              onChangeText={v => { setContact(v); setError(''); }}
              keyboardType={usePhone ? 'phone-pad' : 'email-address'}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleOtpSubmit}
            />
            {isValid && (
              <View style={styles.inputTag}>
                <Text style={styles.inputTagText}>{usePhone ? 'SMS' : 'Email'}</Text>
              </View>
            )}
          </View>

          {!!error && (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle-outline" size={14} color={Colors.error} />
              <Text style={styles.error}>{error}</Text>
            </View>
          )}

          <GradientButton
            label="Send Login Code"
            onPress={handleOtpSubmit}
            loading={loading}
            style={{ marginTop: 4 }}
          />

          <Text style={styles.hint}>
            We'll text or email a 6-digit code.{'\n'}No password needed.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// Inline Google "G" icon (SVG-free, just styled text)
function GoogleIcon() {
  return (
    <View style={styles.googleIcon}>
      <Text style={styles.googleIconText}>G</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },

  glowTop: {
    position: 'absolute', top: -100, left: '50%', marginLeft: -150,
    width: 300, height: 300, borderRadius: 150,
    backgroundColor: Colors.lime, opacity: 0.06,
  },
  glowBottom: {
    position: 'absolute', bottom: -80, right: -60,
    width: 250, height: 250, borderRadius: 125,
    backgroundColor: Colors.purple, opacity: 0.08,
  },

  container: { flex: 1, justifyContent: 'center', padding: Spacing.lg },

  hero: { alignItems: 'center', marginBottom: 28 },
  logoMark: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.lime,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 18,
    shadowColor: Colors.lime,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5, shadowRadius: 20, elevation: 12,
  },
  brandName: {
    color: Colors.textPrimary, fontSize: 28, fontWeight: '900',
    letterSpacing: 6, marginBottom: 6,
  },
  subtitle: { color: Colors.textSecondary, fontSize: 14 },

  tabRow: {
    flexDirection: 'row', gap: 8, marginBottom: 12,
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.lg, padding: 4,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  tab: {
    flex: 1, paddingVertical: 10, alignItems: 'center',
    borderRadius: Radius.md,
  },
  tabActive: { backgroundColor: Colors.bgTertiary, borderWidth: 1, borderColor: Colors.cardBorder },
  tabText: { color: Colors.textMuted, fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: Colors.textPrimary },

  card: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.xl, borderWidth: 1,
    borderColor: Colors.glassBorder, padding: Spacing.lg,
    gap: 10,
  },

  socialBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    height: 50, borderRadius: Radius.lg,
    backgroundColor: Colors.bgTertiary,
    borderWidth: 1.5, borderColor: Colors.cardBorder,
  },
  socialBtnText: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600' },

  googleIcon: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
  googleIconText: { color: '#4285F4', fontSize: 13, fontWeight: '900' },

  dividerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginVertical: 4,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.cardBorder },
  dividerText: { color: Colors.textMuted, fontSize: 11, fontWeight: '500' },

  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.bgTertiary, borderRadius: Radius.lg,
    borderWidth: 1.5, borderColor: Colors.cardBorder,
    paddingHorizontal: 14, height: 52,
  },
  inputWrapError: { borderColor: Colors.error },
  input: { flex: 1, color: Colors.textPrimary, fontSize: 16 },

  inputTag: {
    paddingHorizontal: 8, paddingVertical: 3,
    backgroundColor: Colors.limeDim, borderRadius: Radius.pill,
  },
  inputTagText: { color: Colors.lime, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  error: { color: Colors.error, fontSize: 13 },

  hint: {
    color: Colors.textMuted, fontSize: 12, textAlign: 'center',
    lineHeight: 18,
  },
});
