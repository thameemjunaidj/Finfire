import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AppTab, BottomTabs } from './src/components/BottomTabs';
import { SettingsModal } from './src/components/SettingsModal';
import { FinanceProvider, useFinance } from './src/context/FinanceContext';
import { AlertsScreen } from './src/screens/AlertsScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { SimulatorScreen } from './src/screens/SimulatorScreen';
import { TransactionsScreen } from './src/screens/TransactionsScreen';
import { initializeNotifications } from './src/services/notifications';
import { colors } from './src/theme/colors';

function FinFireApp() {
  const { loaded, onboardingComplete, summary } = useFinance();
  const [tab, setTab] = useState<AppTab>('home');
  const [settingsVisible, setSettingsVisible] = useState(false);
  useEffect(() => {
    void initializeNotifications();
  }, []);
  if (!loaded) {
    return <View style={styles.loading}><ActivityIndicator color={colors.primary} size="large" /></View>;
  }
  if (!onboardingComplete) return <OnboardingScreen />;
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'right', 'bottom', 'left']}>
      <View style={styles.app}>
        {tab === 'home' ? <HomeScreen onViewAlerts={() => setTab('alerts')} onOpenSettings={() => setSettingsVisible(true)} /> : null}
        {tab === 'alerts' ? <AlertsScreen /> : null}
        {tab === 'transactions' ? <TransactionsScreen /> : null}
        {tab === 'simulator' ? <SimulatorScreen /> : null}
        <BottomTabs active={tab} onChange={setTab} alertCount={summary.alerts.length} />
        <SettingsModal visible={settingsVisible} onClose={() => setSettingsVisible(false)} />
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor={colors.background} />
      <FinanceProvider><FinFireApp /></FinanceProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  app: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
});
