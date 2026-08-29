import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, LogBox, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AppTab, BottomTabs } from './src/components/BottomTabs';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { SettingsModal } from './src/components/SettingsModal';
import { FinanceProvider, useFinance } from './src/context/FinanceContext';
import { AlertsScreen } from './src/screens/AlertsScreen';
import { AssistantScreen } from './src/screens/AssistantScreen';
import { ForecastScreen } from './src/screens/ForecastScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { SignInScreen } from './src/screens/SignInScreen';
import { SimulatorScreen } from './src/screens/SimulatorScreen';
import { TransactionsScreen } from './src/screens/TransactionsScreen';
import { initializeNotifications } from './src/services/notifications';
import { colors } from './src/theme/colors';

/**
 * expo-notifications logs an error on Android inside Expo Go because PUSH
 * (remote) notifications were removed from Expo Go in SDK 53. The LOCAL
 * notifications this app actually uses still work, so the message is noise —
 * but LogBox would show it as a red overlay on the phone, which is not
 * something we want appearing mid-demo. Hiding the overlay only; the message
 * still prints in the terminal, and a development build removes it entirely.
 */
LogBox.ignoreLogs([
  'expo-notifications: Android Push notifications',
  '`expo-notifications` functionality is not fully supported in Expo Go',
]);

function FinFireApp() {
  const { loaded, onboardingComplete, signedInAs, signIn, summary } = useFinance();
  const [tab, setTab] = useState<AppTab>('home');
  const [settingsVisible, setSettingsVisible] = useState(false);
  useEffect(() => {
    void initializeNotifications();
  }, []);
  if (!loaded) {
    return <View style={styles.loading}><ActivityIndicator color={colors.primary} size="large" /></View>;
  }
  // Sign in, then set up the account, then the app itself.
  if (!signedInAs) return <SignInScreen onSignedIn={signIn} />;
  if (!onboardingComplete) return <OnboardingScreen />;
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'right', 'bottom', 'left']}>
      <View style={styles.app}>
        {tab === 'home' ? <HomeScreen onViewAlerts={() => setTab('alerts')} onOpenSettings={() => setSettingsVisible(true)} /> : null}
        {tab === 'forecast' ? <ForecastScreen /> : null}
        {tab === 'alerts' ? <AlertsScreen /> : null}
        {tab === 'transactions' ? <TransactionsScreen /> : null}
        {tab === 'simulator' ? <SimulatorScreen /> : null}
        {tab === 'assistant' ? <AssistantScreen /> : null}
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
      <ErrorBoundary><FinanceProvider><FinFireApp /></FinanceProvider></ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  app: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
});
