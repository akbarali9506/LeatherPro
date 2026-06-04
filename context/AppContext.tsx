import React, { createContext, useCallback, useContext, useEffect, useReducer, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AppSettings,
  Batch,
  Buyer,
  Currency,
  Grade,
  GradeOutput,
  InventoryItem,
  Language,
  PaymentStatus,
  PriceReview,
  Role,
  Sale,
} from '../types';
import { SEED_INVENTORY, DEFAULT_SETTINGS } from '../constants/seedData';
import { nextBatchId, nextInventoryId, nextSaleId } from '../utils/ids';
import { calcBatchCosts, calcWeightedAvg, GRADES } from '../utils/calc';
import { toUSD } from '../utils/currency';
import { supabase } from '../lib/supabase';
import {
  pullFromSupabase, SyncResult,
  pushInventory, pushInventoryDeleted,
  pushBatches, pushBatchDeleted, pushInventoryBatchDeleted,
  pushSales, pushSaleDeleted, pushSalesBatchDeleted,
  pushFinishedLeatherCleared,
  pushBuyers, pushBuyerDeleted,
  pushSettings, pushPriceReviews,
} from '../lib/sync';

// Merge remote data with local state, preserving local-only records that may not have
// been pushed to Supabase yet (failed push, in-flight, or offline). Remote wins for
// records that exist in both (server is authoritative for updates/edits).
function mergeById<T extends { id: string }>(local: T[], remote: T[]): T[] {
  const remoteIds = new Set(remote.map((r) => r.id));
  return [...remote, ...local.filter((l) => !remoteIds.has(l.id))];
}

// ─── AsyncStorage keys ────────────────────────────────────────────────────────

const KEYS = {
  inventory: '@warehouse/inventory',
  batches: '@warehouse/batches',
  sales: '@warehouse/sales',
  settings: '@warehouse/settings',
  reviews: '@warehouse/reviews',
  seeded: '@warehouse/seeded',
  buyers: '@warehouse/buyers',
  orgId: '@warehouse/orgId',
  role: '@warehouse/role',
};

// ─── State ────────────────────────────────────────────────────────────────────

interface State {
  inventory: InventoryItem[];
  batches: Batch[];
  sales: Sale[];
  settings: AppSettings;
  pendingReviews: PriceReview[];
  buyers: Buyer[];
  role: Role | null;
  orgId: string | null;
  isLoading: boolean;
  isSaving: boolean;
  isSyncing: boolean;
}

type Action =
  | { type: 'LOAD'; payload: Omit<State, 'isLoading' | 'isSaving' | 'isSyncing'> }
  | { type: 'SET_ROLE'; payload: Role | null }
  | { type: 'SET_ORG'; payload: string | null }
  | { type: 'SET_INVENTORY'; payload: InventoryItem[] }
  | { type: 'SET_BATCHES'; payload: Batch[] }
  | { type: 'SET_SALES'; payload: Sale[] }
  | { type: 'SET_SETTINGS'; payload: AppSettings }
  | { type: 'SET_REVIEWS'; payload: PriceReview[] }
  | { type: 'SET_BUYERS'; payload: Buyer[] }
  | { type: 'SET_SAVING'; payload: boolean }
  | { type: 'SET_SYNCING'; payload: boolean }
  | { type: 'MERGE_REMOTE'; payload: SyncResult };

const initial: State = {
  inventory: [],
  batches: [],
  sales: [],
  settings: DEFAULT_SETTINGS,
  pendingReviews: [],
  buyers: [],
  role: null,
  orgId: null,
  isLoading: true,
  isSaving: false,
  isSyncing: false,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'LOAD': return { ...state, ...action.payload, isLoading: false };
    case 'SET_ROLE': return { ...state, role: action.payload };
    case 'SET_ORG': return { ...state, orgId: action.payload };
    case 'SET_INVENTORY': return { ...state, inventory: action.payload };
    case 'SET_BATCHES': return { ...state, batches: action.payload };
    case 'SET_SALES': return { ...state, sales: action.payload };
    case 'SET_SETTINGS': return { ...state, settings: action.payload };
    case 'SET_REVIEWS': return { ...state, pendingReviews: action.payload };
    case 'SET_BUYERS': return { ...state, buyers: action.payload };
    case 'SET_SAVING': return { ...state, isSaving: action.payload };
    case 'SET_SYNCING': return { ...state, isSyncing: action.payload };
    case 'MERGE_REMOTE': {
      const r = action.payload;
      return {
        ...state,
        inventory: mergeById(state.inventory, r.inventory),
        batches: mergeById(state.batches, r.batches),
        sales: mergeById(state.sales, r.sales),
        buyers: mergeById(state.buyers, r.buyers),
        settings: r.settings,
        pendingReviews: r.pendingReviews,
      };
    }
    default: return state;
  }
}

