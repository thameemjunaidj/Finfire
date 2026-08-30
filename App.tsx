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
import { VerifyEmailScreen } from './src/screens/VerifyEmailScreen';
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
  const { loaded, onboardingComplete, signedInAs, emailVerified, signIn, summary } = useFinance();
  const [tab, setTab] = useState<AppTab>('home');
  const [settingsVisible, setSettingsVisible] = useState(false);
  useEffect(() => {
    void initializeNotifications();
  }, []);
  if (!loaded) {
    return <View style={styles.loading}><ActivityIndicator color={colors.primary} size="large" /></View>;
  }
  /**
   * Four doors, in order, and each one has to be passed to reach the next:
   *
   *   1. Sign in or create an account
   *   2. Confirm the email address     <- new, and it waits
   *   3. Set the account up
   *   4. The app
   *
   * Confirmation sits at step 2 rather than being something you can get to
   * later from Settings, because the address is what the account IS: it is
   * where a password reset goes, and it is the name the spending is filed
   * under. An unconfirmed address is a guess.
   */
  if (!signedInAs) {
    return (
      <SignInScreen
        onSignedIn={(account, restored, emailFailed) =>
          signIn(account.email, account.token, account.verified, restored, emailFailed)}
      />
    );
  }
  if (!emailVerified) return <VerifyEmailScreen />;
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
