import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ChoiceChips } from '../components/ChoiceChips';
import { FinButton } from '../components/FinButton';
import { ImportReviewModal, PendingImport } from '../components/ImportReviewModal';
import { DatePickerField } from '../components/DatePickerField';
import { FormField } from '../components/FormField';
import { RecurringPaymentsModal } from '../components/RecurringPaymentsModal';
import { Screen } from '../components/Screen';
import { TransactionRow } from '../components/TransactionRow';
import { useFinance } from '../context/FinanceContext';
import { categoriseBatch, trainCategoryModel } from '../engine/categoriser';
import { parseMessageBatch, toTransaction } from '../engine/smsParser';
import { readStatement } from '../services/statementParser';
import { colors, radii, spacing } from '../theme/colors';
import { Transaction, TransactionCategory, TransactionDirection, TRANSACTION_CATEGORIES } from '../types/finance';
import { confirmAction, showMessage } from '../utils/alerts';
import { toIsoDate } from '../utils/dates';
import { isValidIsoDate, parsePositiveMoney } from '../utils/validation';

type CategoryFilter = 'all' | TransactionCategory;

export function TransactionsScreen() {
  const { transactions, profile, addTransaction, deleteTransaction, importTransactions, setTransactionCategory } = useFinance();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [addVisible, setAddVisible] = useState(false);
  const [scheduledVisible, setScheduledVisible] = useState(false);
  const [messageVisible, setMessageVisible] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  /** The payment whose category is being corrected. */
  const [editing, setEditing] = useState<Transaction | null>(null);
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

  const prepareImport = (items: Transaction[]): Transaction[] => {
    const guesses = categoriseBatch(trainCategoryModel(transactions), items.map((item) => item.merchant));
    return items.map((item, index) => {
      const nextCategory = item.direction === 'credit' ? 'income' : guesses[index].category;
      return {
        ...item,
        category: nextCategory,
        essential: item.direction === 'debit' && ['rent', 'utilities', 'health'].includes(nextCategory),
      };
    });
  };

  const importStatement = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'text/plain'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      if (result.assets[0].size && result.assets[0].size > 2_000_000) {
        showMessage('File is too large', 'Choose a CSV file smaller than 2 MB.');
        return;
      }
      const content = result.assets[0].file
        ? await result.assets[0].file.text()
        : await new File(result.assets[0].uri).text();
      const parsed = readStatement(content);
      if (!parsed.transactions.length) {
        showMessage('Nothing to review', parsed.problems.join('\n') || 'We could not find any spending entries in this file.');
        return;
      }
      setPendingImport({
        title: 'Review your bank statement',
        transactions: prepareImport(parsed.transactions),
        mapping: parsed.mapping,
        problems: parsed.problems,
        rowsRead: parsed.rowsRead,
      });
    } catch {
      showMessage('Could not read this file', 'Export a CSV or text statement from your bank and try again. The file stays on this device.');
    }
  };

  const reviewMessages = () => {
    const parsed = parseMessageBatch(messageText, profile.analysisDate ?? toIsoDate(new Date()));
    if (!parsed.length) {
      showMessage('No payments found', 'Paste one bank payment message per line. OTP and balance messages are ignored.');
      return;
    }
    const model = trainCategoryModel(transactions);
    const guesses = categoriseBatch(model, parsed.map((item) => item.merchant));
    const items = parsed.map((item, index) => toTransaction(
      item,
      item.direction === 'credit' ? 'income' : guesses[index].category,
      index,
    ));
    setMessageVisible(false);
    setPendingImport({
      title: 'Review pasted bank messages',
      transactions: items,
      problems: [],
    });
  };

  const changePendingCategory = (id: string, nextCategory: TransactionCategory) => {
    setPendingImport((current) => current ? {
      ...current,
      transactions: current.transactions.map((item) => item.id === id ? {
        ...item,
        category: nextCategory,
        essential: item.direction === 'debit' && ['rent', 'utilities', 'health'].includes(nextCategory),
      } : item),
    } : null);
  };

  const confirmImport = () => {
    if (!pendingImport) return;
    const imported = importTransactions(pendingImport.transactions);
    setPendingImport(null);
    setMessageText('');
    const details = [
      `${imported.added} entr${imported.added === 1 ? 'y' : 'ies'} added`,
      imported.skippedDuplicates ? `${imported.skippedDuplicates} duplicate${imported.skippedDuplicates === 1 ? '' : 's'} skipped` : '',
    ].filter(Boolean).join(' · ');
    showMessage(imported.added ? 'Spending added' : 'Already added', details);
  };

  const save = () => {
    const numericAmount = parsePositiveMoney(amount);
    const analysisDate = profile.analysisDate ?? toIsoDate(new Date());
    if (!merchant.trim() || numericAmount === null || !isValidIsoDate(date) || date > analysisDate) {
      showMessage(
        'Check the details',
        `Enter a name, an amount above zero, and a valid date no later than ${analysisDate}.`,
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
    title: 'Remove this entry?',
    message: transaction.source === 'manual'
      ? `${transaction.merchant} will be removed and your balance will be changed back.`
      : `${transaction.merchant} will be removed from your imported spending.`,
    confirmLabel: 'Remove',
    destructive: true,
    onConfirm: () => deleteTransaction(transaction.id),
  });

  return (
    <>
      <Screen title="Spending" subtitle={`${transactions.length} entries saved on this device`}>
        <View style={styles.actions}>
          <FinButton label="Add money" icon="plus" onPress={openAdd} style={styles.actionButton} />
          <FinButton label="Import statement" icon="upload" variant="secondary" onPress={() => void importStatement()} style={styles.actionButton} />
          <FinButton label="Paste bank message" icon="message-square" variant="secondary" onPress={() => setMessageVisible(true)} style={styles.actionButton} />
          <FinButton label="Upcoming bills" icon="calendar" variant="secondary" onPress={() => setScheduledVisible(true)} style={styles.actionButton} />
        </View>
        <View style={styles.search}>
          <Feather name="search" size={18} color={colors.textMuted} />
          <TextInput
            accessibilityLabel="Search spending"
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name or type"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            selectionColor={colors.primary}
          />
          {search ? (
            <Pressable accessibilityLabel="Clear spending search" onPress={() => setSearch('')}>
              <Feather name="x-circle" size={17} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
        <ChoiceChips<CategoryFilter> values={['all', ...TRANSACTION_CATEGORIES]} selected={filter} onSelect={setFilter} style={styles.filters} />
        <View style={styles.listCard}>
          {filtered.slice(0, 120).map((item) => (
            <TransactionRow
              key={item.id}
              transaction={item}
              // Tapping used to delete. A tap is the easiest gesture to make by
              // accident, and deletion is the one thing you cannot undo — so a
              // tap now opens the entry, and removing it is a deliberate choice
              // inside.
              onPress={() => setEditing(item)}
            />
          ))}
          {!filtered.length ? <Text style={styles.empty}>No matching spending entries.</Text> : null}
          {filtered.length > 120 ? <Text style={styles.limit}>Showing the newest 120 of {filtered.length} matching entries.</Text> : null}
        </View>
        <View style={styles.csvHelp}>
          <Feather name="info" size={16} color={colors.primary} />
          <Text style={styles.csvText}>Import a bank CSV or paste payment messages. FinFire shows every entry before saving, guesses the category from your history, and skips repeats. Your files and messages stay on this device.</Text>
        </View>
      </Screen>

      <Modal visible={addVisible} transparent animationType="slide" onRequestClose={() => setAddVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setAddVisible(false)}>
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add money in or out</Text>
              <Pressable accessibilityLabel="Close add money form" onPress={() => setAddVisible(false)}>
                <Feather name="x" size={22} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetContent}>
              <Text style={styles.fieldLabel}>Is this money in or money out?</Text>
              <ChoiceChips values={['debit', 'credit']} selected={direction} onSelect={changeDirection} />
              <View style={styles.firstField}>
                <FormField label="Name" value={merchant} onChangeText={setMerchant} placeholder={direction === 'credit' ? 'e.g. Freelance payment' : 'e.g. Swiggy'} />
              </View>
              <FormField label="Amount (₹)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="500" />
              <DatePickerField label="When was this?" value={date} onChange={setDate} latest={profile.analysisDate ?? toIsoDate(new Date())} />
              <Text style={styles.fieldLabel}>What is it for?</Text>
              <ChoiceChips<TransactionCategory>
                values={direction === 'credit' ? ['income', 'other'] : TRANSACTION_CATEGORIES.filter((value) => value !== 'income')}
                selected={category}
                onSelect={setCategory}
              />
              {direction === 'debit' ? (
                <>
                  <Text style={[styles.fieldLabel, styles.spacedLabel]}>Is this essential?</Text>
                  <ChoiceChips<'flexible' | 'essential'> values={['flexible', 'essential']} selected={essential} onSelect={setEssential} />
                </>
              ) : null}
              <View style={styles.balanceNote}>
                <Feather name="info" size={15} color={colors.primary} />
                <Text style={styles.balanceNoteText}>Saving changes your balance. If you remove this later, the balance changes back.</Text>
              </View>
              <FinButton label="Save" icon="check" onPress={save} style={styles.saveButton} />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={messageVisible} transparent animationType="slide" onRequestClose={() => setMessageVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMessageVisible(false)}>
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Paste bank messages</Text>
              <Pressable accessibilityLabel="Close bank message form" onPress={() => setMessageVisible(false)}>
                <Feather name="x" size={22} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetContent}>
              <Text style={styles.messageHelp}>Copy payment messages from your SMS app and paste them below, one per line. FinFire cannot read your messages automatically.</Text>
              <TextInput
                accessibilityLabel="Bank payment messages"
                value={messageText}
                onChangeText={setMessageText}
                multiline
                textAlignVertical="top"
                placeholder="Example: Rs 240 debited from A/c XX1234 to Swiggy on 21-08-2026"
                placeholderTextColor={colors.textMuted}
                selectionColor={colors.primary}
                style={styles.messageInput}
              />
              <View style={styles.balanceNote}>
                <Feather name="shield" size={15} color={colors.primary} />
                <Text style={styles.balanceNoteText}>The text is read on your phone. OTP and balance-only messages are ignored.</Text>
              </View>
              <FinButton label="Review found payments" icon="search" onPress={reviewMessages} disabled={!messageText.trim()} style={styles.saveButton} />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ---- Correcting a payment ---- */}
      <Modal visible={editing !== null} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <Pressable style={styles.backdrop} onPress={() => setEditing(null)}>
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editing?.merchant}</Text>
              <Pressable accessibilityLabel="Close" onPress={() => setEditing(null)}>
                <Feather name="x" size={22} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetContent}>
              <Text style={styles.correctionNote}>
                {editing ? `${editing.direction === 'debit' ? 'Paid' : 'Received'} ₹${Math.round(editing.amount)} on ${editing.date}.` : ''}
              </Text>

              <Text style={styles.fieldLabel}>What was this for?</Text>
              <ChoiceChips
                values={editing?.direction === 'credit'
                  ? ['income', 'other']
                  : TRANSACTION_CATEGORIES.filter((value) => value !== 'income')}
                selected={editing?.category ?? 'other'}
                onSelect={(value) => {
                  if (!editing) return;
                  setTransactionCategory(editing.id, value as TransactionCategory);
                  setEditing({ ...editing, category: value as TransactionCategory });
                }}
              />

              {/* This is the point of the screen: every correction teaches the
                  categoriser, so the next statement needs fewer of them. */}
              <View style={styles.balanceNote}>
                <Feather name="check-circle" size={15} color={colors.primary} />
                <Text style={styles.balanceNoteText}>
                  Saved as you tap. The app remembers this and will categorise {editing?.merchant} the same way next time.
                </Text>
              </View>

              {editing && (editing.source === 'manual' || editing.source === 'csv') ? (
                <FinButton
                  label="Remove this entry"
                  icon="trash-2"
                  variant="danger"
                  onPress={() => { const target = editing; setEditing(null); remove(target); }}
                  style={styles.saveButton}
                />
              ) : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <RecurringPaymentsModal visible={scheduledVisible} onClose={() => setScheduledVisible(false)} />
      <ImportReviewModal
        pending={pendingImport}
        history={transactions}
        onChangeCategory={changePendingCategory}
        onCancel={() => setPendingImport(null)}
        onConfirm={confirmImport}
      />
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
  messageHelp: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginBottom: spacing.md },
  messageInput: { minHeight: 180, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.backgroundRaised, color: colors.text, padding: spacing.md, fontSize: 13, lineHeight: 19 },
  backdrop: { flex: 1, backgroundColor: '#000000A6', justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 680, maxHeight: '92%', backgroundColor: colors.surface, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, borderWidth: 1, borderColor: colors.border },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.xl, paddingBottom: spacing.md },
  modalTitle: { color: colors.text, fontSize: 22, fontWeight: '900' },
  sheetContent: { padding: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.xxxl },
  fieldLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '800', marginBottom: spacing.sm },
  spacedLabel: { marginTop: spacing.lg },
  firstField: { marginTop: spacing.lg },
  balanceNote: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.primarySoft, borderColor: `${colors.primary}55`, borderWidth: 1, borderRadius: radii.md, padding: spacing.md, marginTop: spacing.lg },
  correctionNote: { color: colors.textSecondary, fontSize: 13, marginBottom: 4 },
  balanceNoteText: { color: colors.textSecondary, fontSize: 10.5, lineHeight: 16, flex: 1 },
  saveButton: { marginTop: spacing.xl },
});
