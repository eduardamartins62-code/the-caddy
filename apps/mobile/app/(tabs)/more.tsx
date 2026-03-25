import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Switch, Alert, Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useMe } from '../../hooks/useQueries';
import { usersApi } from '../../services/api';
import AvatarRing from '../../components/ui/AvatarRing';
import SkeletonLoader from '../../components/ui/SkeletonLoader';
import { Colors, Radius, Spacing } from '../../constants/theme';
import { APP_CONFIG } from '../../constants/config';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MenuRowProps {
  icon: string;
  iconColor?: string;
  label: string;
  sublabel?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  destructive?: boolean;
  showChevron?: boolean;
}

// ─── Menu row ─────────────────────────────────────────────────────────────────

function MenuRow({
  icon,
  iconColor = Colors.textSecondary,
  label,
  sublabel,
  onPress,
  rightElement,
  destructive = false,
  showChevron = true,
}: MenuRowProps) {
  return (
    <TouchableOpacity
      style={styles.menuRow}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress && !rightElement}
    >
      <View style={[styles.menuIconBox, { backgroundColor: iconColor + '22' }]}>
        <Ionicons name={icon as any} size={19} color={iconColor} />
      </View>
      <View style={styles.menuRowText}>
        <Text style={[styles.menuLabel, destructive && styles.menuLabelDestructive]}>
          {label}
        </Text>
        {sublabel && <Text style={styles.menuSublabel}>{sublabel}</Text>}
      </View>
      {rightElement ?? (
        showChevron && onPress ? (
          <Ionicons name="chevron-forward" size={17} color={Colors.textMuted} />
        ) : null
      )}
    </TouchableOpacity>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MoreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { signOut } = useAuth();
  const { data: me, isLoading: meLoading } = useMe();

  const [pushEnabled, setPushEnabled] = useState(true);
  const [privacyLoading, setPrivacyLoading] = useState(false);

  const user = me as any;
  const isPrivate = !!user?.isPrivate;

  async function handlePrivacyToggle(value: boolean) {
    if (privacyLoading) return;
    setPrivacyLoading(true);
    try {
      await usersApi.updateMe({ isPrivate: value } as any);
      qc.invalidateQueries({ queryKey: ['me'] });
    } catch {
      Alert.alert('Error', 'Could not update privacy setting. Please try again.');
    } finally {
      setPrivacyLoading(false);
    }
  }

  function handleSignOut() {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            // Navigation is handled by the auth state change in the router
          },
        },
      ],
      { cancelable: true }
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.heading}>More</Text>

      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── User profile card ── */}
        <TouchableOpacity
          style={styles.profileCard}
          onPress={() => router.push('/profile/me' as any)}
          activeOpacity={0.75}
        >
          {meLoading || !user ? (
            <View style={styles.profileCardInner}>
              <SkeletonLoader width={56} height={56} borderRadius={28} />
              <View style={{ gap: 8, flex: 1 }}>
                <SkeletonLoader height={14} width="60%" />
                <SkeletonLoader height={12} width="40%" />
              </View>
            </View>
          ) : (
            <View style={styles.profileCardInner}>
              <AvatarRing uri={user.avatar} name={user.name} size={56} ring="lime" />
              <View style={{ flex: 1 }}>
                <Text style={styles.profileName}>{user.name}</Text>
                {user.username && (
                  <Text style={styles.profileUsername}>@{user.username}</Text>
                )}
                {user.email && (
                  <Text style={styles.profileEmail}>{user.email}</Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </View>
          )}
        </TouchableOpacity>

        {/* ── Navigation items ── */}
        <View style={styles.navSection}>
          <MenuRow
            icon="mail-outline"
            iconColor={Colors.lime}
            label="Messages"
            sublabel="Direct messages"
            onPress={() => router.push('/messages' as any)}
          />
          <MenuRow
            icon="calendar-outline"
            iconColor="#3B82F6"
            label="Schedule"
            sublabel="Golf rounds & tee times"
            onPress={() => router.push('/(tabs)/schedule' as any)}
          />
          <MenuRow
            icon="map-outline"
            iconColor={Colors.purple}
            label="Itinerary"
            sublabel="Trip day-by-day plan"
            onPress={() => router.push('/(tabs)/itinerary' as any)}
          />
          <MenuRow
            icon="trophy-outline"
            iconColor="#F59E0B"
            label="History"
            sublabel="Hall of Champions"
            onPress={() => router.push('/(tabs)/history' as any)}
          />
        </View>

        {/* ── Account ── */}
        <SectionHeader title="Account" />
        <View style={styles.section}>
          <MenuRow
            icon="create-outline"
            iconColor={Colors.lime}
            label="Edit Profile"
            onPress={() => router.push('/onboarding' as any)}
          />
          <MenuRow
            icon="lock-closed-outline"
            iconColor={Colors.purple}
            label="Private Account"
            sublabel="Only followers can see your posts"
            showChevron={false}
            rightElement={
              <Switch
                value={isPrivate}
                onValueChange={handlePrivacyToggle}
                disabled={privacyLoading}
                trackColor={{ false: Colors.bgTertiary, true: Colors.lime }}
                thumbColor={Colors.textPrimary}
                ios_backgroundColor={Colors.bgTertiary}
              />
            }
          />
        </View>

        {/* ── Notifications ── */}
        <SectionHeader title="Notifications" />
        <View style={styles.section}>
          <MenuRow
            icon="notifications-outline"
            iconColor="#3B82F6"
            label="Push Notifications"
            sublabel="Alerts for activity & events"
            showChevron={false}
            rightElement={
              <Switch
                value={pushEnabled}
                onValueChange={setPushEnabled}
                trackColor={{ false: Colors.bgTertiary, true: Colors.lime }}
                thumbColor={Colors.textPrimary}
                ios_backgroundColor={Colors.bgTertiary}
              />
            }
          />
        </View>

        {/* ── About ── */}
        <SectionHeader title="About" />
        <View style={styles.section}>
          <MenuRow
            icon="information-circle-outline"
            iconColor={Colors.textSecondary}
            label="App Version"
            sublabel={APP_CONFIG.version}
            showChevron={false}
          />
          <MenuRow
            icon="document-text-outline"
            iconColor={Colors.textSecondary}
            label="Terms of Service"
            onPress={() => Linking.openURL('https://thecaddy.app/terms')}
          />
          <MenuRow
            icon="shield-outline"
            iconColor={Colors.textSecondary}
            label="Privacy Policy"
            onPress={() => Linking.openURL('https://thecaddy.app/privacy')}
          />
        </View>

        {/* ── Danger zone ── */}
        <SectionHeader title="Danger Zone" />
        <View style={styles.section}>
          <MenuRow
            icon="log-out-outline"
            iconColor={Colors.error}
            label="Sign Out"
            destructive
            onPress={handleSignOut}
          />
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },

  heading: {
    color: Colors.textPrimary,
    fontSize: 26,
    fontWeight: '800',
    paddingHorizontal: Spacing.lg,
    marginBottom: 16,
  },

  list: {
    paddingHorizontal: Spacing.md,
    gap: 0,
  },

  // Profile card
  profileCard: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 16,
    marginBottom: 20,
  },
  profileCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  profileName: {
    color: Colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  profileUsername: {
    color: Colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  profileEmail: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 1,
  },

  // Navigation section (no section header)
  navSection: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: 'hidden',
    marginBottom: 20,
  },

  sectionHeader: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
    marginBottom: 6,
    marginTop: 4,
  },

  section: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: 'hidden',
    marginBottom: 20,
  },

  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  menuIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  menuRowText: { flex: 1 },
  menuLabel: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '500',
  },
  menuLabelDestructive: { color: Colors.error },
  menuSublabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
});
