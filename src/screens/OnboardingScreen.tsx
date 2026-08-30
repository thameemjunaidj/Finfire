import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FinButton } from '../components/FinButton';
import { FormField } from '../components/FormField';
import { useFinance } from '../context/FinanceContext';
import { colors, radii, spacing } from '../theme/colors';
import { APP_NAME, APP_TAGLINE } from '../theme/brand';
import { UserProfile } from '../types/finance';
import { addDays, toIsoDate } from '../utils/dates';
import { isDateOnOrAfter, parseNonNegativeMoney, parsePositiveMoney } from '../utils/validation';

export function OnboardingScreen() {
  const today = toIsoDate(new Date());
  const { useDemoAccount, completeCustomSetup } = useFinance();
  const [custom, setCustom] = useState(false);
  const [name, setName] = useState('');
  const [income, setIncome] = useState('');
  const [balance, setBalance] = useState('');
  const [nextIncomeDate, setNextIncomeDate] = useState(addDays(today, 14));
  const [essentials, setEssentials] = useState('');
  const monthlyIncome = parsePositiveMoney(income);
  const availableBalance = parseNonNegativeMoney(balance);
  const essentialMonthlyExpenses = essentials.trim() ? parseNonNegativeMoney(essentials) : 0;
  const canContinue = Boolean(
    name.trim()
    && monthlyIncome !== null
    && availableBalance !== null
    && essentialMonthlyExpenses !== null
    && isDateOnOrAfter(nextIncomeDate, today),
  );
  const submit = () => {
    if (!canContinue || monthlyIncome === null || availableBalance === null || essentialMonthlyExpenses === null) return;
    const profile: UserProfile = {
      id: `profile-${Date.now()}`,
      name: name.trim(),
      monthlyIncome,
      availableBalance,
      nextIncomeDate,
      essentialMonthlyExpenses,
      analysisDate: today,
    };
    completeCustomSetup(profile);
  };
  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.brandIcon}><Feather name="shield" size={34} color={colors.primary} /></View>
        <Text style={styles.brand}>{APP_NAME}</Text>
        <Text style={styles.tagline}>{APP_TAGLINE}</Text>
        {!custom ? (
          <>
            <View style={styles.heroCard}>
              <Text style={styles.heroEyebrow}>SEE PROBLEMS BEFORE THEY HAPPEN</Text>
              <Text style={styles.heroTitle}>Understand your money without confusing financial terms.</Text>
              {['Clear warnings with reasons', 'See how long your money may last', 'Check a purchase before you buy'].map((item) => (
                <View key={item} style={styles.feature}><Feather name="check-circle" size={17} color={colors.safe} /><Text style={styles.featureText}>{item}</Text></View>
              ))}
            </View>
            <FinButton label="Try the sample account" icon="play" onPress={useDemoAccount} />
            <FinButton label="Use my own details" icon="user" variant="secondary" onPress={() => setCustom(true)} style={styles.secondaryButton} />
            <Text style={styles.privacy}>No bank login needed. Your information stays on this device.</Text>
          </>
        ) : (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Set up your student money cycle</Text>
            <Text style={styles.formHelper}>Use allowance, scholarship or part-time income—whichever arrives next.</Text>
            <FormField label="Your name" value={name} onChangeText={setName} placeholder="e.g. Thameem" />
            <FormField label="Monthly allowance or income (₹)" value={income} onChangeText={setIncome} keyboardType="decimal-pad" placeholder="10000" />
            <FormField label="Money available now (₹)" value={balance} onChangeText={setBalance} keyboardType="decimal-pad" placeholder="3600" />
            <FormField label="Next allowance or income date (YYYY-MM-DD)" value={nextIncomeDate} onChangeText={setNextIncomeDate} placeholder={addDays(today, 14)} />
            <FormField label="Essential monthly costs (₹)" value={essentials} onChangeText={setEssentials} keyboardType="decimal-pad" placeholder="Hostel, transport, bills, subscriptions" />
            <FinButton label="Continue" icon="arrow-right" disabled={!canContinue} onPress={submit} />
            <FinButton label="Back" variant="ghost" onPress={() => setCustom(false)} style={styles.secondaryButton} />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, width: '100%', maxWidth: 560, alignSelf: 'center', justifyContent: 'center', padding: spacing.xl, paddingVertical: spacing.xxxl },
  brandIcon: { width: 68, height: 68, borderRadius: 22, backgroundColor: colors.primarySoft, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${colors.primary}70` },
  brand: { color: colors.text, fontSize: 36, fontWeight: '900', letterSpacing: -1, textAlign: 'center', marginTop: spacing.md },
  tagline: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 5, marginBottom: spacing.xxl },
  heroCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.xl, padding: spacing.xl, marginBottom: spacing.lg },
  heroEyebrow: { color: colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 0.9 },
  heroTitle: { color: colors.text, fontSize: 22, lineHeight: 29, fontWeight: '900', marginTop: spacing.md, marginBottom: spacing.lg },
  feature: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', marginTop: spacing.sm },
  featureText: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
  secondaryButton: { marginTop: spacing.sm },
  privacy: { color: colors.textMuted, fontSize: 10, textAlign: 'center', marginTop: spacing.lg, lineHeight: 15 },
  formCard: { backgroundColor: colors.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.xl },
  formTitle: { color: colors.text, fontSize: 22, fontWeight: '900' },
  formHelper: { color: colors.textMuted, fontSize: 12, marginTop: 5, marginBottom: spacing.lg },
});
