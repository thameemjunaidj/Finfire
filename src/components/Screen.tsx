import React, { PropsWithChildren, ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme/colors';

interface ScreenProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}

export function Screen({ title, subtitle, action, children, refreshing = false, onRefresh }: ScreenProps) {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
    >
      <View style={styles.inner}>
        <View style={styles.header}>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {action}
        </View>
        {children}
      </View>
    </ScrollView>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 116 },
  inner: { width: '100%', maxWidth: 920, alignSelf: 'center', paddingHorizontal: spacing.lg },
  header: { paddingTop: spacing.xl, paddingBottom: spacing.xl, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  titleBlock: { flex: 1 },
  title: { color: colors.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.7 },
  subtitle: { color: colors.textSecondary, fontSize: 14, marginTop: 4, lineHeight: 20 },
  sectionHeader: { marginTop: spacing.xxl, marginBottom: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
});
