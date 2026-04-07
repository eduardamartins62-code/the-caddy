import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Switch, Alert,
  ActivityIndicator, StyleSheet, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Copy, Plus } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { API_BASE } from '../../constants/api';

export default function InviteCodesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [inviteOnly, setInviteOnly] = useState(false);
  const [codes, setCodes] = useState<any[]>([]);
  const [waitlist, setWaitlist] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  async function authHeader() {
    const token = await SecureStore.getItemAsync('auth_token');
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await authHeader();
      const [settingsRes, codesRes, waitlistRes] = await Promise.all([
        fetch(`${API_BASE}/admin/settings`, { headers }).then(r => r.json()),
        fetch(`${API_BASE}/admin/invites`, { headers }).then(r => r.json()),
        fetch(`${API_BASE}/admin/waitlist`, { headers }).then(r => r.json()),
      ]);
      setInviteOnly(settingsRes.data?.inviteOnly === 'true');
      setCodes(codesRes.data || []);
      setWaitlist(waitlistRes.data || []);
    } catch {
      // silently fail; user can pull-to-refresh
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function toggleInviteOnly(val: boolean) {
    setInviteOnly(val);
    const headers = await authHeader();
    await fetch(`${API_BASE}/admin/settings`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ inviteOnly: val }),
    });
  }

  async function generateCode() {
    setGenerating(true);
    try {
      const headers = await authHeader();
      const res = await fetch(`${API_BASE}/admin/invites`, {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.data) {
        Alert.alert('New Code Generated', `Code: ${data.data.code}`, [
          { text: 'Copy', onPress: () => Clipboard.setStringAsync(data.data.code) },
          { text: 'OK' },
        ]);
        loadData();
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to generate code');
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={Colors.gold} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.screen, { paddingTop: insets.top }]}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Invite Codes</Text>
      </View>

      {/* Invite-Only toggle */}
      <View style={styles.section}>
        <View style={styles.row}>
          <Text style={styles.label}>Invite-Only Mode</Text>
          <Switch
            value={inviteOnly}
            onValueChange={toggleInviteOnly}
            trackColor={{ true: Colors.gold }}
          />
        </View>
        <Text style={styles.hint}>
          {inviteOnly
            ? 'New users must have an invite code to sign up.'
            : 'Open registration — anyone can sign up.'}
        </Text>
      </View>

      {/* Codes list */}
      <View style={[styles.section, { marginTop: Spacing.md }]}>
        <View style={styles.row}>
          <Text style={styles.sectionTitle}>Invite Codes</Text>
          <TouchableOpacity onPress={generateCode} style={styles.btn} disabled={generating}>
            <Plus size={16} color="#000" />
            <Text style={styles.btnText}>{generating ? 'Generating...' : 'Generate'}</Text>
          </TouchableOpacity>
        </View>
        {codes.map((c: any) => (
          <View key={c.id} style={styles.codeRow}>
            <Text style={styles.code}>{c.code}</Text>
            <Text style={styles.codeStatus}>
              {c.isActive ? (c.usedById ? 'Used' : 'Active') : 'Inactive'}
            </Text>
            <TouchableOpacity onPress={() => Clipboard.setStringAsync(c.code)}>
              <Copy size={16} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        ))}
        {codes.length === 0 && (
          <Text style={styles.empty}>No codes generated yet</Text>
        )}
      </View>

      {/* Waitlist */}
      <View style={[styles.section, { marginTop: Spacing.md, marginBottom: Spacing.xl }]}>
        <Text style={styles.sectionTitle}>Waitlist ({waitlist.length})</Text>
        {waitlist.map((w: any) => (
          <View key={w.id} style={styles.waitRow}>
            <Text style={styles.waitEmail}>{w.email}</Text>
            <Text style={styles.waitDate}>{new Date(w.createdAt).toLocaleDateString()}</Text>
          </View>
        ))}
        {waitlist.length === 0 && (
          <Text style={styles.empty}>Waitlist is empty</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: Colors.bg },
  center:  { alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    padding: Spacing.md, paddingBottom: 8,
  },
  back:  { color: Colors.gold, fontSize: 16 },
  title: { color: Colors.textPrimary, fontSize: 20, fontWeight: '700' },

  section: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.cardBorder,
    padding: Spacing.md,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 8,
  },
  label:        { color: Colors.textPrimary, fontSize: 16, fontWeight: '600' },
  hint:         { color: Colors.textSecondary, fontSize: 13 },
  sectionTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700' },

  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.gold,
    borderRadius: Radius.pill,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  btnText: { color: '#000', fontWeight: '700', fontSize: 13 },

  codeRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: Colors.cardBorder,
  },
  code:       { color: Colors.textPrimary, fontFamily: 'monospace', fontSize: 16, fontWeight: '700', letterSpacing: 2 },
  codeStatus: { color: Colors.textSecondary, fontSize: 12 },

  waitRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 8, borderTopWidth: 1, borderTopColor: Colors.cardBorder,
  },
  waitEmail: { color: Colors.textPrimary, fontSize: 14 },
  waitDate:  { color: Colors.textSecondary, fontSize: 12 },

  empty: { color: Colors.textMuted, fontSize: 14, textAlign: 'center', paddingVertical: 16 },
});
