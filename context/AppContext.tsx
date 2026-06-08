import React, { createContext, useCallback, useContext, useEffect, useReducer, useRef } from 'react';
import {
  AppSettings,
  Batch,
  Buyer,
  Currency,
  DeletedBatch,
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
  pushBatches, pushBatchDeleted, pushBatchRestored, pushInventoryBatchDeleted,
  pushSales, pushSaleDeleted, pushSalesBatchDeleted,
  pushFinishedLeatherCleared,
  pushBuyers, pushBuyerDeleted,
  pushSettings, pushPriceReviews,
  inventoryToDb,
} from '../lib/sync';

// ─── State ────────────────────────────────────────────────────────────────────

interface State {
  inventory: InventoryItem[];
  batches: Batch[];
  deletedBatches: DeletedBatch[];
  sales: Sale[];
  settings: AppSettings;
  pendingReviews: PriceReview[];
  buyers: Buyer[];
  role: Role | null;
  orgId: string | null;
  isLoading: boolean;
  isSyncing: boolean;
}

type Action =
  | { type: 'LOAD'; payload: Omit<State, 'isLoading' | 'isSyncing'> }
  | { type: 'SET_ROLE'; payload: Role | null }
  | { type: 'SET_ORG'; payload: string | null }
  | { type: 'SET_INVENTORY'; payload: InventoryItem[] }
  | { type: 'SET_BATCHES'; payload: Batch[] }
  | { type: 'SET_DELETED_BATCHES'; payload: DeletedBatch[] }
  | { type: 'SET_SALES'; payload: Sale[] }
  | { type: 'SET_SETTINGS'; payload: AppSettings }
  | { type: 'SET_REVIEWS'; payload: PriceReview[] }
  | { type: 'SET_BUYERS'; payload: Buyer[] }
  | { type: 'SET_SYNCING'; payload: boolean }
  | { type: 'MERGE_REMOTE'; payload: SyncResult };

