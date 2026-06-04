# LeatherPro

A warehouse management app for leather tanneries built with React Native and Expo.

## Features

### Role-Based Access
- **Director** (PIN: 2222) — full access to all screens, financials, prices, and settings
- **Worker** (PIN: 1111) — operational access without pricing or financial data

### Screens
- **Dashboard** — key stats, recent batches, leather summary, low stock alerts, pending pricing notifications
- **Stock** — manage chemicals, wet blue, and finished leather inventory
- **Leather** — view finished leather by batch or grade with area totals
- **Batches** — multi-step wizard to create and track production batches (raw materials → chemicals → costs → output)
- **Sales** — record leather and chemical sales; workers create sales without price, director sets price later
- **Buyers** — buyer portfolio with company info, purchase history, and outstanding balances
- **Reports** — actual revenue from sales, costs from batches, per-batch breakdown
- **Settings** — exchange rates, low stock threshold, language

### Key Capabilities
- Chemical, Wet Blue, and Finished Leather inventory tracking
- Production batch management with cost calculation (USD)
- Sales with payment status (paid / partially paid)
- Buyer database with outstanding balance tracking
- Price review flow when restocking at a different price
- Multi-language support: English, Uzbek, Russian
- All financials in USD with live exchange rate conversion

## Tech Stack

- [Expo](https://expo.dev) SDK 56 with Expo Router v3
- React Native 0.85
- TypeScript
- AsyncStorage for persistence
- Single Context + useReducer state management

## Getting Started

```bash
npm install
npm start
```

Scan the QR code with [Expo Go](https://expo.dev/go) or press `w` to open in browser.

## PIN Codes

| Role | PIN |
|------|-----|
| Worker | 1111 |
| Director | 2222 |
