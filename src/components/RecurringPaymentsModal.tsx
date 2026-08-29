import { Feather } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFinance } from '../context/FinanceContext';
import { colors, radii, spacing } from '../theme/colors';
import { TransactionCategory, TRANSACTION_CATEGORIES } from '../types/finance';
import { formatCurrency, formatDate, plainLabel } from '../utils/format';
import { confirmAction, showMessage } from '../utils/alerts';
import { toIsoDate } from '../utils/dates';
import { isDateOnOrAfter, parseNonNegativeMoney, parsePositiveMoney } from '../utils/validation';
import { ChoiceChips } from './ChoiceChips';
import { FinButton } from './FinButton';
import { FormField } from './FormField';

const paymentCategories = TRANSACTION_CATEGORIES.filter((category) => category !== 'income');

export function RecurringPaymentsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { profile, recurringPayments, addRecurringPayment, deleteRecurringPayment } = useFinance();
  const [adding, setAdding] = useState(false);
  const [merchant, setMerchant] = useState('');
  const [previousAmount, setPreviousAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [date, setDate] = useState(profile.analysisDate ?? toIsoDate(new Date()));
  const [category, setCategory] = useState<TransactionCategory>('subscription');
  const [spendingType, setSpendingType] = useState<'flexible' | 'essential'>('flexible');
  const sortedPayments = useMemo(
    () => [...recurringPayments].sort((a, b) => a.nextPaymentDate.localeCompare(b.nextPaymentDate)),
    [recurringPayments],
  );

  useEffect(() => {
    if (!visible) return;
    const minimumDate = profile.analysisDate ?? toIsoDate(new Date());
    if (date < minimumDate) setDate(minimumDate);
  }, [date, profile.analysisDate, visible]);

  const close = () => {
    setAdding(false);
    onClose();
  };

  const save = () => {
    const current = parsePositiveMoney(currentAmount);
    const previous = previousAmount.trim() ? parseNonNegativeMoney(previousAmount) : current;
    const minimumDate = profile.analysisDate ?? toIsoDate(new Date());
    if (!merchant.trim() || current === null || previous === null || !isDateOnOrAfter(date, minimumDate)) {
      showMessage('Check the bill details', `Enter a name, valid amounts, and a payment date on or after ${minimumDate}.`);
      return;
    }
    addRecurringPayment({
      merchant: merchant.trim(),
      previousAmount: previous,
      currentAmount: current,
      nextPaymentDate: date,
      category,
      essential: spendingType === 'essential',
    });
    setMerchant('');
    setPreviousAmount('');
    setCurrentAmount('');
    setAdding(false);
  };

  const remove = (id: string, name: string) => confirmAction({
    title: 'Remove this upcoming bill?',
    message: `${name} will no longer be included in your warnings or days-left estimate.`,
    confirmLabel: 'Remove',
    destructive: true,
    onConfirm: () => deleteRecurringPayment(id),
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>Upcoming bills</Text>
              <Text style={styles.subtitle}>Add regular payments so the app can warn you before several are due together.</Text>
            </View>
            <Pressable accessibilityLabel="Close scheduled payments" onPress={close} style={styles.close}>
              <Feather name="x" size={20} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
            {!adding ? (
              <>
                <FinButton label="Add an upcoming bill" icon="plus" onPress={() => setAdding(true)} />
                <View style={styles.list}>
                  {sortedPayments.map((payment) => (
                    <View key={payment.id} style={styles.paymentRow}>
                      <View style={styles.paymentIcon}><Feather name="calendar" size={18} color={colors.primary} /></View>
                      <View style={styles.paymentInfo}>
                        <Text style={styles.paymentName}>{payment.merchant}</Text>
                        <Text style={styles.paymentMeta}>{formatDate(payment.nextPaymentDate, true)} · {plainLabel(payment.category)} · {payment.essential ? 'Essential' : 'Optional'}</Text>
                        {payment.currentAmount !== payment.previousAmount ? (
                          <Text style={styles.change}>{formatCurrency(payment.previousAmount)} → {formatCurrency(payment.currentAmount)}</Text>
                        ) : null}
                      </View>
                      <Text style={styles.paymentAmount}>{formatCurrency(payment.currentAmount)}</Text>
                      <Pressable
                        accessibilityLabel={`Remove ${payment.merchant}`}
                        onPress={() => remove(payment.id, payment.merchant)}
                        hitSlop={10}
                        style={styles.remove}
                      >
                        <Feather name="trash-2" size={16} color={colors.critical} />
                      </Pressable>
                    </View>
                  ))}
                  {!sortedPayments.length ? <Text style={styles.empty}>No upcoming bills added yet.</Text> : null}
                </View>
              </>
            ) : (
              <View>
                <Text style={styles.formTitle}>Add an upcoming bill</Text>
                <FormField label="Bill or service name" value={merchant} onChangeText={setMerchant} placeholder="e.g. Netflix" />
                <FormField label="Current amount (₹)" value={currentAmount} onChangeText={setCurrentAmount} keyboardType="decimal-pad" placeholder="649" />
                <FormField label="Previous amount (₹, optional)" value={previousAmount} onChangeText={setPreviousAmount} keyboardType="decimal-pad" placeholder="649" />
                <FormField label="Next payment date (YYYY-MM-DD)" value={date} onChangeText={setDate} placeholder="2026-09-01" />
                <Text style={styles.label}>What is it for?</Text>
                <ChoiceChips values={paymentCategories} selected={category} onSelect={setCategory} />
                <Text style={[styles.label, styles.spacedLabel]}>Is this essential?</Text>
                <ChoiceChips values={['flexible', 'essential']} selected={spendingType} onSelect={setSpendingType} />
                <FinButton label="Save bill" icon="check" onPress={save} style={styles.save} />
                <FinButton label="Cancel" variant="ghost" onPress={() => setAdding(false)} style={styles.cancel} />
              </View>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000000A6', justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 720, maxHeight: '92%', backgroundColor: colors.surface, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, borderWidth: 1, borderColor: colors.border },
  header: { flexDirection: 'row', alignItems: 'flex-start', padding: spacing.xl, paddingBottom: spacing.md, gap: spacing.md },
  headerText: { flex: 1 },
  title: { color: colors.text, fontSize: 22, fontWeight: '900' },
  subtitle: { color: colors.textMuted, fontSize: 11, lineHeight: 17, marginTop: 4 },
  close: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceRaised },
  scrollContent: { padding: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.xxxl },
  list: { marginTop: spacing.lg, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md },
  paymentRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  paymentIcon: { width: 36, height: 36, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  paymentInfo: { flex: 1, minWidth: 0 },
  paymentName: { color: colors.text, fontSize: 13, fontWeight: '900' },
  paymentMeta: { color: colors.textMuted, fontSize: 9.5, lineHeight: 14, marginTop: 3 },
  change: { color: colors.high, fontSize: 10, fontWeight: '800', marginTop: 3 },
  paymentAmount: { color: colors.text, fontSize: 13, fontWeight: '900' },
  remove: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  empty: { color: colors.textMuted, textAlign: 'center', padding: spacing.xl },
  formTitle: { color: colors.text, fontSize: 17, fontWeight: '900', marginBottom: spacing.lg },
  label: { color: colors.textSecondary, fontSize: 12, fontWeight: '800', marginBottom: spacing.sm },
  spacedLabel: { marginTop: spacing.lg },
  save: { marginTop: spacing.xl },
  cancel: { marginTop: spacing.sm },
});