const initial: State = {
  inventory: [],
  batches: [],
  deletedBatches: [],
  sales: [],
  settings: DEFAULT_SETTINGS,
  pendingReviews: [],
  buyers: [],
  role: null,
  orgId: null,
  isLoading: true,
  isSyncing: false,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'LOAD': return { ...state, ...action.payload, isLoading: false };
    case 'SET_ROLE': return { ...state, role: action.payload };
    case 'SET_ORG': return { ...state, orgId: action.payload };
    case 'SET_INVENTORY': return { ...state, inventory: action.payload };
    case 'SET_BATCHES': return { ...state, batches: action.payload };
    case 'SET_DELETED_BATCHES': return { ...state, deletedBatches: action.payload };
    case 'SET_SALES': return { ...state, sales: action.payload };
    case 'SET_SETTINGS': return { ...state, settings: action.payload };
    case 'SET_REVIEWS': return { ...state, pendingReviews: action.payload };
    case 'SET_BUYERS': return { ...state, buyers: action.payload };
    case 'SET_SYNCING': return { ...state, isSyncing: action.payload };
    case 'MERGE_REMOTE': {
      const r = action.payload;
      return {
        ...state,
        inventory: r.inventory,
        batches: r.batches,
        deletedBatches: r.deletedBatches,
        sales: r.sales,
        buyers: r.buyers,
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
  updateItemName: (itemId: string, name: string) => void;
  deleteInventoryItem: (itemId: string) => void;
  clearLeatherWarehouse: () => void;
  resolvePriceReview: (itemId: string, choice: 'new' | 'avg' | 'old') => void;
  saveBatch: (data: Omit<Batch, 'id' | 'chemCost' | 'rawCost' | 'otherCost' | 'totalCost' | 'revenue' | 'profit'>, editId?: string) => void;
  deleteBatch: (batchId: string) => void;
  restoreBatch: (batchId: string) => void;
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

const EMPTY_LOAD = {
  inventory: [], batches: [], deletedBatches: [], sales: [],
  settings: DEFAULT_SETTINGS, pendingReviews: [], buyers: [],
};

// Language chosen on login screen before orgId is known
let _pendingLang: Language | null = null;

const OLD_CHEM_NAMES = new Set(['Chrome Sulfate', 'Formic Acid', 'Sodium Bicarbonate']);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);

  // ── 1. Auth → pull from Supabase on every sign-in / session restore ──────────

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!session) {
        dispatch({ type: 'LOAD', payload: { ...EMPTY_LOAD, orgId: null, role: null } });
        return;
      }

      // Token refresh only renews the auth token — no data has changed
      if (event === 'TOKEN_REFRESHED') return;

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

      if (!orgId) {
        dispatch({ type: 'LOAD', payload: { ...EMPTY_LOAD, orgId: null, role } });
        return;
      }

      dispatch({ type: 'SET_SYNCING', payload: true });
      const result = await pullFromSupabase(orgId);

      if (result) {
        // One-time migration: seed new chemicals if DB has old defaults or none
        const hasOldChemicals = result.inventory.some(
          (i) => i.type === 'Chemical' && OLD_CHEM_NAMES.has(i.name),
        );
        const hasNoChemicals = !result.inventory.some((i) => i.type === 'Chemical');

        if (hasOldChemicals || hasNoChemicals) {
          await supabase.from('inventory')
            .delete()
            .eq('type', 'Chemical')
            .eq('organization_id', orgId);
          const newChemicals = SEED_INVENTORY.filter((i) => i.type === 'Chemical');
          await supabase.from('inventory').upsert(newChemicals.map((i) => inventoryToDb(i, orgId)));
          result.inventory = [
            ...newChemicals,
            ...result.inventory.filter((i) => i.type !== 'Chemical'),
          ];
        }

        // Apply language chosen on login screen (before orgId was known)
        if (_pendingLang) {
          result.settings = { ...result.settings, language: _pendingLang };
          pushSettings(result.settings, orgId);
          _pendingLang = null;
        }

        dispatch({ type: 'LOAD', payload: { ...result, orgId, role } });
      } else {
        dispatch({ type: 'LOAD', payload: { ...EMPTY_LOAD, orgId, role } });
      }

      dispatch({ type: 'SET_SYNCING', payload: false });
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── 2. Real-time sync: broadcast + postgres_changes + 30s polling fallback ────

  const orgChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const sessionIdRef = useRef<string>(Math.random().toString(36).slice(2));
  const skipPullUntilRef = useRef<number>(0);

  useEffect(() => {
    if (!state.orgId) return;
    const orgId = state.orgId;
    let pullTimer: ReturnType<typeof setTimeout> | null = null;
    let active = true;
    const sessionId = sessionIdRef.current;

    const applyResult = (result: Awaited<ReturnType<typeof pullFromSupabase>>) => {
      if (!result || !active) return;
      dispatch({ type: 'SET_INVENTORY', payload: result.inventory });
      dispatch({ type: 'SET_BATCHES', payload: result.batches });
      dispatch({ type: 'SET_DELETED_BATCHES', payload: result.deletedBatches });
      dispatch({ type: 'SET_SALES', payload: result.sales });
      dispatch({ type: 'SET_BUYERS', payload: result.buyers });
      dispatch({ type: 'SET_SETTINGS', payload: result.settings });
      dispatch({ type: 'SET_REVIEWS', payload: result.pendingReviews });
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const triggerPull = (msg?: any) => {
      if ((msg as { payload?: { senderId?: string } })?.payload?.senderId === sessionId) return;
      if (Date.now() < skipPullUntilRef.current) return;
      if (pullTimer) clearTimeout(pullTimer);
      pullTimer = setTimeout(async () => {
        applyResult(await pullFromSupabase(orgId));
      }, 600);
    };

    const broadcastChannel = supabase
      .channel(`org-${orgId}`)
      .on('broadcast', { event: 'data-changed' }, triggerPull)
      .subscribe();

    orgChannelRef.current = broadcastChannel;

    const dbChannel = supabase
      .channel(`org-db-${orgId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, triggerPull)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'batches' }, triggerPull)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, triggerPull)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'buyers' }, triggerPull)
      .subscribe();

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

  const broadcastChange = useCallback(() => {
    skipPullUntilRef.current = Date.now() + 10000;
    orgChannelRef.current?.send({
      type: 'broadcast',
      event: 'data-changed',
      payload: { senderId: sessionIdRef.current },
    });
  }, []);

  // ── 3. Manual sync ───────────────────────────────────────────────────────────

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
    }
    dispatch({ type: 'SET_SYNCING', payload: false });
  }, [state.orgId]);

  // ── 4. Auth ──────────────────────────────────────────────────────────────────

  const logout = useCallback(() => {
    supabase.auth.signOut();
    dispatch({ type: 'SET_ROLE', payload: null });
    dispatch({ type: 'SET_ORG', payload: null });
  }, []);

  // ── 5. Inventory ─────────────────────────────────────────────────────────────

  const addInventoryItem = useCallback(
    (item: Omit<InventoryItem, 'id'>) => {
      const id = nextInventoryId(state.inventory, item.type);
      const newItem = { ...item, id };
      const updated = [...state.inventory, newItem];
      dispatch({ type: 'SET_INVENTORY', payload: updated });
      if (state.orgId) { pushInventory([newItem], state.orgId); broadcastChange(); }
    },
    [state.inventory, state.orgId, broadcastChange],
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
        if (state.orgId) pushPriceReviews(reviews, state.orgId);
      } else if (item.price === 0) {
        price = newPrice;
      }

      const updated = state.inventory.map((i) =>
        i.id === itemId ? { ...i, qty: i.qty + qty, price, currency } : i,
      );
      dispatch({ type: 'SET_INVENTORY', payload: updated });
      if (state.orgId) {
        const changedItem = updated.find((i) => i.id === itemId);
        if (changedItem) pushInventory([changedItem], state.orgId);
        broadcastChange();
      }
    },
    [state.inventory, state.pendingReviews, state.orgId, broadcastChange],
  );

  const updateItemPrice = useCallback(
    (itemId: string, price: number, currency: Currency) => {
      const updated = state.inventory.map((i) => (i.id === itemId ? { ...i, price, currency } : i));
      dispatch({ type: 'SET_INVENTORY', payload: updated });
      if (state.orgId) {
        const item = updated.find((i) => i.id === itemId);
        if (item) pushInventory([item], state.orgId);
        broadcastChange();
      }
    },
    [state.inventory, state.orgId, broadcastChange],
  );

  const updateItemUnit = useCallback(
    (itemId: string, unit: string) => {
      const updated = state.inventory.map((i) => (i.id === itemId ? { ...i, unit } : i));
      dispatch({ type: 'SET_INVENTORY', payload: updated });
      if (state.orgId) {
        const item = updated.find((i) => i.id === itemId);
        if (item) pushInventory([item], state.orgId);
        broadcastChange();
      }
    },
    [state.inventory, state.orgId, broadcastChange],
  );

  const updateItemName = useCallback(
    (itemId: string, name: string) => {
      const updated = state.inventory.map((i) => (i.id === itemId ? { ...i, name } : i));
      dispatch({ type: 'SET_INVENTORY', payload: updated });
      if (state.orgId) {
        const item = updated.find((i) => i.id === itemId);
        if (item) pushInventory([item], state.orgId);
        broadcastChange();
      }
    },
    [state.inventory, state.orgId, broadcastChange],
  );

  const deleteInventoryItem = useCallback(
    (itemId: string) => {
      const updated = state.inventory.filter((i) => i.id !== itemId);
      dispatch({ type: 'SET_INVENTORY', payload: updated });
      if (state.orgId) { pushInventoryDeleted(itemId, state.orgId); broadcastChange(); }
    },
    [state.inventory, state.orgId, broadcastChange],
  );

  const clearLeatherWarehouse = useCallback(() => {
    const updated = state.inventory.filter((i) => i.type !== 'Finished Leather');
    dispatch({ type: 'SET_INVENTORY', payload: updated });
    if (state.orgId) { pushFinishedLeatherCleared(state.orgId); broadcastChange(); }
  }, [state.inventory, state.orgId, broadcastChange]);

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
      if (state.orgId) {
        const item = updatedInv.find((i) => i.id === itemId);
        if (item) pushInventory([item], state.orgId);
      }

      const reviews = state.pendingReviews.filter((r) => r.itemId !== itemId);
      dispatch({ type: 'SET_REVIEWS', payload: reviews });
      if (state.orgId) { pushPriceReviews(reviews, state.orgId); broadcastChange(); }
    },
    [state.inventory, state.pendingReviews, state.orgId, broadcastChange],
  );

  // ── 6. Batches ───────────────────────────────────────────────────────────────

  const saveBatch = useCallback(
    (
      data: Omit<Batch, 'id' | 'chemCost' | 'rawCost' | 'otherCost' | 'totalCost' | 'revenue' | 'profit'>,
      editId?: string,
    ) => {
      let inventory = [...state.inventory];
      let batches = [...state.batches];
      let sales = [...state.sales];

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

      const batchId = editId ?? nextBatchId(batches, state.deletedBatches);
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

      if (state.orgId) {
        const rawMaterialItems = inventory.filter(
          (i) => changedInventoryIds.has(i.id) && i.type !== 'Finished Leather',
        );
        if (rawMaterialItems.length > 0) pushInventory(rawMaterialItems, state.orgId);
        const orgId = state.orgId;
        (async () => {
          if (editId) await pushInventoryBatchDeleted(editId, orgId);
          if (newInventoryItems.length > 0) pushInventory(newInventoryItems, orgId);
          await pushBatches([batch], orgId);
          broadcastChange();
        })();
      }
    },
    [state.inventory, state.batches, state.sales, state.settings.exchangeRates, state.orgId, broadcastChange],
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
      const deletedAt = new Date().toISOString();
      const deletedBatches = [...state.deletedBatches, { ...batch, deletedAt }];

      dispatch({ type: 'SET_INVENTORY', payload: inventory });
      dispatch({ type: 'SET_BATCHES', payload: batches });
      dispatch({ type: 'SET_DELETED_BATCHES', payload: deletedBatches });
      dispatch({ type: 'SET_SALES', payload: sales });

      if (state.orgId) {
        pushInventory(inventory, state.orgId);
        pushInventoryBatchDeleted(batchId, state.orgId);
        pushBatchDeleted(batchId, state.orgId);
        pushSalesBatchDeleted(batchId, state.orgId);
        broadcastChange();
      }
    },
    [state.inventory, state.batches, state.deletedBatches, state.sales, state.orgId, broadcastChange],
  );

  // ── 7. Sales ─────────────────────────────────────────────────────────────────

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
    [state.sales, state.inventory, state.batches, state.buyers, state.settings.exchangeRates, state.orgId, broadcastChange],
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
    [state.sales, state.inventory, state.batches, state.settings.exchangeRates, state.orgId, broadcastChange],
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

      if (state.orgId) {
        pushSales(updatedSales.filter((s) => s.id === saleId), state.orgId);
        if (sale?.batchId && sale.saleType !== 'chemical') {
          const changedBatch = batches.find((b) => b.id === sale.batchId);
          if (changedBatch) pushBatches([changedBatch], state.orgId);
        }
        broadcastChange();
      }
    },
    [state.sales, state.batches, state.settings.exchangeRates, state.orgId, broadcastChange],
  );

  const updateSalePayment = useCallback(
    (saleId: string, paymentStatus: PaymentStatus, paidAmount?: number) => {
      const updated = state.sales.map((s) =>
        s.id === saleId
          ? { ...s, paymentStatus, paidAmount: paymentStatus === 'paid' ? undefined : (paidAmount ?? s.paidAmount) }
          : s,
      );
      dispatch({ type: 'SET_SALES', payload: updated });
      if (state.orgId) { pushSales(updated.filter((s) => s.id === saleId), state.orgId); broadcastChange(); }
    },
    [state.sales, state.orgId, broadcastChange],
  );

  // ── 8. Buyers ────────────────────────────────────────────────────────────────

  const addBuyer = useCallback(
    (data: Omit<Buyer, 'id'>) => {
      const id = nextBuyerId(state.buyers);
      const buyer = { ...data, id };
      const updated = [...state.buyers, buyer];
      dispatch({ type: 'SET_BUYERS', payload: updated });
      if (state.orgId) { pushBuyers([buyer], state.orgId); broadcastChange(); }
    },
    [state.buyers, state.orgId, broadcastChange],
  );

  const updateBuyer = useCallback(
    (id: string, data: Partial<Omit<Buyer, 'id'>>) => {
      const updated = state.buyers.map((b) => (b.id === id ? { ...b, ...data } : b));
      dispatch({ type: 'SET_BUYERS', payload: updated });
      if (state.orgId) {
        const buyer = updated.find((b) => b.id === id);
        if (buyer) pushBuyers([buyer], state.orgId);
        broadcastChange();
      }
    },
    [state.buyers, state.orgId, broadcastChange],
  );

  const deleteBuyer = useCallback(
    (id: string) => {
      const updated = state.buyers.filter((b) => b.id !== id);
      dispatch({ type: 'SET_BUYERS', payload: updated });
      if (state.orgId) { pushBuyerDeleted(id, state.orgId); broadcastChange(); }
    },
    [state.buyers, state.orgId, broadcastChange],
  );

  // ── 9. Settings ─────────────────────────────────────────────────────────────

  const restoreBatch = useCallback(
    (batchId: string) => {
      const batch = state.deletedBatches.find((b) => b.id === batchId);
      if (!batch) return;
      const { deletedAt: _d, ...batchData } = batch;
      const updatedDeleted = state.deletedBatches.filter((b) => b.id !== batchId);
      const updatedBatches = [...state.batches, batchData];
      dispatch({ type: 'SET_DELETED_BATCHES', payload: updatedDeleted });
      dispatch({ type: 'SET_BATCHES', payload: updatedBatches });
      if (state.orgId) { pushBatchRestored(batchId, state.orgId); broadcastChange(); }
    },
    [state.deletedBatches, state.batches, state.orgId, broadcastChange],
  );

  const updateSettings = useCallback(
    (patch: Partial<AppSettings>) => {
      const updated = { ...state.settings, ...patch };
      dispatch({ type: 'SET_SETTINGS', payload: updated });
      if (state.orgId) { pushSettings(updated, state.orgId); broadcastChange(); }
    },
    [state.settings, state.orgId, broadcastChange],
  );

  const setLanguage = useCallback(
    (lang: Language) => {
      if (!state.orgId) {
        _pendingLang = lang;
        dispatch({ type: 'SET_SETTINGS', payload: { ...state.settings, language: lang } });
      } else {
        updateSettings({ language: lang });
      }
    },
    [state.orgId, state.settings, updateSettings],
  );

  // ── 10. Refresh profile + sync (called after org creation/join) ───────────────

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

    if (orgId) {
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
      addInventoryItem, addStock, updateItemPrice, updateItemUnit, updateItemName, deleteInventoryItem, clearLeatherWarehouse,
      resolvePriceReview,
      saveBatch, deleteBatch, restoreBatch,
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
