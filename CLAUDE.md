# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Important

Expo SDK 56 APIs have changed significantly. Always consult the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any Expo-related code.

## Commands

```bash
npm start              # Start Expo dev server (scan QR with Expo Go)
npm run ios            # Open in iOS simulator
npm run android        # Open in Android emulator
npm run web            # Open in browser
npm run lint           # ESLint (TypeScript + React + React Native rules)
npm run format         # Prettier
npx tsc --noEmit       # Type check without emitting files
```

When installing new native modules use `npx expo install <pkg>` (not plain npm) so Expo picks the SDK-compatible version.

## Architecture

### Routing (Expo Router v3)
File-based routing via `app/`. Two route groups:
- `app/login.tsx` — unauthenticated entry point; `app/index.tsx` immediately redirects to login
- `app/(main)/` — protected tab layout

Auth redirect logic lives in `app/_layout.tsx` inside `RootNavigator`: reads `role` + `isLoading` from `AppContext`, calls `router.replace()` on role changes. Tabs are conditionally hidden with `href: null` based on role (see `app/(main)/_layout.tsx`).

### State & Persistence (`context/AppContext.tsx`)
Single React Context using `useReducer`. All AsyncStorage reads happen once on mount; every mutation dispatches to state then writes to storage. The context exposes all domain operations (CRUD for inventory, batches, sales, settings, price reviews).

AsyncStorage keys are all prefixed `@warehouse/`. On first launch, `SEED_INVENTORY` from `constants/seedData.ts` is loaded; a `@warehouse/seeded` flag prevents re-seeding.

### ID Scheme (`utils/ids.ts`)
All IDs are auto-incremented with a type prefix, zero-padded to 3 digits:
- `C###` — Chemical inventory items
- `W###` — Wet Blue inventory items
- `F###` — Finished Leather inventory items
- `B###` — Batches
- `S###` — Sales

### Data Flow for Batches
Saving a batch (`saveBatch`):
1. If editing, restores previously deducted inventory and removes linked finished leather + sales
2. Deducts chemicals + wet blue quantities from inventory
3. Auto-creates `Finished Leather` inventory items (one per grade with qty > 0), linked via `batchId` and `batchName`
4. Calculates financials via `utils/calc.ts → calcBatchCosts()` — all costs/revenue are converted to USD at calc time

Deleting a batch reverses all of the above. Finished leather items without a `batchId` are manual entries (added directly from the Stock screen).

The batches screen uses a multi-step wizard modal with steps: basic info → raw materials → chemicals → other costs → output → summary.

### Price Review Flow
When a director adds stock for an item that already has a price, and the new price differs, a `PriceReview` is pushed to `pendingReviews`. The director must then resolve it from the dashboard banner by choosing: keep old price, use new price, or use weighted average. Until resolved, the inventory quantity is updated but the price is not changed.

### Role-Based Access
Two roles set by PIN login (`1111` = worker, `2222` = director). Role persists in AsyncStorage.

**Director**: full access to all tabs (Dashboard, Stock, Leather, Batches, Sales, Reports, Settings); all prices/costs/financials visible; can delete items/batches/sales; price review banner visible.

**Worker** tabs: Dashboard, Stock, Leather, Batches. Workers cannot see:
- Dashboard: total revenue, total profit, inventory value cards; batch profit in recent batches; leather estimated values
- Stock: total inventory value card; price per unit in item detail; price fields in Add Stock and Add Item modals
- Leather: estimated value summary card; price per dm² column; grade-level value totals

Workers can add stock (quantity only, price unchanged) and add finished leather manually (name + quantity only, price saved as 0).

### Currency
All financial calculations convert to USD via `utils/currency.ts → toUSD(amount, currency, rates)`. Exchange rates are stored in `AppSettings` and editable in Settings screen. Never store raw multi-currency totals — always convert at display/calc time.

### i18n
Translations in `i18n/{en,uz,ru}.ts`. Call `t(lang, key)` from `i18n/index.ts`. The `lang` comes from `settings.language` in `AppContext`. Keys are typed via `TranslationKey = keyof typeof en`. Always add new strings to all three locale files.

### Design Tokens
All colors, spacing, border radius, font sizes, and shadows are in `constants/theme.ts`. Never use magic numbers in StyleSheet — reference these constants. Grade colors: Grade 1 = green, Grade 2 = blue, Grade 3 = orange.
