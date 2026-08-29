import { Feather } from '@expo/vector-icons';
import React, { ErrorInfo, PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing } from '../theme/colors';
import { APP_NAME } from '../theme/brand';
import { FinButton } from './FinButton';

interface ErrorBoundaryState {
  failed: boolean;
}

export class ErrorBoundary extends React.Component<PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`${APP_NAME} render failure`, error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View style={styles.page}>
        <View style={styles.card}>
          <View style={styles.icon}><Feather name="alert-triangle" size={28} color={colors.critical} /></View>
          <Text style={styles.title}>{APP_NAME} hit an unexpected problem</Text>
          <Text style={styles.message}>Your saved local data has not been erased. Try loading the interface again.</Text>
          <FinButton label="Try again" icon="refresh-cw" onPress={() => this.setState({ failed: false })} style={styles.button} />
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  card: { width: '100%', maxWidth: 480, alignItems: 'center', backgroundColor: colors.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.xxl },
  icon: { width: 58, height: 58, borderRadius: 20, backgroundColor: colors.criticalSoft, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontSize: 21, fontWeight: '900', textAlign: 'center', marginTop: spacing.lg },
  message: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: spacing.sm },
  button: { alignSelf: 'stretch', marginTop: spacing.xl },
});
