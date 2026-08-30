import React, { PropsWithChildren, ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme/colors';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';

interface ScreenProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}

export function Screen({ title, subtitle, action, children, refreshing = false, onRefresh }: ScreenProps) {
  const keyboard = useKeyboardHeight();

  return (
    /**
     * The outer View is the keyboard fix, and it belongs here rather than in
     * each screen: every screen in the app is built out of this component, so
     * one padding does the lot. Shrinking the container is deliberate — it
     * makes the ScrollView's viewport smaller, which is what lets a form field
     * near the bottom be scrolled up into what is left, exactly as Android's
     * adjustResize used to arrange for us before edge-to-edge.
     */
    <View style={[styles.frame, { paddingBottom: keyboard }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          // The 116 is clearance for the floating tab bar. With the keyboard
          // up the tab bar is behind it anyway, so that space is only in the
          // way of the field being typed into.
          keyboard > 0 && styles.contentWithKeyboard,
        ]}
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
    </View>
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
  frame: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 116 },
  contentWithKeyboard: { paddingBottom: spacing.xl },
  inner: { width: '100%', maxWidth: 920, alignSelf: 'center', paddingHorizontal: spacing.lg },
  header: { paddingTop: spacing.xl, paddingBottom: spacing.xl, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  titleBlock: { flex: 1 },
  title: { color: colors.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.7 },
  subtitle: { color: colors.textSecondary, fontSize: 14, marginTop: 4, lineHeight: 20 },
  sectionHeader: { marginTop: spacing.xxl, marginBottom: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
});
