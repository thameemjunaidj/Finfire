import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing } from '../theme/colors';
import { Transaction } from '../types/finance';
import { categoryIcon, formatCurrency, formatDate, titleCase } from '../utils/format';

export function TransactionRow({ transaction, onPress }: { transaction: Transaction; onPress?: () => void }) {
  const credit = transaction.direction === 'credit';
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${transaction.merchant}, ${credit ? 'credit' : 'debit'} ${formatCurrency(transaction.amount)}`}
      accessibilityHint={onPress ? 'Opens options for this transaction' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[styles.icon, { backgroundColor: credit ? colors.safeSoft : colors.surfaceRaised }]}>
        <Feather name={categoryIcon(transaction.category) as keyof typeof Feather.glyphMap} size={18} color={credit ? colors.safe : colors.textSecondary} />
      </View>
      <View style={styles.info}>
        <View style={styles.merchantRow}>
          <Text style={styles.merchant} numberOfLines={1}>{transaction.merchant}</Text>
          {transaction.recurringGroupId ? <Feather name="repeat" size={12} color={colors.primary} /> : null}
        </View>
        <Text style={styles.meta}>{formatDate(transaction.date)} · {titleCase(transaction.category)} · {transaction.essential ? 'Essential' : 'Flexible'}{transaction.source && transaction.source !== 'demo' ? ` · ${titleCase(transaction.source)}` : ''}</Text>
      </View>
      <Text style={[styles.amount, { color: credit ? colors.safe : colors.text }]}>{credit ? '+' : '−'}{formatCurrency(transaction.amount)}</Text>
      {onPress ? <Feather name="more-vertical" size={16} color={colors.textMuted} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  pressed: { opacity: 0.72 },
  icon: { width: 40, height: 40, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, minWidth: 0 },
  merchantRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  merchant: { color: colors.text, fontSize: 14, fontWeight: '800', flexShrink: 1 },
  meta: { color: colors.textMuted, fontSize: 10.5, marginTop: 4 },
  amount: { fontSize: 14, fontWeight: '900' },
});
