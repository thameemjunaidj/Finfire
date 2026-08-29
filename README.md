# Fin Extinguisher

**Put out money problems before they start.**

Fin Extinguisher is an offline-first financial early-warning app built for DevJams. Instead of only showing where money went, it detects what may go wrong next, explains the evidence, forecasts where the month is heading, and recommends concrete actions.

## What works

- Demo onboarding and custom local profile setup
- Editable balance, income, next-income date, and essential-spending profile
- Financial risk score with five transparent components
- Seven-day and month-end spending forecasts by category
- Projected savings, safe daily allowance, and costed savings actions
- Spending-surge detection using projected vs historical monthly spend
- Bill anomaly detection against the previous three charges
- Subscription price-increase detection
- Seven-day automatic-payment pile-up detection
- Disposable-money runway calculation
- Evidence, likely impact, and a concrete recommendation for every alert
- Searchable and filterable transaction history
- Manual income and expense entry with reversible balance updates
- Removable manual/imported rows (demo evidence stays protected)
- Duplicate-safe CSV transaction import on Android, iOS, and web
- Scheduled-payment manager for custom bills, EMIs, and subscriptions
- ₹1,000–₹10,000 what-if purchase simulator
- Before/after risk, runway, and projected-spending comparison
- Optional local critical notification
- Four-month spending trend
- AsyncStorage persistence and one-tap demo reset
- Saved-data validation and a recoverable render error screen
- Browser-compatible feedback and destructive-action confirmations
- Responsive browser preview plus Android/iOS support through Expo Go
- GitHub Actions verification on pull requests and `main`

## Demo story

The included account belongs to Arjun, a 22-year-old first-job professional. It is intentionally frozen at **18 August 2026** so every teammate and judge sees the same evidence. Fin Extinguisher finds five planted risks:

1. Spending is accelerating beyond Arjun's normal monthly level.
2. The electricity bill is ₹2,940 versus a ₹1,825 historical average.
3. Adobe increased from ₹797 to ₹1,596.
4. Three automatic payments totalling ₹6,199 are due within seven days.
5. The protected balance has approximately nine days of runway.

In **What If?**, a hypothetical ₹5,000 purchase reduces runway to approximately five days and raises the risk band. The simulation never mutates the real dataset.

## Technology

- React Native + Expo SDK 54
- TypeScript with strict mode
- AsyncStorage for local persistence
- Expo Document Picker + File System for CSV import
- Expo Notifications for local device warnings
- React Native Web for laptop/browser development

The risk engine is deterministic. AI does not decide whether a warning exists.

## Run locally

Requirements: Node.js 20.19 or newer, npm, and Expo Go for physical-device testing.

```bash
npm install
npm run web
```

The web preview is enough for most development and does not require phone scanning. Phone testing is only needed for final native-layout and notification checks.

For Expo Go:

```bash
npm start
```

Scan the QR code from Expo Go on Android or the Camera app on iPhone. Use `npx expo start --tunnel` only when the phone and laptop cannot communicate over the local network.

## Verify

```bash
npm run typecheck
npm test
npm run verify
npx expo-doctor
```

`npm run verify` type-checks the application, runs deterministic engine/state/CSV tests, and creates production bundles for Android, iOS, and web. The same command runs automatically in `.github/workflows/verify.yml`.

## CSV format

Fin Extinguisher accepts a header row and these columns:

```csv
date,merchant,amount,direction,category,essential
2026-08-18,"Cafe, Vellore",350,debit,food,no
```

Required columns are `date`, `merchant`, and `amount`. Dates use a real `YYYY-MM-DD` calendar date. Optional direction accepts `debit`, `credit`, `dr`, or `cr`; common category names such as `salary`, `groceries`, and `medical` are normalized. Unknown categories become `other`, invalid rows are reported, files are capped at 5,000 rows, and importing the same file again skips stable duplicate IDs. Importing never changes the available balance.

A ready-to-import example is available at [`samples/transactions.csv`](samples/transactions.csv).

## Architecture

```text
src/
├── components/      Reusable UI, modals, cards, and navigation
├── context/         Local state, persistence, and app actions
├── data/            Internally consistent demonstration dataset
├── engine/          Five detectors, risk score, forecast, and simulator
├── screens/         Onboarding, Home, Forecast, Alerts, Transactions, What If
├── services/        CSV, notifications, and storage
├── theme/           Shared brand identity and design tokens
├── types/           Shared financial data contracts
└── utils/           Date and display formatting
```

The processing flow is:

```text
Transactions + profile + recurring payments
              ↓
      Deterministic detectors
              ↓
      Alerts + component scores
              ↓
       Weighted risk summary
              ↓
 Dashboard / evidence / simulator / notification
```

## Risk model

The overall score is clamped to 0–100:

```text
spending surge       × 35%
money runway         × 30%
bill anomaly         × 15%
payment pressure     × 10%
subscription change  × 10%
```

Bands: `0–29 Safe`, `30–59 Caution`, `60–79 High Risk`, and `80–100 Critical`.

## State rules

- A manually added debit lowers the available balance; a credit raises it.
- Removing a manual row reverses its exact balance change, including an overdraft.
- CSV rows are evidence imports and therefore do not change the entered current balance.
- Scheduled payments feed the payment-pressure, subscription-change, and protected-runway calculations.
- Editing the profile or scheduled payments recalculates every detector immediately.
- A simulation uses a temporary copy of the dataset and never changes saved state.

## Reliability safeguards

- Strict TypeScript covers the full application.
- Deterministic tests cover all five planted alerts, safe/zero-balance edge cases, future-date simulation, calendar validation, CSV aliases and duplicates, state restoration, and corrupted-storage recovery.
- Invalid persisted rows are filtered instead of crashing startup.
- Browser alerts and confirmations use real web dialogs; native builds use React Native dialogs.
- The old parallel prototype engine was removed after the active implementation was verified, so there is now one source of truth under `src/engine/`.

## Privacy and responsible claims

- The prototype uses demonstration, manually entered, or user-imported data.
- Data is stored locally and is not sent to a Fin Extinguisher server.
- Fin Extinguisher never asks for net-banking passwords, card PINs, CVVs, or UPI PINs.
- It does not connect to a real bank or initiate payments.
- Warnings are informational and are not regulated financial advice.

## Future scope

With explicit consent, a production version could add Account Aggregator data, encrypted cloud sync, institution-specific CSV mapping, personalised thresholds, and optional AI wording after the deterministic engine has made the decision.
