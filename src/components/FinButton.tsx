import { Feather } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import { colors, radii, spacing } from '../theme/colors';

interface FinButtonProps {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Feather.glyphMap;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function FinButton({ label, onPress, icon, variant = 'primary', disabled, loading, style }: FinButtonProps) {
  const palette = {
    primary: { background: colors.primary, border: colors.primary, text: colors.white },
    secondary: { background: colors.surfaceRaised, border: colors.border, text: colors.text },
    ghost: { background: 'transparent', border: colors.border, text: colors.textSecondary },
    danger: { background: colors.criticalSoft, border: colors.critical, text: colors.critical },
  }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled || loading), busy: Boolean(loading) }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.background, borderColor: palette.border, opacity: disabled || loading ? 0.45 : pressed ? 0.78 : 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={palette.text} /> : icon ? <Feather name={icon} size={17} color={palette.text} /> : null}
      <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 46,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  label: { fontSize: 15, fontWeight: '800' },
});
