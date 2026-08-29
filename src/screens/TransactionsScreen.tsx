import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ChoiceChips } from '../components/ChoiceChips';
import { FinButton } from '../components/FinButton';
import { FormField } from '../components/FormField';
import { RecurringPaymentsModal } from '../components/RecurringPaymentsModal';
import { Screen } from '../components/Screen';
import { TransactionRow } from '../components/TransactionRow';
import { useFinance } from '../context/FinanceContext';
import { parseTransactionsCsv } from '../services/csv';
import { colors, radii, spacing } from '../theme/colors';
import { Transaction, TransactionCategory, TransactionDirection, TRANSACTION_CATEGORIES } from '../types/finance';
import { confirmAction, showMessage } from '../utils/alerts';
import { toIsoDate } from '../utils/dates';
import { isValidIsoDate, parsePositiveMoney } from '../utils/validation';

type CategoryFilter = 'all' | TransactionCategory;

export function TransactionsScreen() {
  const { transactions, profile, addTransaction, deleteTransaction, importTransactions } = useFinance();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [addVisible, setAddVisible] = useState(false);
  const [scheduledVisible, setScheduledVisible] = useState(false);
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(profile.analysisDate ?? toIsoDate(new Date()));
  const [direction, setDirection] = useState<TransactionDirection>('debit');
  const [category, setCategory] = useState<TransactionCategory>('food');
  const [essential, setEssential] = useState<'flexible' | 'essential'>('flexible');
  const filtered = useMemo(() => transactions
    .filter((item) => filter === 'all' || item.category === filter)
    .filter((item) => `${item.merchant} ${item.category}`.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date)), [filter, search, transactions]);

  const openAdd = () => {
    setDate(profile.analysisDate ?? toIsoDate(new Date()));
    setAddVisible(true);
  };

  const importCsv = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'text/plain'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      if (result.assets[0].size && result.assets[0].size > 2_000_000) {
        showMessage('CSV is too large', 'Choose a file smaller than 2 MB (up to 5,000 data rows).');
        return;
      }
      const content = result.assets[0].file
        ? await result.assets[0].file.text()
        : await new File(result.assets[0].uri).text();
      const parsed = parseTransactionsCsv(content);
      if (!parsed.transactions.length) {
        showMessage('Nothing imported', parsed.errors.join('\n') || 'No valid transactions were found.');
        return;
      }
      const imported = importTransactions(parsed.transactions);
      const details = [
        `${imported.added} transaction${imported.added === 1 ? '' : 's'} added`,
        imported.skippedDuplicates ? `${imported.skippedDuplicates} duplicate${imported.skippedDuplicates === 1 ? '' : 's'} skipped` : '',
        parsed.errors.length ? `${parsed.errors.length} invalid row${parsed.errors.length === 1 ? '' : 's'} skipped` : '',
      ].filter(Boolean).join(' · ');
      showMessage(imported.added ? 'Import complete' : 'Already imported', details);
    } catch {
      showMessage('Could not import CSV', 'Use columns: date, merchant, amount, direction, category, essential.');
    }
  };

  const save = () => {
    const numericAmount = parsePositiveMoney(amount);
    const analysisDate = profile.analysisDate ?? toIsoDate(new Date());
    if (!merchant.trim() || numericAmount === null || !isValidIsoDate(date) || date > analysisDate) {
      showMessage(
        'Check the transaction',
        `Enter a merchant, positive amount, and a valid date no later than the dashboard date (${analysisDate}).`,
      );
      return;
    }
    addTransaction({
      merchant: merchant.trim(),
      amount: numericAmount,
      date,
      direction,
      category,
      essential: direction === 'debit' && essential === 'essential',
    });
    setMerchant('');
    setAmount('');
    setAddVisible(false);
  };

  const changeDirection = (value: TransactionDirection) => {
    setDirection(value);
    if (value === 'credit') {
      setCategory('income');
      setEssential('flexible');
    } else if (category === 'income') {
      setCategory('food');
    }
  };

  const remove = (transaction: Transaction) => confirmAction({
    title: 'Remove transaction?',
    message: transaction.source === 'manual'
      ? `${transaction.merchant} will be removed and its balance change will be reversed.`
      : `${transaction.merchant} will be removed from this imported dataset.`,
    confirmLabel: 'Remove',
    destructive: true,
    onConfirm: () => deleteTransaction(transaction.id),
  });

  return (
    <>
      <Screen title="Transactions" subtitle={`${transactions.length} local transactions · Search the evidence behind every warning.`}>
        <View style={styles.actions}>
          <FinButton label="Add" icon="plus" onPress={openAdd} style={styles.actionButton} />
          <FinButton label="Import CSV" icon="upload" variant="secondary" onPress={() => void importCsv()} style={styles.actionButton} />
          <FinButton label="Scheduled" icon="calendar" variant="secondary" onPress={() => setScheduledVisible(true)} style={styles.actionButton} />
        </View>
        <View style={styles.search}>
          <Feather name="search" size={18} color={colors.textMuted} />
          <TextInput
            accessibilityLabel="Search transactions"
            value={search}
            onChangeText={setSearch}
            placeholder="Search merchant or category"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            selectionColor={colors.primary}
          />
          {search ? (
            <Pressable accessibilityLabel="Clear transaction search" onPress={() => setSearch('')}>
              <Feather name="x-circle" size={17} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
        <ChoiceChips values={['all', ...TRANSACTION_CATEGORIES]} selected={filter} onSelect={setFilter} style={styles.filters} />
        <View style={styles.listCard}>
          {filtered.slice(0, 120).map((item) => (
            <TransactionRow
              key={item.id}
              transaction={item}
              onPress={item.source === 'manual' || item.source === 'csv' ? () => remove(item) : undefined}
            />
          ))}
          {!filtered.length ? <Text style={styles.empty}>No matching transactions.</Text> : null}
          {filtered.length > 120 ? <Text style={styles.limit}>Showing the newest 120 of {filtered.length} matching transactions.</Text> : null}
        </View>
        <View style={styles.csvHelp}>
          <Feather name="info" size={16} color={colors.primary} />
          <Text style={styles.csvText}>CSV columns: date, merchant, amount, direction, category, essential. Re-imported rows are skipped, and importing never changes the balance.</Text>
        </View>
      </Screen>

      <Modal visible={addVisible} transparent animationType="slide" onRequestClose={() => setAddVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setAddVisible(false)}>
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add transaction</Text>
              <Pressable accessibilityLabel="Close add transaction" onPress={() => setAddVisible(false)}>
                <Feather name="x" size={22} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetContent}>
              <Text style={styles.fieldLabel}>Transaction type</Text>
              <ChoiceChips values={['debit', 'credit']} selected={direction} onSelect={changeDirection} />
              <View style={styles.firstField}>
                <FormField label="Merchant or description" value={merchant} onChangeText={setMerchant} placeholder={direction === 'credit' ? 'e.g. Freelance payment' : 'e.g. Swiggy'} />
              </View>
              <FormField label="Amount (₹)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="500" />
              <FormField label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} />
              <Text style={styles.fieldLabel}>Category</Text>
              <ChoiceChips
                values={direction === 'credit' ? ['income', 'other'] : TRANSACTION_CATEGORIES.filter((value) => value !== 'income')}
                selected={category}
                onSelect={setCategory}
              />
              {direction === 'debit' ? (
                <>
                  <Text style={[styles.fieldLabel, styles.spacedLabel]}>Spending type</Text>
                  <ChoiceChips values={['flexible', 'essential']} selected={essential} onSelect={setEssential} />
                </>
              ) : null}
              <View style={styles.balanceNote}>
                <Feather name="info" size={15} color={colors.primary} />
                <Text style={styles.balanceNoteText}>Saving updates the available balance. Removing this entry later reverses that change.</Text>
              </View>
              <FinButton label="Save transaction" icon="check" onPress={save} style={styles.saveButton} />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <RecurringPaymentsModal visible={scheduledVisible} onClose={() => setScheduledVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actionButton: { flexGrow: 1, flexBasis: 100 },
  search: { height: 48, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, marginTop: spacing.lg },
  searchInput: { flex: 1, color: colors.text, fontSize: 14, height: '100%' },
  filters: { paddingVertical: spacing.md },
  listCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, paddingHorizontal: spacing.lg },
  empty: { color: colors.textSecondary, padding: spacing.xxl, textAlign: 'center' },
  limit: { color: colors.textMuted, padding: spacing.md, textAlign: 'center', fontSize: 10 },
  csvHelp: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', marginTop: spacing.md, paddingHorizontal: spacing.sm },
  csvText: { color: colors.textMuted, fontSize: 10, lineHeight: 15, flex: 1 },
  backdrop: { flex: 1, backgroundColor: '#000000A6', justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 680, maxHeight: '92%', backgroundColor: colors.surface, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, borderWidth: 1, borderColor: colors.border },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.xl, paddingBottom: spacing.md },
  modalTitle: { color: colors.text, fontSize: 22, fontWeight: '900' },
  sheetContent: { padding: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.xxxl },
  fieldLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '800', marginBottom: spacing.sm },
  spacedLabel: { marginTop: spacing.lg },
  firstField: { marginTop: spacing.lg },
  balanceNote: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.primarySoft, borderColor: `${colors.primary}55`, borderWidth: 1, borderRadius: radii.md, padding: spacing.md, marginTop: spacing.lg },
  balanceNoteText: { color: colors.textSecondary, fontSize: 10.5, lineHeight: 16, flex: 1 },
  saveButton: { marginTop: spacing.xl },
});
