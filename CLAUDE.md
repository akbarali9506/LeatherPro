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
Single React Context using `useReducer`. All AsyncStorage reads happen once on mount; every mutation dispatches to state then writes to storage. The context exposes all domain operations (CRUD for inventory, batches, sales, buyers, settings, price reviews).

AsyncStorage keys are all prefixed `@warehouse/`. On first launch, `SEED_INVENTORY` from `constants/seedData.ts` is loaded; a `@warehouse/seeded` flag prevents re-seeding.

### ID Scheme (`utils/ids.ts`)
All IDs are auto-incremented with a type prefix, zero-padded to 3 digits:
- `C###` — Chemical inventory items
- `W###` — Wet Blue inventory items
- `F###` — Finished Leather inventory items
- `B###` — Batches
- `S###` — Sales
- `BY###` — Buyers

### Role-Based Access
Two roles set by PIN login (`1111` = worker, `2222` = director). Role persists in AsyncStorage.

**Director tabs**: Dashboard, Stock, Leather, Batches, Sales, Buyers, Reports, Settings.

**Worker tabs**: Dashboard, Stock, Leather, Batches, Sales.

**Workers cannot see:**
- Dashboard: total revenue, total profit, inventory value stat cards; batch profit in recent batches; leather grade estimated values
- Stock: total inventory value card; price per unit in item detail; price fields in Add Stock and Add Item modals
- Leather: estimated value summary card; price per dm² column; grade-level value totals
- Sales: price fields when creating a sale; revenue summary card; payment status

Workers can add stock (quantity only, price unchanged), add finished leather manually (quantity only, price saved as 0), and create sales without a price (`needsPricing: true`).

### Sales & Pricing Flow
`Sale` has optional fields: `saleType` ('leather' | 'chemical'), `paymentStatus` ('paid' | 'partial'), `paidAmount`, `needsPricing`.

When a worker creates a sale, `needsPricing: true` is set and `price: 0`. The director sees:
1. A banner on the Dashboard linking to Sales
2. A banner at the top of the Sales screen listing pending count
3. A "Set Price" button on each unpriced sale card

`updateSalePrice(saleId, price, currency)` in AppContext clears the `needsPricing` flag.

Both leather and chemical sales deduct from inventory on create and restore on delete (`addSale` / `deleteSale` handle both types).

### Buyers
`Buyer` stores: `id`, `name`, `company`, `phone`, `email?`, `notes?`. Purchase history is derived at render time by matching `sale.buyer` (case-insensitive) against `buyer.name` — there is no foreign key. Outstanding balance is computed from partial-payment sales: `total - paidAmount` converted to USD.

### Data Flow for Batches
Saving a batch (`saveBatch`):
1. If editing, restores previously deducted inventory and removes linked finished leather + sales
2. Deducts chemicals + wet blue quantities from inventory
3. Auto-creates `Finished Leather` inventory items (one per grade with qty > 0), linked via `batchId` and `batchName`; price is set to 0 (directors set it later via the Leather/Stock screen)
4. Calculates financials via `utils/calc.ts → calcBatchCosts()` — all costs converted to USD at calc time

Deleting a batch reverses all of the above. Finished leather items without a `batchId` are manual entries.

The batches screen uses a multi-step wizard modal: basic info → raw materials → chemicals → other costs → output (qty only, no price) → summary (costs only). Delete uses inline confirmation state (`confirmDeleteId`), not `Alert.alert`.

### Price Review Flow
When a director adds stock for an item that already has a price and the new price differs, a `PriceReview` is pushed to `pendingReviews`. The director resolves it from the dashboard banner: keep old, use new, or weighted average. Until resolved, qty updates but price does not.

### Reports
`totalRevenue` in the overview is computed from actual sales (`sales.filter(s => !s.needsPricing).reduce(...)`) — not from `batch.revenue`. `totalProfit = totalRevenue - totalCost`. Per-batch cost breakdown still uses batch-level fields.

### Currency
All financial calculations convert to USD via `utils/currency.ts → toUSD(amount, currency, rates)`. Exchange rates are stored in `AppSettings` and editable in Settings. Never store raw multi-currency totals — always convert at display/calc time.

### i18n
Translations in `i18n/{en,uz,ru}.ts`. Call `t(lang, key)` from `i18n/index.ts`. The `lang` comes from `settings.language` in `AppContext`. Keys are typed via `TranslationKey = keyof typeof en`. Always add new strings to all three locale files simultaneously.

### Design Tokens
All colors, spacing, border radius, font sizes, and shadows are in `constants/theme.ts`. Never use magic numbers in StyleSheet. Grade colors: Grade 1 = `Colors.grade1` (green), Grade 2 = `Colors.grade2` (blue), Grade 3 = `Colors.grade3` (orange).

`SafeAreaView` must be imported from `react-native-safe-area-context`, not `react-native`. Use `edges={['bottom']}` on inner screens (the header handles top safe area).

Never use `Alert.alert` for confirmations — use inline state-based confirm/cancel UI instead (see delete flows in batches.tsx and sales.tsx).
