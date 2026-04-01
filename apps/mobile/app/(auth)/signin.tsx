import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform,
  TouchableOpacity, Alert, ScrollView, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authApi, inviteApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Colors, Radius, Spacing } from '../../constants/theme';

WebBrowser.maybeCompleteAuthSession();

// ─── Google OAuth config ─────────────────────────────────────────────────────
const GOOGLE_WEB_CLIENT_ID     = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID     ?? '';
const GOOGLE_IOS_CLIENT_ID     = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID     ?? '';
const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '';
const GOOGLE_CONFIGURED        = !!(GOOGLE_WEB_CLIENT_ID || GOOGLE_IOS_CLIENT_ID || GOOGLE_ANDROID_CLIENT_ID);

function isPhone(input: string): boolean {
  const digits = input.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15 && !/[@.]/.test(input) && digits.length > 0;
}

export default function SignInScreen() {
  const [inputMode, setInputMode]       = useState<'email' | 'phone'>('email');
  const [contact, setContact]           = useState('');
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');
  const [focused, setFocused]           = useState(false);
  // Invite code state
  const [inviteOnly, setInviteOnly]     = useState(false);
  const [inviteCode, setInviteCode]     = useState('');
  const [inviteFocused, setInviteFocused] = useState(false);
  const [waitlistModal, setWaitlistModal] = useState(false);
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const router = useRouter();
  const { signIn } = useAuth();

  React.useEffect(() => {
    inviteApi.getStatus().then((data: any) => {
      setInviteOnly(data?.inviteOnly === true);
    }).catch(() => {});
  }, []);

  const usePhone = inputMode === 'phone';
  const isEmail  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.trim());
  const isValidPhone = isPhone(contact.trim());
  const isValid  = usePhone ? isValidPhone : isEmail;

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
    } catch {
      setError('Google Sign-In failed. Try another method.');
    }
  }

  async function handleAppleSignIn() {
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

  async function handleJoinWaitlist() {
    if (!waitlistEmail.trim()) return;
    setWaitlistLoading(true);
    try {
      await inviteApi.joinWaitlist(waitlistEmail.trim().toLowerCase());
      setWaitlistModal(false);
      Alert.alert("You're on the list!", "We'll notify you when a spot opens up.");
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to join waitlist.');
    } finally {
      setWaitlistLoading(false);
    }
  }

  async function handleOtpSubmit() {
    const trimmed = contact.trim();
    if (!trimmed) { setError('Enter your email or phone number'); return; }
    if (!isValid) { setError(usePhone ? 'Enter a valid phone number' : 'Enter a valid email address'); return; }
    setError('');
    setLoading(true);
    try {
      if (usePhone) {
        await authApi.requestOtp(undefined, trimmed, inviteOnly ? inviteCode.trim() : undefined);
        router.push({ pathname: '/(auth)/verify', params: { contact: trimmed, via: 'phone' } });
      } else {
        await authApi.requestOtp(trimmed.toLowerCase(), undefined, inviteOnly ? inviteCode.trim() : undefined);
        router.push({ pathname: '/(auth)/verify', params: { contact: trimmed.toLowerCase(), via: 'email' } });
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to send code. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      {/* Golf course silhouette at bottom */}
      <View style={styles.hillsContainer} pointerEvents="none">
        <View style={styles.hillBack} />
        <View style={styles.hillMid} />
        <View style={styles.hillFront} />
      </View>

      {/* Subtle gold glow top */}
      <View style={styles.glowTop} pointerEvents="none" />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.kav}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Logo */}
          <View style={styles.hero}>
            <Text style={styles.brandName}>THE CADDY</Text>
            <Text style={styles.tagline}>Your game. Your people.</Text>
          </View>

          {/* Email / Phone toggle */}
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, inputMode === 'email' && styles.toggleBtnActive]}
              onPress={() => { setInputMode('email'); setContact(''); setError(''); }}
            >
              <Text style={[styles.toggleText, inputMode === 'email' && styles.toggleTextActive]}>Email</Text>
              {inputMode === 'email' && <View style={styles.toggleUnderline} />}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, inputMode === 'phone' && styles.toggleBtnActive]}
              onPress={() => { setInputMode('phone'); setContact(''); setError(''); }}
            >
              <Text style={[styles.toggleText, inputMode === 'phone' && styles.toggleTextActive]}>Phone</Text>
              {inputMode === 'phone' && <View style={styles.toggleUnderline} />}
            </TouchableOpacity>
          </View>

          {/* Input */}
          <View style={[styles.inputWrap, focused && styles.inputWrapFocused, !!error && styles.inputWrapError]}>
            <Ionicons
              name={usePhone ? 'phone-portrait-outline' : 'mail-outline'}
              size={18}
              color={focused ? Colors.gold : Colors.textSecondary}
            />
            <TextInput
              style={styles.input}
              placeholder={usePhone ? 'Phone number' : 'Email address'}
              placeholderTextColor={Colors.textMuted}
              value={contact}
              onChangeText={v => { setContact(v); setError(''); }}
              keyboardType={usePhone ? 'phone-pad' : 'email-address'}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleOtpSubmit}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
            />
            {isValid && (
              <View style={styles.inputTag}>
                <Text style={styles.inputTagText}>{usePhone ? 'SMS' : 'Email'}</Text>
              </View>
            )}
          </View>

          {/* Invite code — only shown in invite-only mode */}
          {inviteOnly && (
            <>
              <View style={[styles.inputWrap, inviteFocused && styles.inputWrapFocused]}>
                <Ionicons
                  name="key-outline"
                  size={18}
                  color={inviteFocused ? Colors.gold : Colors.textSecondary}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Invite Code (optional)"
                  placeholderTextColor={Colors.textMuted}
                  value={inviteCode}
                  onChangeText={setInviteCode}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  returnKeyType="done"
                  onFocus={() => setInviteFocused(true)}
                  onBlur={() => setInviteFocused(false)}
                />
              </View>
              <TouchableOpacity onPress={() => setWaitlistModal(true)} style={styles.waitlistLink}>
                <Text style={styles.waitlistLinkText}>Don't have a code? Join waitlist</Text>
              </TouchableOpacity>
            </>
          )}

          {!!error && (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle-outline" size={14} color={Colors.error} />
              <Text style={styles.error}>{error}</Text>
            </View>
          )}

          {/* Continue CTA */}
          <TouchableOpacity onPress={handleOtpSubmit} disabled={loading} activeOpacity={0.85} style={{ marginTop: 4 }}>
            <LinearGradient
              colors={['#F0C866', '#C4912A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaBtn}
            >
              <Text style={styles.ctaText}>
                {loading ? 'Sending…' : 'Continue'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.hint}>
            We'll {usePhone ? 'text' : 'email'} a 6-digit code — no password needed.
          </Text>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Social buttons */}
          {Platform.OS === 'ios' && (
            <TouchableOpacity style={styles.socialBtn} onPress={handleAppleSignIn} disabled={loading}>
              <Ionicons name="logo-apple" size={20} color={Colors.textPrimary} />
              <Text style={styles.socialBtnText}>Continue with Apple</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.socialBtn} onPress={handleGoogleSignIn} disabled={loading}>
            <GoogleIcon />
            <Text style={styles.socialBtnText}>Continue with Google</Text>
          </TouchableOpacity>

          {/* Privacy + Terms */}
          <View style={styles.legalRow}>
            <TouchableOpacity onPress={() => router.push('/privacy' as any)}>
              <Text style={styles.legalLink}>Privacy Policy</Text>
            </TouchableOpacity>
            <View style={styles.legalDot} />
            <TouchableOpacity onPress={() => router.push('/terms' as any)}>
              <Text style={styles.legalLink}>Terms of Service</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Waitlist Modal */}
      <Modal visible={waitlistModal} transparent animationType="slide" onRequestClose={() => setWaitlistModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Join the Waitlist</Text>
            <Text style={styles.modalSubtitle}>Enter your email and we'll notify you when a spot opens up.</Text>
            <View style={[styles.inputWrap, { marginBottom: 16 }]}>
              <Ionicons name="mail-outline" size={18} color={Colors.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="Email address"
                placeholderTextColor={Colors.textMuted}
                value={waitlistEmail}
                onChangeText={setWaitlistEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <TouchableOpacity
              onPress={handleJoinWaitlist}
              disabled={waitlistLoading || !waitlistEmail.trim()}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#F0C866', '#C4912A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.ctaBtn, { opacity: waitlistLoading || !waitlistEmail.trim() ? 0.6 : 1 }]}
              >
                <Text style={styles.ctaText}>{waitlistLoading ? 'Joining…' : 'Join Waitlist'}</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setWaitlistModal(false)} style={{ alignItems: 'center', marginTop: 16 }}>
              <Text style={{ color: Colors.textMuted, fontFamily: 'DMSans_400Regular', fontSize: 14 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

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
    position: 'absolute',
    top: -120,
    left: '50%' as any,
    marginLeft: -150,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: Colors.gold,
    opacity: 0.06,
  },

  // Hills silhouette
  hillsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 130,
    overflow: 'hidden',
  },
  hillBack: {
    position: 'absolute',
    bottom: 0,
    left: -40,
    right: -40,
    height: 90,
    borderTopLeftRadius: 200,
    borderTopRightRadius: 160,
    backgroundColor: Colors.bgTertiary,
    opacity: 0.6,
  },
  hillMid: {
    position: 'absolute',
    bottom: 0,
    left: -20,
    right: -20,
    height: 60,
    borderTopLeftRadius: 140,
    borderTopRightRadius: 200,
    backgroundColor: Colors.bgSecondary,
    opacity: 0.8,
  },
  hillFront: {
    position: 'absolute',
    bottom: 0,
    left: -60,
    right: -10,
    height: 36,
    borderTopLeftRadius: 100,
    borderTopRightRadius: 260,
    backgroundColor: Colors.bgElevated,
    opacity: 0.9,
  },

  kav: { flex: 1 },
  scroll: { padding: Spacing.lg, paddingTop: Spacing.xxl, paddingBottom: 160 },

  hero: { alignItems: 'center', marginBottom: 36 },
  brandName: {
    color: Colors.gold,
    fontSize: 42,
    fontFamily: 'CormorantGaramond_700Bold',
    letterSpacing: 4,
    marginBottom: 8,
  },
  tagline: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontFamily: 'DMSans_400Regular',
    fontStyle: 'italic',
  },

  toggleRow: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  toggleBtn: { alignItems: 'center', paddingBottom: 6, position: 'relative' },
  toggleBtnActive: {},
  toggleText: {
    color: Colors.textMuted,
    fontSize: 15,
    fontFamily: 'DMSans_500Medium',
  },
  toggleTextActive: { color: Colors.textPrimary },
  toggleUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    borderRadius: 1,
    backgroundColor: Colors.gold,
  },

  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    height: 54,
    marginBottom: 8,
  },
  inputWrapFocused: { borderColor: Colors.gold },
  inputWrapError: { borderColor: Colors.error },
  input: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 16,
    fontFamily: 'DMSans_400Regular',
  },
  inputTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: Colors.goldDim,
    borderRadius: Radius.pill,
  },
  inputTagText: {
    color: Colors.gold,
    fontSize: 10,
    fontFamily: 'DMSans_500Medium',
    letterSpacing: 0.5,
  },

  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  error: { color: Colors.error, fontSize: 13, fontFamily: 'DMSans_400Regular' },

  ctaBtn: {
    height: 52,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  ctaText: {
    color: Colors.bg,
    fontSize: 16,
    fontFamily: 'DMSans_500Medium',
    letterSpacing: 0.5,
  },

  hint: {
    color: Colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    fontFamily: 'DMSans_400Regular',
    marginTop: 10,
    marginBottom: 4,
  },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 20,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
  },

  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 52,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: 'rgba(244,239,230,0.12)',
    marginBottom: 12,
  },
  socialBtnText: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontFamily: 'DMSans_500Medium',
  },

  googleIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIconText: { color: '#4285F4', fontSize: 13, fontWeight: '900' },

  legalRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    marginTop: 24,
  },
  legalLink: {
    color: Colors.textMuted,
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
  },
  legalDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.textMuted,
  },

  waitlistLink: { alignSelf: 'flex-start', marginBottom: 8, marginTop: -4 },
  waitlistLinkText: { color: Colors.gold, fontSize: 13, fontFamily: 'DMSans_400Regular', textDecorationLine: 'underline' },

  // Waitlist modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.bgSecondary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 28,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalTitle: {
    fontFamily: 'CormorantGaramond_600SemiBold',
    fontSize: 22,
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
});