// ─── Context type ─────────────────────────────────────────────────────────────

interface AppContextType extends State {
  logout: () => void;
  refreshProfile: () => Promise<void>;
  addInventoryItem: (item: Omit<InventoryItem, 'id'>) => void;
  addStock: (itemId: string, qty: number, newPrice: number, currency: Currency) => void;
  updateItemPrice: (itemId: string, price: number, currency: Currency) => void;
  updateItemUnit: (itemId: string, unit: string) => void;
  deleteInventoryItem: (itemId: string) => void;
  clearLeatherWarehouse: () => void;
  resolvePriceReview: (itemId: string, choice: 'new' | 'avg' | 'old') => void;
  saveBatch: (data: Omit<Batch, 'id' | 'chemCost' | 'rawCost' | 'otherCost' | 'totalCost' | 'revenue' | 'profit'>, editId?: string) => void;
  deleteBatch: (batchId: string) => void;
  addSale: (data: Omit<Sale, 'id'>) => void;
  deleteSale: (saleId: string) => void;
  updateSalePrice: (saleId: string, price: number, currency: Currency) => void;
  updateSalePayment: (saleId: string, paymentStatus: PaymentStatus, paidAmount?: number) => void;
  addBuyer: (data: Omit<Buyer, 'id'>) => void;
  updateBuyer: (id: string, data: Partial<Omit<Buyer, 'id'>>) => void;
  deleteBuyer: (id: string) => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
  setLanguage: (lang: Language) => void;
  syncNow: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

// ─── ID helpers ───────────────────────────────────────────────────────────────

function nextBuyerId(buyers: Buyer[]): string {
  const nums = buyers
    .map((b) => parseInt(b.id.replace('BY', ''), 10))
    .filter((n) => !isNaN(n));
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return `BY${String(max + 1).padStart(3, '0')}`;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);

  // ── 1. Boot: load from AsyncStorage (instant), then sync from Supabase ──────

  useEffect(() => {
    (async () => {
      try {
        const [inv, bat, sal, set, rev, seeded, buy, cachedOrgId, cachedRole] =
          await Promise.all([
            AsyncStorage.getItem(KEYS.inventory),
            AsyncStorage.getItem(KEYS.batches),
            AsyncStorage.getItem(KEYS.sales),
            AsyncStorage.getItem(KEYS.settings),
            AsyncStorage.getItem(KEYS.reviews),
            AsyncStorage.getItem(KEYS.seeded),
            AsyncStorage.getItem(KEYS.buyers),
            AsyncStorage.getItem(KEYS.orgId),
            AsyncStorage.getItem(KEYS.role),
          ]);

        const inventory = inv ? JSON.parse(inv) : seeded ? [] : SEED_INVENTORY;
        if (!seeded && !inv) await AsyncStorage.setItem(KEYS.inventory, JSON.stringify(SEED_INVENTORY));
        if (!seeded) await AsyncStorage.setItem(KEYS.seeded, '1');

        dispatch({
          type: 'LOAD',
          payload: {
            inventory,
            batches: bat ? JSON.parse(bat) : [],
            sales: sal ? JSON.parse(sal) : [],
            settings: set ? { ...DEFAULT_SETTINGS, ...JSON.parse(set) } : DEFAULT_SETTINGS,
            pendingReviews: rev ? JSON.parse(rev) : [],
            buyers: buy ? JSON.parse(buy) : [],
            orgId: cachedOrgId,
            role: cachedRole as Role | null,
          },
        });
      } catch {
        dispatch({
          type: 'LOAD',
          payload: {
            inventory: SEED_INVENTORY,
            batches: [], sales: [], settings: DEFAULT_SETTINGS,
            pendingReviews: [], buyers: [], orgId: null, role: null,
          },
        });
      }
    })();
  }, []);

