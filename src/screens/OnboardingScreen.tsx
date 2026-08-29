import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FinButton } from '../components/FinButton';
import { FormField } from '../components/FormField';
import { useFinance } from '../context/FinanceContext';
import { colors, radii, spacing } from '../theme/colors';
import { UserProfile } from '../types/finance';

export function OnboardingScreen() {
  const { useDemoAccount, completeCustomSetup } = useFinance();
  const [custom, setCustom] = useState(false);
  const [name, setName] = useState('');
  const [income, setIncome] = useState('');
  const [balance, setBalance] = useState('');
  const [nextIncomeDate, setNextIncomeDate] = useState('2026-09-01');
  const [essentials, setEssentials] = useState('');
  const canContinue = name.trim() && Number(income) > 0 && Number(balance) >= 0 && /^\d{4}-\d{2}-\d{2}$/.test(nextIncomeDate);
  const submit = () => {
    const profile: UserProfile = {
      id: `profile-${Date.now()}`,
      name: name.trim(),
      monthlyIncome: Number(income),
      availableBalance: Number(balance),
      nextIncomeDate,
      essentialMonthlyExpenses: Number(essentials) || 0,
      analysisDate: new Date().toISOString().slice(0, 10),
    };
    completeCustomSetup(profile);
  };
  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.brandIcon}><Feather name="shield" size={34} color={colors.primary} /></View>
        <Text style={styles.brand}>FinFire</Text>
        <Text style={styles.tagline}>Detect financial damage before it happens.</Text>
        {!custom ? (
          <>
            <View style={styles.heroCard}>
              <Text style={styles.heroEyebrow}>EARLY-WARNING, NOT EXPENSE REPORTING</Text>
              <Text style={styles.heroTitle}>Know what could hurt your finances—before it does.</Text>
              {['Five explainable risk detectors', 'Money runway and payment pressure', 'Purchase impact simulator'].map((item) => (
                <View key={item} style={styles.feature}><Feather name="check-circle" size={17} color={colors.safe} /><Text style={styles.featureText}>{item}</Text></View>
              ))}
            </View>
            <FinButton label="Try demo account" icon="play" onPress={useDemoAccount} />
            <FinButton label="Set up my profile" icon="user" variant="secondary" onPress={() => setCustom(true)} style={styles.secondaryButton} />
            <Text style={styles.privacy}>No bank login required. Demo and imported data stay on your device.</Text>
          </>
        ) : (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Set up your profile</Text>
            <Text style={styles.formHelper}>You can add or import transactions after this step.</Text>
            <FormField label="Your name" value={name} onChangeText={setName} placeholder="e.g. Thameem" />
            <FormField label="Monthly income (₹)" value={income} onChangeText={setIncome} keyboardType="numeric" placeholder="48000" />
            <FormField label="Available balance (₹)" value={balance} onChangeText={setBalance} keyboardType="numeric" placeholder="18500" />
            <FormField label="Next income date (YYYY-MM-DD)" value={nextIncomeDate} onChangeText={setNextIncomeDate} placeholder="2026-09-01" />
            <FormField label="Essential monthly expenses (₹)" value={essentials} onChangeText={setEssentials} keyboardType="numeric" placeholder="14500" />
            <FinButton label="Create local profile" icon="arrow-right" disabled={!canContinue} onPress={submit} />
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
