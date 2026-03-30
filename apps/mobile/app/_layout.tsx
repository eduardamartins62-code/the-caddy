import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { queryClient } from '../lib/queryClient';
import { useToast } from '../hooks/useToast';
import ToastContainer from '../components/ui/ToastContainer';
import { Colors } from '../constants/theme';
import { Platform, View } from 'react-native';

function RootLayoutNav() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    const inAuth = segments[0] === '(auth)';
    const inOnboarding = segments[0] === 'onboarding';

    if (!user && !inAuth) {
      router.replace('/(auth)/signin');
    } else if (user && inAuth) {
      if (!user.onboardingComplete) {
        router.replace('/onboarding');
      } else {
        router.replace('/(tabs)/home');
      }
    } else if (user && !inAuth && !inOnboarding && !user.onboardingComplete) {
      router.replace('/onboarding');
    }
  }, [user, isLoading, segments]);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.bg } }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="leaderboard" options={{ presentation: 'modal' }} />
      <Stack.Screen name="round/[id]" />
      <Stack.Screen name="round/stats" />
      <Stack.Screen name="profile/[id]" />
      <Stack.Screen name="event/[id]" />
      <Stack.Screen name="event/create" />
      <Stack.Screen name="admin/index" />
      <Stack.Screen name="admin/players" />
      <Stack.Screen name="admin/rounds" />
      <Stack.Screen name="admin/scores" />
      <Stack.Screen name="admin/history" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="messages/index" />
      <Stack.Screen name="messages/[userId]" />
      <Stack.Screen name="onboarding" />
    </Stack>
  );
}

function ToastLayer({ children }: { children: React.ReactNode }) {
  const { toasts, show, dismiss } = useToast();
  return (
    <View style={{ flex: 1 }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </View>
  );
}

export default function RootLayout() {
  const isWeb = Platform.OS === 'web';

  const app = (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <AuthProvider>
            <StatusBar style="light" backgroundColor={Colors.bg} />
            <ToastLayer>
              <RootLayoutNav />
            </ToastLayer>
          </AuthProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );

  if (!isWeb) return app;

  // On web, centre the app in a phone-shaped frame so it always looks like a
  // mobile app regardless of the browser window size.
  return (
    <View style={{
      flex: 1,
      minHeight: '100vh' as any,
      backgroundColor: '#000',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
    }}>
      <View style={{
        width: 390,
        height: '92vh' as any,
        maxHeight: 844,
        overflow: 'hidden',
        borderRadius: 44,
        boxShadow: '0 0 0 10px #1a1a1a, 0 30px 80px rgba(0,0,0,0.8), 0 0 60px rgba(201,243,29,0.08)' as any,
        backgroundColor: Colors.bg,
        flexDirection: 'column' as any,
      }}>
        {/* Status bar strip — simulates phone top bar */}
        <View style={{
          height: 44,
          backgroundColor: Colors.bg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 24,
          flexShrink: 0,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {[1,2,3].map(i => (
              <View key={i} style={{ width: 6 + i * 2, height: 10, backgroundColor: '#fff', borderRadius: 2, opacity: 0.9 - i * 0.2 }} />
            ))}
          </View>
          <View style={{ width: 90, height: 22, backgroundColor: '#1a1a1a', borderRadius: 16 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 16, height: 12, borderWidth: 1.5, borderColor: '#fff', borderRadius: 3, opacity: 0.9, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 1 }}>
              <View style={{ flex: 0.75, height: 6, backgroundColor: '#fff', borderRadius: 1 }} />
            </View>
          </View>
        </View>
        <View style={{ flex: 1, overflow: 'hidden' }}>
          {app}
        </View>
      </View>
    </View>
  );
}