  // ── 2. Listen to Supabase auth → update role + orgId + trigger sync ─────────

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!session) {
        dispatch({ type: 'SET_ROLE', payload: null });
        dispatch({ type: 'SET_ORG', payload: null });
        AsyncStorage.multiRemove([KEYS.role, KEYS.orgId]);
        return;
      }

      // TOKEN_REFRESHED is just auth-token renewal — no data has changed, skip pull entirely
      if (event === 'TOKEN_REFRESHED') return;

      // Fetch profile to get role + org
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, organization_id')
        .eq('id', session.user.id)
        .single();

      if (!profile) return;

      const role = profile.role as Role;
      const orgId = profile.organization_id as string | null;

      dispatch({ type: 'SET_ROLE', payload: role });
      dispatch({ type: 'SET_ORG', payload: orgId });
      AsyncStorage.setItem(KEYS.role, role);
      if (orgId) AsyncStorage.setItem(KEYS.orgId, orgId);

      if (orgId) {
        dispatch({ type: 'SET_SYNCING', payload: true });
        const result = await pullFromSupabase(orgId);
        if (result) {
          // Always merge — never do a full replace from auth events.
          // SIGNED_IN can fire on session restore, token-edge cases, or explicit re-login.
          // A full replace would wipe local writes that haven't been pushed yet.
          // MERGE_REMOTE preserves local-only records (pending push) while adding
          // anything new from the server.
          dispatch({ type: 'MERGE_REMOTE', payload: result });
        }
        dispatch({ type: 'SET_SYNCING', payload: false });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── 3. Real-time sync: broadcast + postgres_changes + 30s polling fallback ────

  // Stable refs shared between the effect and write callbacks
  const orgChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  // Unique ID for this app session — used to ignore broadcasts we sent ourselves
  const sessionIdRef = useRef<string>(Math.random().toString(36).slice(2));
  // After a local write, skip incoming pulls for 5 s to avoid overwriting our optimistic state
  // before the push to Supabase has landed
  const skipPullUntilRef = useRef<number>(0);

  useEffect(() => {
    if (!state.orgId) return;
    const orgId = state.orgId;
    let pullTimer: ReturnType<typeof setTimeout> | null = null;
    let active = true;
    const sessionId = sessionIdRef.current;

    // Full replace: remote is authoritative for realtime pulls. Deletions by other users
    // must propagate — merging would resurrect deleted records from AsyncStorage.
    // The 45-second skip window on the writer's own device prevents this from running
    // before a local push completes, so in-progress writes are still safe.
    const applyResult = (result: Awaited<ReturnType<typeof pullFromSupabase>>) => {
      if (!result || !active) return;
      dispatch({ type: 'SET_INVENTORY', payload: result.inventory });
      dispatch({ type: 'SET_BATCHES', payload: result.batches });
      dispatch({ type: 'SET_SALES', payload: result.sales });
      dispatch({ type: 'SET_BUYERS', payload: result.buyers });
      dispatch({ type: 'SET_SETTINGS', payload: result.settings });
      dispatch({ type: 'SET_REVIEWS', payload: result.pendingReviews });
      AsyncStorage.multiSet([
        [KEYS.inventory, JSON.stringify(result.inventory)],
        [KEYS.batches, JSON.stringify(result.batches)],
        [KEYS.sales, JSON.stringify(result.sales)],
        [KEYS.buyers, JSON.stringify(result.buyers)],
        [KEYS.settings, JSON.stringify(result.settings)],
        [KEYS.reviews, JSON.stringify(result.pendingReviews)],
      ]);
    };

    // Called by broadcast listener, postgres_changes listener, and polling interval.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const triggerPull = (msg?: any) => {
      // Ignore our own broadcasts — we already have the data locally
      if ((msg as { payload?: { senderId?: string } })?.payload?.senderId === sessionId) return;
      // Skip if we just wrote; the push may not have reached Supabase yet
      if (Date.now() < skipPullUntilRef.current) return;
      if (pullTimer) clearTimeout(pullTimer);
      pullTimer = setTimeout(async () => {
        applyResult(await pullFromSupabase(orgId));
      }, 600);
    };

    // Primary: broadcast channel — no DB config needed, works out of the box
    const broadcastChannel = supabase
      .channel(`org-${orgId}`)
      .on('broadcast', { event: 'data-changed' }, triggerPull)
      .subscribe();

    orgChannelRef.current = broadcastChannel;

    // Secondary: postgres_changes — bonus if tables are added to the Supabase realtime publication.
    // Split into a separate channel to avoid TS overload issues when mixing broadcast + postgres_changes.
    const dbChannel = supabase
      .channel(`org-db-${orgId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, triggerPull)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'batches' }, triggerPull)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, triggerPull)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'buyers' }, triggerPull)
      .subscribe();

    // 30-second polling: safe now because applyResult uses MERGE_REMOTE, which preserves
    // local-only records (pending push) instead of replacing them with stale server data.
    const pollInterval = setInterval(triggerPull, 30000);

    return () => {
      active = false;
      if (pullTimer) clearTimeout(pullTimer);
      clearInterval(pollInterval);
      orgChannelRef.current = null;
      supabase.removeChannel(broadcastChannel);
      supabase.removeChannel(dbChannel);
    };
  }, [state.orgId]);

  // Called by every write callback: marks a pull-free window, then notifies peers.
  // Window must exceed the 30s poll interval so a poll can't fire before pushes complete.
  const broadcastChange = useCallback(() => {
    skipPullUntilRef.current = Date.now() + 45000;
    orgChannelRef.current?.send({
      type: 'broadcast',
      event: 'data-changed',
      payload: { senderId: sessionIdRef.current },
    });
  }, []);

  // ── 4. Manual sync ───────────────────────────────────────────────────────────

  const syncNow = useCallback(async () => {
    if (!state.orgId) return;
    dispatch({ type: 'SET_SYNCING', payload: true });
    const result = await pullFromSupabase(state.orgId);
    if (result) {
      dispatch({ type: 'SET_INVENTORY', payload: result.inventory });
      dispatch({ type: 'SET_BATCHES', payload: result.batches });
      dispatch({ type: 'SET_SALES', payload: result.sales });
      dispatch({ type: 'SET_BUYERS', payload: result.buyers });
      dispatch({ type: 'SET_SETTINGS', payload: result.settings });
      dispatch({ type: 'SET_REVIEWS', payload: result.pendingReviews });
      AsyncStorage.multiSet([
        [KEYS.inventory, JSON.stringify(result.inventory)],
        [KEYS.batches, JSON.stringify(result.batches)],
        [KEYS.sales, JSON.stringify(result.sales)],
        [KEYS.buyers, JSON.stringify(result.buyers)],
        [KEYS.settings, JSON.stringify(result.settings)],
        [KEYS.reviews, JSON.stringify(result.pendingReviews)],
      ]);
    }
    dispatch({ type: 'SET_SYNCING', payload: false });
  }, [state.orgId]);

  // ── 4. Local save helper ─────────────────────────────────────────────────────

  const save = useCallback(async (key: string, data: unknown) => {
    dispatch({ type: 'SET_SAVING', payload: true });
    await AsyncStorage.setItem(key, JSON.stringify(data));
    dispatch({ type: 'SET_SAVING', payload: false });
  }, []);

  // ── 5. Auth ──────────────────────────────────────────────────────────────────

  const logout = useCallback(() => {
    supabase.auth.signOut();
    dispatch({ type: 'SET_ROLE', payload: null });
    dispatch({ type: 'SET_ORG', payload: null });
    AsyncStorage.multiRemove([KEYS.role, KEYS.orgId]);
  }, []);

  // ── 6. Inventory ─────────────────────────────────────────────────────────────

  const addInventoryItem = useCallback(
    (item: Omit<InventoryItem, 'id'>) => {
      const id = nextInventoryId(state.inventory, item.type);
      const newItem = { ...item, id };
      const updated = [...state.inventory, newItem];
      dispatch({ type: 'SET_INVENTORY', payload: updated });
      save(KEYS.inventory, updated);
      if (state.orgId) { pushInventory([newItem], state.orgId); broadcastChange(); }
    },
    [state.inventory, state.orgId, save, broadcastChange],
  );

  const addStock = useCallback(
    (itemId: string, qty: number, newPrice: number, currency: Currency) => {
      const item = state.inventory.find((i) => i.id === itemId);
      if (!item) return;

      let reviews = [...state.pendingReviews];
      let price = item.price;

      if (item.price > 0 && newPrice !== item.price) {
        const weighted = calcWeightedAvg(item.qty, item.price, qty, newPrice);
        const existing = reviews.findIndex((r) => r.itemId === itemId);
        const review = {
          itemId, itemName: item.name, oldPrice: item.price,
          newPrice, weightedAvg: weighted, currency, addedQty: qty, existingQty: item.qty,
        };
        if (existing >= 0) reviews[existing] = review;
        else reviews.push(review);
        dispatch({ type: 'SET_REVIEWS', payload: reviews });
        save(KEYS.reviews, reviews);
        if (state.orgId) pushPriceReviews(reviews, state.orgId);
      } else if (item.price === 0) {
        price = newPrice;
      }

      const updated = state.inventory.map((i) =>
        i.id === itemId ? { ...i, qty: i.qty + qty, price, currency } : i,
      );
      dispatch({ type: 'SET_INVENTORY', payload: updated });
      save(KEYS.inventory, updated);
      if (state.orgId) {
        const changedItem = updated.find((i) => i.id === itemId);
        if (changedItem) pushInventory([changedItem], state.orgId);
        broadcastChange();
      }
    },
    [state.inventory, state.pendingReviews, state.orgId, save, broadcastChange],
  );

  const updateItemPrice = useCallback(
    (itemId: string, price: number, currency: Currency) => {
      const updated = state.inventory.map((i) => (i.id === itemId ? { ...i, price, currency } : i));
      dispatch({ type: 'SET_INVENTORY', payload: updated });
      save(KEYS.inventory, updated);
      if (state.orgId) {
        const item = updated.find((i) => i.id === itemId);
        if (item) pushInventory([item], state.orgId);
        broadcastChange();
      }
    },
    [state.inventory, state.orgId, save, broadcastChange],
  );

  const updateItemUnit = useCallback(
    (itemId: string, unit: string) => {
      const updated = state.inventory.map((i) => (i.id === itemId ? { ...i, unit } : i));
      dispatch({ type: 'SET_INVENTORY', payload: updated });
      save(KEYS.inventory, updated);
      if (state.orgId) {
        const item = updated.find((i) => i.id === itemId);
        if (item) pushInventory([item], state.orgId);
        broadcastChange();
      }
    },
    [state.inventory, state.orgId, save, broadcastChange],
  );

  const deleteInventoryItem = useCallback(
    (itemId: string) => {
      const updated = state.inventory.filter((i) => i.id !== itemId);
      dispatch({ type: 'SET_INVENTORY', payload: updated });
      save(KEYS.inventory, updated);
      if (state.orgId) { pushInventoryDeleted(itemId, state.orgId); broadcastChange(); }
    },
    [state.inventory, state.orgId, save, broadcastChange],
  );

  const clearLeatherWarehouse = useCallback(() => {
    const updated = state.inventory.filter((i) => i.type !== 'Finished Leather');
    dispatch({ type: 'SET_INVENTORY', payload: updated });
    save(KEYS.inventory, updated);
    if (state.orgId) { pushFinishedLeatherCleared(state.orgId); broadcastChange(); }
  }, [state.inventory, state.orgId, save, broadcastChange]);

  const resolvePriceReview = useCallback(
    (itemId: string, choice: 'new' | 'avg' | 'old') => {
      const review = state.pendingReviews.find((r) => r.itemId === itemId);
      if (!review) return;

      const price =
        choice === 'new' ? review.newPrice
        : choice === 'avg' ? review.weightedAvg
        : review.oldPrice;

      const updatedInv = state.inventory.map((i) => (i.id === itemId ? { ...i, price } : i));
      dispatch({ type: 'SET_INVENTORY', payload: updatedInv });
      save(KEYS.inventory, updatedInv);
      if (state.orgId) {
        const item = updatedInv.find((i) => i.id === itemId);
        if (item) pushInventory([item], state.orgId);
      }

      const reviews = state.pendingReviews.filter((r) => r.itemId !== itemId);
      dispatch({ type: 'SET_REVIEWS', payload: reviews });
      save(KEYS.reviews, reviews);
      if (state.orgId) { pushPriceReviews(reviews, state.orgId); broadcastChange(); }
    },
    [state.inventory, state.pendingReviews, state.orgId, save, broadcastChange],
  );

  // ── 7. Batches ───────────────────────────────────────────────────────────────

  const saveBatch = useCallback(
    (
      data: Omit<Batch, 'id' | 'chemCost' | 'rawCost' | 'otherCost' | 'totalCost' | 'revenue' | 'profit'>,
      editId?: string,
    ) => {
      let inventory = [...state.inventory];
      let batches = [...state.batches];
      let sales = [...state.sales];

      // Collect IDs of inventory items that will change (for targeted push)
      const changedInventoryIds = new Set([
        ...data.chemicals.map((c) => c.id),
        ...data.wetBlue.map((w) => w.id),
      ]);

      if (editId) {
        const old = batches.find((b) => b.id === editId);
        if (old) {
          old.chemicals.forEach((c) => changedInventoryIds.add(c.id));
          old.wetBlue.forEach((w) => changedInventoryIds.add(w.id));
          old.chemicals.forEach((c) => {
            inventory = inventory.map((i) => i.id === c.id ? { ...i, qty: i.qty + c.usedQty } : i);
          });
          old.wetBlue.forEach((w) => {
            inventory = inventory.map((i) => i.id === w.id ? { ...i, qty: i.qty + w.qty } : i);
          });
          const linkedIds = inventory.filter((i) => i.batchId === editId).map((i) => i.id);
          inventory = inventory.filter((i) => i.batchId !== editId);
          sales = sales.filter((s) => !linkedIds.includes(s.inventoryId));
        }
        batches = batches.filter((b) => b.id !== editId);
      }

      data.chemicals.forEach((c) => {
        inventory = inventory.map((i) => i.id === c.id ? { ...i, qty: Math.max(0, i.qty - c.usedQty) } : i);
      });
      data.wetBlue.forEach((w) => {
        inventory = inventory.map((i) => i.id === w.id ? { ...i, qty: Math.max(0, i.qty - w.qty) } : i);
      });

      const batchId = editId ?? nextBatchId(batches);
      const newInventoryItems: InventoryItem[] = [];
      GRADES.forEach((grade) => {
        const out: GradeOutput = data.output[grade as Grade];
        if (out.qty > 0) {
          const id = nextInventoryId(
            [...inventory, ...GRADES.map((_g, gi) => ({ id: `F${gi}` } as InventoryItem))],
            'Finished Leather',
          );
          const item: InventoryItem = {
            id, name: `${data.name} - ${grade}`, type: 'Finished Leather',
            qty: out.qty, unit: 'dm²', price: out.price, currency: out.currency,
            grade: grade as Grade, batchId, batchName: data.name,
          };
          inventory.push(item);
          newInventoryItems.push(item);
        }
      });

      const costs = calcBatchCosts(
        data.chemicals, data.wetBlue, data.otherCosts,
        data.output as Record<Grade, GradeOutput>, state.settings.exchangeRates,
      );
      const batch: Batch = { ...data, id: batchId, output: data.output as Record<Grade, GradeOutput>, ...costs };
      batches = [...batches, batch];

      dispatch({ type: 'SET_INVENTORY', payload: inventory });
      dispatch({ type: 'SET_BATCHES', payload: batches });
      dispatch({ type: 'SET_SALES', payload: sales });
      save(KEYS.inventory, inventory);
      save(KEYS.batches, batches);
      save(KEYS.sales, sales);

      if (state.orgId) {
        const itemsToPush = [
          ...inventory.filter((i) => changedInventoryIds.has(i.id)),
          ...newInventoryItems,
        ];
        if (itemsToPush.length > 0) pushInventory(itemsToPush, state.orgId);
        pushBatches([batch], state.orgId);
        if (editId) pushBatchDeleted(editId, state.orgId);
        broadcastChange();
      }
    },
    [state.inventory, state.batches, state.sales, state.settings.exchangeRates, state.orgId, save, broadcastChange],
  );

  const deleteBatch = useCallback(
    (batchId: string) => {
      const batch = state.batches.find((b) => b.id === batchId);
      if (!batch) return;

      let inventory = [...state.inventory];
      batch.chemicals.forEach((c) => {
        inventory = inventory.map((i) => i.id === c.id ? { ...i, qty: i.qty + c.usedQty } : i);
      });
      batch.wetBlue.forEach((w) => {
        inventory = inventory.map((i) => i.id === w.id ? { ...i, qty: i.qty + w.qty } : i);
      });
      inventory = inventory.filter((i) => i.batchId !== batchId);

      const batches = state.batches.filter((b) => b.id !== batchId);
      const sales = state.sales.filter((s) => s.batchId !== batchId);

      dispatch({ type: 'SET_INVENTORY', payload: inventory });
      dispatch({ type: 'SET_BATCHES', payload: batches });
      dispatch({ type: 'SET_SALES', payload: sales });
      save(KEYS.inventory, inventory);
      save(KEYS.batches, batches);
      save(KEYS.sales, sales);

      if (state.orgId) {
        pushInventory(inventory, state.orgId);
        pushInventoryBatchDeleted(batchId, state.orgId);
        pushBatchDeleted(batchId, state.orgId);
        pushSalesBatchDeleted(batchId, state.orgId);
        broadcastChange();
      }
    },
    [state.inventory, state.batches, state.sales, state.orgId, save, broadcastChange],
  );

  // ── 8. Sales ─────────────────────────────────────────────────────────────────

  const addSale = useCallback(
    (data: Omit<Sale, 'id'>) => {
      const rates = state.settings.exchangeRates;
      const id = nextSaleId(state.sales);
      const sale = { ...data, id };
      const updatedSales = [...state.sales, sale];
      const inventory = state.inventory.map((i) =>
        i.id === data.inventoryId ? { ...i, qty: Math.max(0, i.qty - data.qty) } : i,
      );

      let batches = state.batches;
      if (data.batchId && data.saleType !== 'chemical') {
        batches = state.batches.map((b) => {
          if (b.id !== data.batchId) return b;
          const revenue = updatedSales
            .filter((s) => s.batchId === b.id && !s.needsPricing && s.saleType !== 'chemical')
            .reduce((sum, s) => sum + toUSD(s.qty * s.price, s.currency, rates), 0);
          return { ...b, revenue, profit: revenue - b.totalCost };
        });
      }

      let buyers = state.buyers;
      let newBuyer: Buyer | null = null;
      if (data.buyer.trim() && !state.buyers.some((b) => b.name.toLowerCase() === data.buyer.trim().toLowerCase())) {
        newBuyer = { id: nextBuyerId(state.buyers), name: data.buyer.trim(), company: '', phone: '' };
        buyers = [...state.buyers, newBuyer];
      }

      dispatch({ type: 'SET_SALES', payload: updatedSales });
      dispatch({ type: 'SET_INVENTORY', payload: inventory });
      dispatch({ type: 'SET_BATCHES', payload: batches });
      if (newBuyer) dispatch({ type: 'SET_BUYERS', payload: buyers });
      save(KEYS.sales, updatedSales);
      save(KEYS.inventory, inventory);
      save(KEYS.batches, batches);
      if (newBuyer) save(KEYS.buyers, buyers);
      if (state.orgId) {
        pushSales([sale], state.orgId);
        const changedItem = inventory.find((i) => i.id === data.inventoryId);
        if (changedItem) pushInventory([changedItem], state.orgId);
        if (data.batchId && data.saleType !== 'chemical') {
          const changedBatch = batches.find((b) => b.id === data.batchId);
          if (changedBatch) pushBatches([changedBatch], state.orgId);
        }
        if (newBuyer) pushBuyers([newBuyer], state.orgId);
        broadcastChange();
      }
    },
    [state.sales, state.inventory, state.batches, state.buyers, state.settings.exchangeRates, state.orgId, save, broadcastChange],
  );

  const deleteSale = useCallback(
    (saleId: string) => {
      const rates = state.settings.exchangeRates;
      const sale = state.sales.find((s) => s.id === saleId);
      if (!sale) return;
      const inventory = state.inventory.map((i) =>
        i.id === sale.inventoryId ? { ...i, qty: i.qty + sale.qty } : i,
      );
      const sales = state.sales.filter((s) => s.id !== saleId);

      let batches = state.batches;
      if (sale.batchId && sale.saleType !== 'chemical') {
        batches = state.batches.map((b) => {
          if (b.id !== sale.batchId) return b;
          const revenue = sales
            .filter((s) => s.batchId === b.id && !s.needsPricing && s.saleType !== 'chemical')
            .reduce((sum, s) => sum + toUSD(s.qty * s.price, s.currency, rates), 0);
          return { ...b, revenue, profit: revenue - b.totalCost };
        });
      }

      dispatch({ type: 'SET_SALES', payload: sales });
      dispatch({ type: 'SET_INVENTORY', payload: inventory });
      dispatch({ type: 'SET_BATCHES', payload: batches });
      save(KEYS.sales, sales);
      save(KEYS.inventory, inventory);
      save(KEYS.batches, batches);
      if (state.orgId) {
        pushSaleDeleted(saleId, state.orgId);
        const changedItem = inventory.find((i) => i.id === sale.inventoryId);
        if (changedItem) pushInventory([changedItem], state.orgId);
        if (sale.batchId && sale.saleType !== 'chemical') {
          const changedBatch = batches.find((b) => b.id === sale.batchId);
          if (changedBatch) pushBatches([changedBatch], state.orgId);
        }
        broadcastChange();
      }
    },
    [state.sales, state.inventory, state.batches, state.settings.exchangeRates, state.orgId, save, broadcastChange],
  );

  const updateSalePrice = useCallback(
    (saleId: string, price: number, currency: Currency) => {
      const rates = state.settings.exchangeRates;
      const updatedSales = state.sales.map((s) =>
        s.id === saleId ? { ...s, price, currency, needsPricing: false } : s,
      );
      const sale = updatedSales.find((s) => s.id === saleId);

      let batches = state.batches;
      if (sale?.batchId && sale.saleType !== 'chemical') {
        batches = state.batches.map((b) => {
          if (b.id !== sale.batchId) return b;
          const revenue = updatedSales
            .filter((s) => s.batchId === b.id && !s.needsPricing && s.saleType !== 'chemical')
            .reduce((sum, s) => sum + toUSD(s.qty * s.price, s.currency, rates), 0);
          return { ...b, revenue, profit: revenue - b.totalCost };
        });
      }

      dispatch({ type: 'SET_SALES', payload: updatedSales });
      dispatch({ type: 'SET_BATCHES', payload: batches });
      save(KEYS.sales, updatedSales);
      save(KEYS.batches, batches);
      if (state.orgId) {
        pushSales(updatedSales.filter((s) => s.id === saleId), state.orgId);
        if (sale?.batchId && sale.saleType !== 'chemical') {
          const changedBatch = batches.find((b) => b.id === sale.batchId);
          if (changedBatch) pushBatches([changedBatch], state.orgId);
        }
        broadcastChange();
      }
    },
    [state.sales, state.batches, state.settings.exchangeRates, state.orgId, save, broadcastChange],
  );

  const updateSalePayment = useCallback(
    (saleId: string, paymentStatus: PaymentStatus, paidAmount?: number) => {
      const updated = state.sales.map((s) =>
        s.id === saleId
          ? { ...s, paymentStatus, paidAmount: paymentStatus === 'paid' ? undefined : (paidAmount ?? s.paidAmount) }
          : s,
      );
      dispatch({ type: 'SET_SALES', payload: updated });
      save(KEYS.sales, updated);
      if (state.orgId) { pushSales(updated.filter((s) => s.id === saleId), state.orgId); broadcastChange(); }
    },
    [state.sales, state.orgId, save, broadcastChange],
  );

  // ── 9. Buyers ────────────────────────────────────────────────────────────────

  const addBuyer = useCallback(
    (data: Omit<Buyer, 'id'>) => {
      const id = nextBuyerId(state.buyers);
      const buyer = { ...data, id };
      const updated = [...state.buyers, buyer];
      dispatch({ type: 'SET_BUYERS', payload: updated });
      save(KEYS.buyers, updated);
      if (state.orgId) { pushBuyers([buyer], state.orgId); broadcastChange(); }
    },
    [state.buyers, state.orgId, save, broadcastChange],
  );

  const updateBuyer = useCallback(
    (id: string, data: Partial<Omit<Buyer, 'id'>>) => {
      const updated = state.buyers.map((b) => (b.id === id ? { ...b, ...data } : b));
      dispatch({ type: 'SET_BUYERS', payload: updated });
      save(KEYS.buyers, updated);
      if (state.orgId) {
        const buyer = updated.find((b) => b.id === id);
        if (buyer) pushBuyers([buyer], state.orgId);
        broadcastChange();
      }
    },
    [state.buyers, state.orgId, save, broadcastChange],
  );

  const deleteBuyer = useCallback(
    (id: string) => {
      const updated = state.buyers.filter((b) => b.id !== id);
      dispatch({ type: 'SET_BUYERS', payload: updated });
      save(KEYS.buyers, updated);
      if (state.orgId) { pushBuyerDeleted(id, state.orgId); broadcastChange(); }
    },
    [state.buyers, state.orgId, save, broadcastChange],
  );

  // ── 10. Settings ─────────────────────────────────────────────────────────────

  const updateSettings = useCallback(
    (patch: Partial<AppSettings>) => {
      const updated = { ...state.settings, ...patch };
      dispatch({ type: 'SET_SETTINGS', payload: updated });
      save(KEYS.settings, updated);
      if (state.orgId) { pushSettings(updated, state.orgId); broadcastChange(); }
    },
    [state.settings, state.orgId, save, broadcastChange],
  );

  const setLanguage = useCallback(
    (lang: Language) => updateSettings({ language: lang }),
    [updateSettings],
  );

  // ── 11. Refresh profile + sync (called after org creation/join) ───────────────

  const refreshProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, organization_id')
      .eq('id', user.id)
      .single();
    if (!profile) return;

    const role = profile.role as Role;
    const orgId = profile.organization_id as string | null;

    dispatch({ type: 'SET_ROLE', payload: role });
    dispatch({ type: 'SET_ORG', payload: orgId });
    AsyncStorage.setItem(KEYS.role, role);
    if (orgId) {
      AsyncStorage.setItem(KEYS.orgId, orgId);
      dispatch({ type: 'SET_SYNCING', payload: true });
      const result = await pullFromSupabase(orgId);
      if (result) {
        dispatch({ type: 'MERGE_REMOTE', payload: result });
      }
      dispatch({ type: 'SET_SYNCING', payload: false });
    }
  }, []);

  return (
    <AppContext.Provider value={{
      ...state,
      logout,
      refreshProfile,
      addInventoryItem, addStock, updateItemPrice, updateItemUnit, deleteInventoryItem, clearLeatherWarehouse,
      resolvePriceReview,
      saveBatch, deleteBatch,
      addSale, deleteSale, updateSalePrice, updateSalePayment,
      addBuyer, updateBuyer, deleteBuyer,
      updateSettings, setLanguage,
      syncNow,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
