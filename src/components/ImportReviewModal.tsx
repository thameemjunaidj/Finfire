import { Feather } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { reviewBatch } from '../engine/reviewEngine';
import { colors, radii, spacing } from '../theme/colors';
import { Transaction, TransactionCategory, TRANSACTION_CATEGORIES } from '../types/finance';
import { formatCurrency, plainLabel } from '../utils/format';
import { ChoiceChips } from './ChoiceChips';
import { FinButton } from './FinButton';

export interface PendingImport {
  title: string;
  transactions: Transaction[];
  mapping?: Record<string, string>;
  problems: string[];
  rowsRead?: number;
}

interface ImportReviewModalProps {
  pending: PendingImport | null;
  history: Transaction[];
  onChangeCategory: (id: string, category: TransactionCategory) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ImportReviewModal({ pending, history, onChangeCategory, onCancel, onConfirm }: ImportReviewModalProps) {
  const review = useMemo(
    () => reviewBatch(history, pending?.transactions ?? []),
    [history, pending?.transactions],
  );

  return (
    <Modal visible={pending !== null} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>CHECK BEFORE SAVING</Text>
              <Text style={styles.title}>{pending?.title ?? 'Review spending'}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close import review" onPress={onCancel}>
              <Feather name="x" size={22} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.summaryCard}>
              <Feather name={review.items.length ? 'alert-circle' : 'check-circle'} size={20} color={review.items.length ? colors.watch : colors.safe} />
              <View style={styles.flex}>
                <Text style={styles.summary}>{review.summary}</Text>
                <Text style={styles.helper}>Nothing is saved until you tap “Add these entries”.</Text>
              </View>
            </View>

            {pending?.mapping && Object.keys(pending.mapping).length ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>What we found in the file</Text>
                {Object.entries(pending.mapping).map(([column, meaning]) => (
                  <Text key={column} style={styles.mapping}>{column} → {meaning}</Text>
                ))}
                {pending.rowsRead !== undefined ? <Text style={styles.muted}>{pending.rowsRead} rows checked</Text> : null}
              </View>
            ) : null}

            {review.items.length ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Worth checking</Text>
                {review.items.map((item) => (
                  <View key={`${item.flag}-${item.transaction.id}`} style={styles.reviewItem}>
                    <Text style={styles.reviewHeadline}>{item.headline}</Text>
                    <Text style={styles.reviewDetail}>{item.detail}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {pending?.problems.length ? (
              <View style={styles.problemBox}>
                <Text style={styles.problemTitle}>Rows we skipped</Text>
                {pending.problems.map((problem, index) => <Text key={`${problem}-${index}`} style={styles.problem}>• {problem}</Text>)}
              </View>
            ) : null}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Check each category</Text>
              <Text style={styles.muted}>Tap a category to correct it. FinFire remembers your choices for the next import.</Text>
              {pending?.transactions.map((transaction) => (
                <View key={transaction.id} style={styles.transactionCard}>
                  <View style={styles.transactionTop}>
                    <View style={styles.flex}>
                      <Text style={styles.merchant}>{transaction.merchant}</Text>
                      <Text style={styles.meta}>{transaction.date} · {plainLabel(transaction.direction)}</Text>
                    </View>
                    <Text style={[styles.amount, transaction.direction === 'credit' && styles.credit]}>
                      {transaction.direction === 'credit' ? '+' : '−'}{formatCurrency(transaction.amount)}
                    </Text>
                  </View>
                  <ChoiceChips
                    values={transaction.direction === 'credit'
                      ? ['income', 'other']
                      : TRANSACTION_CATEGORIES.filter((value) => value !== 'income')}
                    selected={transaction.category}
                    onSelect={(category) => onChangeCategory(transaction.id, category)}
                    style={styles.chips}
                  />
                </View>
              ))}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <FinButton label="Cancel" variant="ghost" onPress={onCancel} style={styles.footerButton} />
            <FinButton
              label={`Add ${pending?.transactions.length ?? 0} ${pending?.transactions.length === 1 ? 'entry' : 'entries'}`}
              icon="check"
              onPress={onConfirm}
              disabled={!pending?.transactions.length}
              style={styles.footerButton}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000000B8', justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 720, height: '94%', backgroundColor: colors.surface, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, borderWidth: 1, borderColor: colors.border },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerCopy: { flex: 1, paddingRight: spacing.md },
  eyebrow: { color: colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: colors.text, fontSize: 22, fontWeight: '900', marginTop: spacing.xs },
  content: { padding: spacing.xl, paddingBottom: spacing.xxl },
  summaryCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, borderRadius: radii.lg, backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  flex: { flex: 1 },
  summary: { color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: '800' },
  helper: { color: colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: spacing.xs },
  section: { marginTop: spacing.xl },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: '900', marginBottom: spacing.sm },
  mapping: { color: colors.textSecondary, fontSize: 12, lineHeight: 20 },
  muted: { color: colors.textMuted, fontSize: 11, lineHeight: 17 },
  reviewItem: { borderLeftWidth: 3, borderLeftColor: colors.watch, paddingLeft: spacing.md, marginTop: spacing.md },
  reviewHeadline: { color: colors.text, fontSize: 13, fontWeight: '800' },
  reviewDetail: { color: colors.textSecondary, fontSize: 11, lineHeight: 17, marginTop: spacing.xs },
  problemBox: { marginTop: spacing.xl, backgroundColor: colors.watchSoft, borderWidth: 1, borderColor: colors.watch, borderRadius: radii.md, padding: spacing.md },
  problemTitle: { color: colors.text, fontSize: 12, fontWeight: '900', marginBottom: spacing.xs },
  problem: { color: colors.textSecondary, fontSize: 11, lineHeight: 17 },
  transactionCard: { marginTop: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, backgroundColor: colors.backgroundRaised, padding: spacing.md },
  transactionTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  merchant: { color: colors.text, fontSize: 14, fontWeight: '800' },
  meta: { color: colors.textMuted, fontSize: 10, marginTop: spacing.xs },
  amount: { color: colors.text, fontSize: 14, fontWeight: '900' },
  credit: { color: colors.safe },
  chips: { paddingTop: spacing.md },
  footer: { flexDirection: 'row', gap: spacing.sm, padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
  footerButton: { flex: 1 },
});
