/**
 * App.tsx — the one screen, for now.
 *
 * Deliberately plain. Every number and every sentence on this screen is
 * already coming from the real logic, so when your mockups land we replace
 * the styling here and nothing underneath has to change.
 */

import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { analyze } from './src/logic/analyze';
import { formatRupees, formatShortDate, formatWhen } from './src/logic/format';
import { daysBetween } from './src/data/mockData';
import { Alert, Severity } from './src/types';

/** Colours per urgency. Placeholder palette — swap when the design arrives. */
const SEVERITY_COLOR: Record<Severity, string> = {
  critical: '#B3261E',
  warning: '#A15C00',
  info: '#1F6FEB',
};

function AlertCard({ alert }: { alert: Alert }) {
  const color = SEVERITY_COLOR[alert.severity];

  return (
    <View style={[styles.card, { borderLeftColor: color }]}>
      <Text style={[styles.severity, { color }]}>{alert.severity.toUpperCase()}</Text>
      <Text style={styles.cardTitle}>{alert.title}</Text>

      <Text style={styles.label}>What happened</Text>
      <Text style={styles.body}>{alert.what}</Text>

      <Text style={styles.label}>Why it matters</Text>
      <Text style={styles.body}>{alert.why}</Text>

      <Text style={styles.label}>What to do</Text>
      <Text style={styles.body}>{alert.action}</Text>
    </View>
  );
}

export default function App() {
  // useMemo so the whole analysis runs once, not on every re-render.
  const { runway, alerts, upcoming, today, transactions } = useMemo(() => analyze(), []);

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.appName}>CashCue</Text>
        <Text style={styles.subtitle}>
          {transactions.length} transactions analysed
        </Text>

        {/* ---- The headline number ---- */}
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>Your money lasts</Text>
          <Text style={styles.heroValue}>
            {runway.runwayDays >= 999 ? '—' : `${runway.runwayDays.toFixed(1)} days`}
          </Text>
          {runway.daysUntilPayday !== null && (
            <Text style={styles.heroNote}>
              Payday is {formatWhen(runway.daysUntilPayday)}
              {runway.shortfall ? ' — you come up short' : ' — you make it'}
            </Text>
          )}

          <View style={styles.row}>
            <Stat label="Balance" value={formatRupees(runway.balance)} />
            <Stat label="Committed" value={formatRupees(runway.committed)} />
            <Stat label="Free to spend" value={formatRupees(runway.disposable)} />
          </View>

          <Text style={styles.safeLimit}>
            Safe to spend {formatRupees(runway.safeDailyLimit)} a day
          </Text>
          <Text style={styles.heroNote}>
            You are averaging {formatRupees(runway.averageDailySpend)} a day
          </Text>
        </View>

        {/* ---- Alerts ---- */}
        <Text style={styles.sectionTitle}>
          {alerts.length} {alerts.length === 1 ? 'alert' : 'alerts'}
        </Text>
        {alerts.map((alert) => (
          <AlertCard key={alert.id} alert={alert} />
        ))}

        {/* ---- What is coming ---- */}
        <Text style={styles.sectionTitle}>Coming up</Text>
        {upcoming.map((payment) => (
          <View key={payment.merchant} style={styles.upcomingRow}>
            <View style={styles.upcomingLeft}>
              <Text style={styles.upcomingName}>{payment.merchant}</Text>
              <Text style={styles.upcomingWhen}>
                {formatShortDate(payment.nextDate)} ·{' '}
                {formatWhen(daysBetween(today, payment.nextDate))}
              </Text>
            </View>
            <Text style={styles.upcomingAmount}>{formatRupees(payment.lastAmount)}</Text>
          </View>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F5F4' },
  content: { padding: 20, paddingTop: 64 },

  appName: { fontSize: 28, fontWeight: '700', color: '#1C1917' },
  subtitle: { fontSize: 13, color: '#78716C', marginTop: 2, marginBottom: 20 },

  hero: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 28,
  },
  heroLabel: { fontSize: 13, color: '#78716C' },
  heroValue: { fontSize: 40, fontWeight: '700', color: '#1C1917', marginTop: 2 },
  heroNote: { fontSize: 13, color: '#78716C', marginTop: 4 },
  safeLimit: { fontSize: 16, fontWeight: '600', color: '#1C1917', marginTop: 16 },

  row: { flexDirection: 'row', marginTop: 18, gap: 12 },
  stat: { flex: 1 },
  statLabel: { fontSize: 11, color: '#78716C' },
  statValue: { fontSize: 15, fontWeight: '600', color: '#1C1917', marginTop: 2 },

  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#78716C',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderLeftWidth: 4,
    padding: 16,
    marginBottom: 12,
  },
  severity: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#1C1917', marginTop: 4, marginBottom: 10 },
  label: { fontSize: 11, fontWeight: '700', color: '#A8A29E', marginTop: 10 },
  body: { fontSize: 14, lineHeight: 20, color: '#44403C', marginTop: 3 },

  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  upcomingLeft: { flex: 1 },
  upcomingName: { fontSize: 15, fontWeight: '600', color: '#1C1917' },
  upcomingWhen: { fontSize: 12, color: '#78716C', marginTop: 2 },
  upcomingAmount: { fontSize: 15, fontWeight: '700', color: '#1C1917' },
});
