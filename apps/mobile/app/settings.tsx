import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Switch, Alert, Linking, TextInput, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../context/AuthContext';
import { useMe } from '../hooks/useQueries';
import { usersApi } from '../services/api';
import { Colors, Radius, Spacing } from '../constants/theme';
import { APP_CONFIG } from '../constants/config';
import { API_BASE } from '../constants/api';

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

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { signOut } = useAuth();
  const { data: me } = useMe();

  const [pushEnabled, setPushEnabled] = useState(true);
  const [privacyLoading, setPrivacyLoading] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

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

  async function handleDeleteAccount() {
    if (deleteConfirmText !== 'DELETE') {
      Alert.alert('Error', 'Please type DELETE to confirm.');
      return;
    }
    setDeleting(true);
    try {
      const token = await SecureStore.getItemAsync('auth_token');
      await fetch(`${API_BASE}/users/me`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      await SecureStore.deleteItemAsync('auth_token');
      setDeleteModalVisible(false);
      await signOut();
      router.replace('/(auth)/signin' as any);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to delete account. Please try again.');
    } finally {
      setDeleting(false);
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
          },
        },
      ],
      { cancelable: true }
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.heading}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Account ── */}
        <SectionHeader title="Account" />
        <View style={styles.section}>
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

        {/* ── Info ── */}
        <SectionHeader title="Info" />
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
          <TouchableOpacity
            style={styles.signOutBtn}
            onPress={handleSignOut}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconBox, { backgroundColor: Colors.error + '22' }]}>
              <Ionicons name="log-out-outline" size={19} color={Colors.error} />
            </View>
            <Text style={styles.signOutLabel}>Sign Out</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.signOutBtn, { borderTopWidth: 1, borderTopColor: Colors.cardBorder }]}
            onPress={() => { setDeleteConfirmText(''); setDeleteModalVisible(true); }}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconBox, { backgroundColor: Colors.error + '22' }]}>
              <Ionicons name="trash-outline" size={19} color={Colors.error} />
            </View>
            <Text style={styles.signOutLabel}>Delete Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Delete Account confirmation modal */}
      <Modal
        visible={deleteModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.deleteModal}>
          <Text style={styles.deleteModalTitle}>Delete Account</Text>
          <Text style={styles.deleteModalSub}>
            This action is permanent and cannot be undone. All your data will be deleted.
          </Text>
          <Text style={[styles.deleteModalSub, { marginTop: 16 }]}>
            Type <Text style={{ color: Colors.error, fontWeight: '700' }}>DELETE</Text> to confirm:
          </Text>
          <TextInput
            style={styles.deleteInput}
            value={deleteConfirmText}
            onChangeText={setDeleteConfirmText}
            placeholder="DELETE"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.deleteBtn, deleteConfirmText !== 'DELETE' && { opacity: 0.5 }]}
            onPress={handleDeleteAccount}
            disabled={deleting || deleteConfirmText !== 'DELETE'}
            activeOpacity={0.8}
          >
            <Text style={styles.deleteBtnText}>{deleting ? 'Deleting...' : 'Delete My Account'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteCancelBtn}
            onPress={() => setDeleteModalVisible(false)}
          >
            <Text style={styles.deleteCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.bgSecondary, borderWidth: 1, borderColor: Colors.cardBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  heading: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  headerSpacer: { width: 38 },

  list: {
    paddingHorizontal: Spacing.md,
    paddingTop: 16,
    gap: 0,
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

  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 14,
  },
  signOutLabel: {
    color: Colors.error,
    fontSize: 15,
    fontWeight: '600',
  },

  // Delete account modal
  deleteModal: {
    flex: 1,
    backgroundColor: Colors.bg,
    padding: Spacing.lg,
    paddingTop: 48,
  },
  deleteModalTitle: {
    color: Colors.error,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 12,
  },
  deleteModalSub: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  deleteInput: {
    marginTop: 12,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1.5, borderColor: Colors.error + '55',
    borderRadius: Radius.md,
    paddingHorizontal: 14, paddingVertical: 12,
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 20,
  },
  deleteBtn: {
    backgroundColor: Colors.error,
    borderRadius: Radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  deleteBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  deleteCancelBtn: {
    borderWidth: 1, borderColor: Colors.cardBorder,
    borderRadius: Radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteCancelText: { color: Colors.textSecondary, fontSize: 15, fontWeight: '600' },
});
