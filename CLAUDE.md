# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Important

Expo SDK 56 APIs have changed significantly. Always consult the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any Expo-related code.

## Environment

Create `.env.local` with your Supabase credentials before first run:

```
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

## Commands

```bash
npm run web            # Open in browser (primary dev target)
npm start              # Start Expo dev server (scan QR with Expo Go)
npm run ios            # Open in iOS simulator
npm run android        # Open in Android emulator
npm run lint           # ESLint (TypeScript + React + React Native rules)
npm run format         # Prettier
npx tsc --noEmit       # Type check — run this after every change
```

When installing new native modules use `npx expo install <pkg>` (not plain npm).

## Architecture

### Routing (Expo Router v3)
File-based routing via `app/`. Three route groups:
- `app/login.tsx` — Supabase email/password sign-in + sign-up
- `app/setup.tsx` — create or join an organization (fires once after first sign-in)
- `app/(main)/` — protected tab layout

Auth redirect logic in `app/_layout.tsx → RootNavigator`: reads `role`, `orgId`, `isLoading` from AppContext. Routes to `/login` when no role, `/setup` when no orgId, `/(main)/dashboard` otherwise.

### State & Persistence (`context/AppContext.tsx`)
Single React Context using `useReducer`. Three effects on mount:
1. **Boot** — loads all data from AsyncStorage instantly (keys prefixed `@warehouse/`)
2. **Auth** — `supabase.auth.onAuthStateChange`: updates role/orgId, pulls from Supabase on `SIGNED_IN` only (skips `TOKEN_REFRESHED` and `INITIAL_SESSION` to avoid overwriting local writes)
3. **Realtime** — subscribes to two Supabase channels: broadcast (`org-{id}`) for peer notifications, `postgres_changes` for DB-level events (bonus, requires table replication to be enabled in Supabase)

**AsyncStorage is the local source of truth.** It is written only by local user actions via the `save()` helper. Remote pulls (`applyResult`) update in-memory state only — they never write to AsyncStorage. This prevents remote pulls from wiping changes that haven't finished pushing to Supabase.

Every write callback calls `broadcastChange()` which: (1) sets a 15-second no-pull window via `skipPullUntilRef`, (2) sends a broadcast on the org channel so other connected devices pull immediately. The `sessionIdRef` prevents a device from acting on its own broadcasts.

### Supabase Sync (`lib/sync.ts`)
DB uses snake_case columns; app uses camelCase. `lib/sync.ts` owns all mapping via `dbTo*` / `*ToDb` functions. **Push is always fire-and-forget** (returns `void`, errors are `console.warn` only). Pull happens once on `SIGNED_IN` via `pullFromSupabase(orgId)` which issues six parallel queries. `lib/schema.sql` is the authoritative DB schema.

### Authentication & Organizations
Auth is Supabase email/password. After sign-up, users set up via `app/setup.tsx` — directors create an org, workers join with an org code. The org code is the `organization_id` UUID shown in Settings (director only).

Role and `organization_id` are stored in a `profiles` table in Supabase, fetched on auth state change.

### Role-Based Access
Two roles: `worker` and `director`.

**Director tabs**: Dashboard, Stock, Leather, Batches, Sales, Buyers, Reports, Settings.
**Worker tabs**: Dashboard, Stock, Leather, Batches, Sales. (Settings, Buyers, Reports hidden via `href: null`)

**Workers cannot see** (enforced in each screen via `isDirector` check):
- Prices/revenue anywhere (inventory price, sale total, batch profit, leather value, revenue cards)
- Payment status on sales
- Delete button on sales (directors only; consistent with batches)
- Settings, Buyers, Reports tabs

Workers can: add stock (qty only), add finished leather (qty only, price = 0), create sales (`needsPricing: true`, price = 0), add/edit batches (but not delete them).

### Sales & Pricing Flow
`Sale` optional fields: `saleType` ('leather' | 'chemical'), `paymentStatus` ('paid' | 'partial'), `paidAmount`, `needsPricing`.

Worker-created sales set `needsPricing: true`, `price: 0`. Director resolves via "Set Price" button (banner on Dashboard + banner on Sales screen). `updateSalePrice(id, price, currency)` clears the flag.

`updateSalePayment(id, status, paidAmount?)` updates payment status. Used in Buyers screen to mark partial payments as fully paid ("Mark as Paid" button on each partial sale in purchase history). When status becomes `'paid'`, `paidAmount` is cleared.

Both leather and chemical sales deduct inventory on create, restore on delete.

### Batch Wizard
Multi-step: info → raw material → chemicals → [other costs, director only] → output → summary.

The **hides** field is intentionally removed from the UI (the `hides` property still exists in the `Batch` type and defaults to 0).

Quantity validation in raw material and chemicals steps: `getWetBlueAvail(itemId)` / `getChemAvail(itemId)` compute effective available qty, accounting for previously committed qty when editing a batch. Input turns red with inline error when exceeded; Next button is blocked.

### Buyers
Purchase history is derived at render time by matching `sale.buyer` (case-insensitive) against `buyer.name` — no foreign key. Outstanding balance = `total - paidAmount` for partial-payment sales, converted to USD.

### Data Flow for Batches
`saveBatch()`:
1. If editing: restores deducted inventory, removes linked finished leather + their sales
2. Deducts chemicals + wet blue quantities
3. Auto-creates `Finished Leather` inventory items (one per grade with qty > 0), linked via `batchId`; price = 0 (set later in Leather/Stock screen)
4. Calculates financials via `utils/calc.ts → calcBatchCosts()`

Deleting a batch reverses all of the above. Finished leather items without a `batchId` are manual entries (added via Stock screen).

### Price Review Flow
When a director adds stock for an item that already has a price and the new price differs, a `PriceReview` is pushed to `pendingReviews`. Resolved from the Dashboard banner: keep old, use new, or weighted average. Until resolved, qty updates but price stays unchanged.

### Reports
`totalRevenue` in overview = actual sales (`sales.filter(s => !s.needsPricing).reduce(...)`), not `batch.revenue`. `totalProfit = totalRevenue - totalCost`. Per-batch view uses batch-level financials.

### Currency
All financial calculations convert to USD via `utils/currency.ts → toUSD(amount, currency, rates)`. Exchange rates stored in `AppSettings`, editable in Settings. Never store raw multi-currency totals — always convert at display/calc time.

### i18n
Translations in `i18n/{en,uz,ru}.ts`. Use `t(lang, key)` from `i18n/index.ts`. The `lang` comes from `settings.language`. Keys are typed as `TranslationKey = keyof typeof en`. Always add new strings to all three locale files simultaneously. Language is org-wide (stored in org settings in Supabase).

### Design Tokens
All colors, spacing, border radius, font sizes, and shadows in `constants/theme.ts`. No magic numbers in StyleSheet. Grade colors: Grade 1 = `Colors.grade1` (green), Grade 2 = `Colors.grade2` (blue), Grade 3 = `Colors.grade3` (orange).

`SafeAreaView` must be imported from `react-native-safe-area-context`. Use `edges={['bottom']}` on inner screens (tab header handles top).

### UI Rules
- **Never use `Alert.alert` for confirmations** — use inline state-based confirm/cancel UI (see `logoutConfirm` in dashboard.tsx and settings.tsx, `confirmDelete` in stock.tsx ItemCard, `confirmDeleteId` in batches.tsx and buyers.tsx).
- **Sub-component `lang` props** must be typed as `Language` (from `types/`), not `string`, so `t(lang, key)` doesn't need `as any` casts.
- The `save` translation key renders "Save" (not "Save Batch") — it's reused across all save buttons.
