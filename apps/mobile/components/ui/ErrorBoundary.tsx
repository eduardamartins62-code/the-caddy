import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Spacing } from '../../constants/theme';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}
interface State { hasError: boolean; error?: Error; }

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.sub}>{this.state.error?.message}</Text>
          <TouchableOpacity style={styles.btn} onPress={() => this.setState({ hasError: false })}>
            <Text style={styles.btnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg, padding: Spacing.lg },
  title: { color: Colors.textPrimary, fontSize: 20, fontWeight: '700', marginBottom: 8 },
  sub: { color: Colors.textSecondary, fontSize: 14, textAlign: 'center', marginBottom: 24 },
  btn: { backgroundColor: Colors.limeDim, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  btnText: { color: Colors.lime, fontWeight: '700' },
});
