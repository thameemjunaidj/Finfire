# FinFire

**Detect financial damage before it happens.**

FinFire is an offline-first financial early-warning app built for DevJams. Instead of only showing where money went, it detects what may go wrong next, explains the evidence, and recommends one concrete action.

## What works

- Demo onboarding and custom local profile setup
- Financial risk score with five transparent components
- Spending-surge detection using projected vs historical monthly spend
- Bill anomaly detection against the previous three charges
- Subscription price-increase detection
- Seven-day automatic-payment pile-up detection
- Disposable-money runway calculation
- Evidence, likely impact, and a concrete recommendation for every alert
- Searchable and filterable transaction history
- Manual transaction entry
- CSV transaction import on Android, iOS, and web
- ₹1,000–₹10,000 what-if purchase simulator
- Before/after risk, runway, and projected-spending comparison
- Optional local critical notification
- Four-month spending trend
- AsyncStorage persistence and one-tap demo reset
- Responsive browser preview plus Android/iOS support through Expo Go

## Demo story

The included account belongs to Arjun, a 22-year-old first-job professional. FinFire finds five planted risks:

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
```

`npm run verify` type-checks the application, runs deterministic engine and CSV tests, and creates a production web export.

## CSV format

FinFire accepts a header row and these columns:

```csv
date,merchant,amount,direction,category,essential
2026-08-18,"Cafe, Vellore",350,debit,food,no
```

Required columns are `date`, `merchant`, and `amount`. Dates use `YYYY-MM-DD`. Optional direction is `debit` or `credit`; unknown categories become `other`.

A ready-to-import example is available at [`samples/transactions.csv`](samples/transactions.csv).

## Architecture

```text
src/
├── components/      Reusable UI, modals, cards, and navigation
├── context/         Local state, persistence, and app actions
├── data/            Internally consistent demonstration dataset
├── engine/          Five detectors, risk score, and simulator
├── screens/         Onboarding, Home, Alerts, Transactions, What If
├── services/        CSV, notifications, and storage
├── theme/           FinFire design tokens
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

## Privacy and responsible claims

- The prototype uses demonstration, manually entered, or user-imported data.
- Data is stored locally and is not sent to a FinFire server.
- FinFire never asks for net-banking passwords, card PINs, CVVs, or UPI PINs.
- It does not connect to a real bank or initiate payments.
- Warnings are informational and are not regulated financial advice.

## Future scope

With explicit consent, a production version could add Account Aggregator data, encrypted cloud sync, institution-specific CSV mapping, personalised thresholds, and optional AI wording after the deterministic engine has made the decision.
