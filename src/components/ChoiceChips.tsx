import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, ViewStyle } from 'react-native';
import { colors, radii, spacing } from '../theme/colors';
import { plainLabel } from '../utils/format';

export function ChoiceChips<T extends string>({ values, selected, onSelect, style }: { values: T[]; selected: T; onSelect: (value: T) => void; style?: ViewStyle }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.row, style]}>
      {values.map((value) => {
        const active = selected === value;
        return (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityLabel={plainLabel(value)}
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(value)}
            style={[styles.chip, active && styles.activeChip]}
          >
            <Text style={[styles.label, active && styles.activeLabel]}>{plainLabel(value)}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingRight: spacing.lg },
  chip: { borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: 9 },
  activeChip: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  label: { color: colors.textSecondary, fontSize: 12, fontWeight: '800' },
  activeLabel: { color: colors.primary },
});
