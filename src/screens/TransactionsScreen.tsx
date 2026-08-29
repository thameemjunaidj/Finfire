import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import React, { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ChoiceChips } from '../components/ChoiceChips';
import { FinButton } from '../components/FinButton';
import { FormField } from '../components/FormField';
import { Screen } from '../components/Screen';
import { TransactionRow } from '../components/TransactionRow';
import { useFinance } from '../context/FinanceContext';
import { parseTransactionsCsv } from '../services/csv';
import { colors, radii, spacing } from '../theme/colors';
import { TransactionCategory, TRANSACTION_CATEGORIES } from '../types/finance';
import { titleCase } from '../utils/format';

type CategoryFilter = 'all' | TransactionCategory;

export function TransactionsScreen() {
  const { transactions, profile, addTransaction, importTransactions } = useFinance();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [addVisible, setAddVisible] = useState(false);
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(profile.analysisDate ?? new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState<TransactionCategory>('food');
  const [essential, setEssential] = useState<'flexible' | 'essential'>('flexible');
  const filtered = useMemo(() => transactions
    .filter((item) => filter === 'all' || item.category === filter)
    .filter((item) => `${item.merchant} ${item.category}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date)), [filter, search, transactions]);

  const importCsv = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'text/plain'], copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
      const content = await new File(result.assets[0].uri).text();
      const parsed = parseTransactionsCsv(content);
      if (!parsed.transactions.length) {
        Alert.alert('Nothing imported', parsed.errors.join('\n') || 'No valid transactions were found.');
        return;
      }
      importTransactions(parsed.transactions);
      Alert.alert('Import complete', `${parsed.transactions.length} transactions added${parsed.errors.length ? `; ${parsed.errors.length} rows skipped` : ''}.`);
    } catch {
      Alert.alert('Could not import CSV', 'Use columns: date, merchant, amount, direction, category, essential.');
    }
  };

  const save = () => {
    if (!merchant.trim() || Number(amount) <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      Alert.alert('Check the transaction', 'Enter a merchant, positive amount, and date in YYYY-MM-DD format.');
      return;
    }
    addTransaction({
      merchant: merchant.trim(),
      amount: Number(amount),
      date,
      direction: 'debit',
      category,
      essential: essential === 'essential',
    });
    setMerchant('');
    setAmount('');
    setAddVisible(false);
  };

  return (
    <>
      <Screen title="Transactions" subtitle={`${transactions.length} local transactions · Search the evidence behind every warning.`}>
        <View style={styles.actions}>
          <FinButton label="Add" icon="plus" onPress={() => setAddVisible(true)} style={styles.actionButton} />
          <FinButton label="Import CSV" icon="upload" variant="secondary" onPress={() => void importCsv()} style={styles.actionButton} />
        </View>
        <View style={styles.search}>
          <Feather name="search" size={18} color={colors.textMuted} />
          <TextInput value={search} onChangeText={setSearch} placeholder="Search merchant or category" placeholderTextColor={colors.textMuted} style={styles.searchInput} selectionColor={colors.primary} />
          {search ? <Pressable onPress={() => setSearch('')}><Feather name="x-circle" size={17} color={colors.textMuted} /></Pressable> : null}
        </View>
        <ChoiceChips values={['all', ...TRANSACTION_CATEGORIES]} selected={filter} onSelect={setFilter} style={styles.filters} />
        <View style={styles.listCard}>
          {filtered.slice(0, 120).map((item) => <TransactionRow key={item.id} transaction={item} />)}
          {!filtered.length ? <Text style={styles.empty}>No matching transactions.</Text> : null}
        </View>
        <View style={styles.csvHelp}>
          <Feather name="info" size={16} color={colors.primary} />
          <Text style={styles.csvText}>CSV columns: date, merchant, amount, direction, category, essential. Imported data never leaves this device.</Text>
        </View>
      </Screen>
      <Modal visible={addVisible} transparent animationType="slide" onRequestClose={() => setAddVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setAddVisible(false)}>
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.modalHeader}><Text style={styles.modalTitle}>Add transaction</Text><Pressable onPress={() => setAddVisible(false)}><Feather name="x" size={22} color={colors.text} /></Pressable></View>
            <FormField label="Merchant or description" value={merchant} onChangeText={setMerchant} placeholder="e.g. Swiggy" />
            <FormField label="Amount (₹)" value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="500" />
            <FormField label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} />
            <Text style={styles.fieldLabel}>Category</Text>
            <ChoiceChips values={TRANSACTION_CATEGORIES.filter((value) => value !== 'income')} selected={category} onSelect={setCategory} />
            <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>Spending type</Text>
            <ChoiceChips values={['flexible', 'essential']} selected={essential} onSelect={setEssential} />
            <FinButton label="Save transaction" icon="check" onPress={save} style={styles.saveButton} />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: spacing.sm },
  actionButton: { flex: 1 },
  search: { height: 48, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, marginTop: spacing.lg },
  searchInput: { flex: 1, color: colors.text, fontSize: 14, height: '100%' },
  filters: { paddingVertical: spacing.md },
  listCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, paddingHorizontal: spacing.lg },
  empty: { color: colors.textSecondary, padding: spacing.xxl, textAlign: 'center' },
  csvHelp: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', marginTop: spacing.md, paddingHorizontal: spacing.sm },
  csvText: { color: colors.textMuted, fontSize: 10, lineHeight: 15, flex: 1 },
  backdrop: { flex: 1, backgroundColor: '#000000A6', justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 680, maxHeight: '92%', backgroundColor: colors.surface, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, padding: spacing.xl, borderWidth: 1, borderColor: colors.border },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  modalTitle: { color: colors.text, fontSize: 22, fontWeight: '900' },
  fieldLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '800', marginBottom: spacing.sm },
  saveButton: { marginTop: spacing.xl },
});
