import React, { createContext, useCallback, useContext, useEffect, useReducer } from 'react';
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
  PriceReview,
  Role,
  Sale,
} from '../types';
import { SEED_INVENTORY, DEFAULT_SETTINGS } from '../constants/seedData';
import { nextBatchId, nextInventoryId, nextSaleId } from '../utils/ids';
import { calcBatchCosts, calcWeightedAvg, GRADES } from '../utils/calc';

const KEYS = {
  inventory: '@warehouse/inventory',
  batches: '@warehouse/batches',
  sales: '@warehouse/sales',
  settings: '@warehouse/settings',
  reviews: '@warehouse/reviews',
  role: '@warehouse/role',
  seeded: '@warehouse/seeded',
  buyers: '@warehouse/buyers',
};

interface State {
  inventory: InventoryItem[];
  batches: Batch[];
  sales: Sale[];
  settings: AppSettings;
  pendingReviews: PriceReview[];
  buyers: Buyer[];
  role: Role | null;
  isLoading: boolean;
  isSaving: boolean;
}

type Action =
  | { type: 'LOAD'; payload: Omit<State, 'isLoading' | 'isSaving'> }
  | { type: 'SET_ROLE'; payload: Role | null }
  | { type: 'SET_INVENTORY'; payload: InventoryItem[] }
  | { type: 'SET_BATCHES'; payload: Batch[] }
  | { type: 'SET_SALES'; payload: Sale[] }
  | { type: 'SET_SETTINGS'; payload: AppSettings }
  | { type: 'SET_REVIEWS'; payload: PriceReview[] }
  | { type: 'SET_BUYERS'; payload: Buyer[] }
  | { type: 'SET_SAVING'; payload: boolean };

const initial: State = {
  inventory: [],
  batches: [],
  sales: [],
  settings: DEFAULT_SETTINGS,
  pendingReviews: [],
  buyers: [],
  role: null,
  isLoading: true,
  isSaving: false,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'LOAD':
      return { ...state, ...action.payload, isLoading: false };
    case 'SET_ROLE':
      return { ...state, role: action.payload };
    case 'SET_INVENTORY':
      return { ...state, inventory: action.payload };
    case 'SET_BATCHES':
      return { ...state, batches: action.payload };
    case 'SET_SALES':
      return { ...state, sales: action.payload };
    case 'SET_SETTINGS':
      return { ...state, settings: action.payload };
    case 'SET_REVIEWS':
      return { ...state, pendingReviews: action.payload };
    case 'SET_BUYERS':
      return { ...state, buyers: action.payload };
    case 'SET_SAVING':
      return { ...state, isSaving: action.payload };
    default:
      return state;
  }
}

interface AppContextType extends State {
  login: (pin: string) => boolean;
  logout: () => void;
  addInventoryItem: (item: Omit<InventoryItem, 'id'>) => void;
  addStock: (itemId: string, qty: number, newPrice: number, currency: Currency) => void;
  updateItemPrice: (itemId: string, price: number) => void;
  updateItemUnit: (itemId: string, unit: string) => void;
  deleteInventoryItem: (itemId: string) => void;
  resolvePriceReview: (itemId: string, choice: 'new' | 'avg' | 'old') => void;
  saveBatch: (data: Omit<Batch, 'id' | 'chemCost' | 'rawCost' | 'otherCost' | 'totalCost' | 'revenue' | 'profit'>, editId?: string) => void;
  deleteBatch: (batchId: string) => void;
  addSale: (data: Omit<Sale, 'id'>) => void;
  deleteSale: (saleId: string) => void;
  updateSalePrice: (saleId: string, price: number, currency: Currency) => void;
  addBuyer: (data: Omit<Buyer, 'id'>) => void;
  updateBuyer: (id: string, data: Partial<Omit<Buyer, 'id'>>) => void;
  deleteBuyer: (id: string) => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
  setLanguage: (lang: Language) => void;
}

const AppContext = createContext<AppContextType | null>(null);

function nextBuyerId(buyers: Buyer[]): string {
  const nums = buyers
    .map((b) => parseInt(b.id.replace('BY', ''), 10))
    .filter((n) => !isNaN(n));
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return `BY${String(max + 1).padStart(3, '0')}`;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);

  useEffect(() => {
    (async () => {
      try {
        const [inv, bat, sal, set, rev, rol, seeded, buy] = await Promise.all([
          AsyncStorage.getItem(KEYS.inventory),
          AsyncStorage.getItem(KEYS.batches),
          AsyncStorage.getItem(KEYS.sales),
          AsyncStorage.getItem(KEYS.settings),
          AsyncStorage.getItem(KEYS.reviews),
          AsyncStorage.getItem(KEYS.role),
          AsyncStorage.getItem(KEYS.seeded),
          AsyncStorage.getItem(KEYS.buyers),
        ]);

        const inventory = inv ? JSON.parse(inv) : seeded ? [] : SEED_INVENTORY;
        if (!seeded) await AsyncStorage.setItem(KEYS.seeded, '1');

        dispatch({
          type: 'LOAD',
          payload: {
            inventory: inv ? JSON.parse(inv) : inventory,
            batches: bat ? JSON.parse(bat) : [],
            sales: sal ? JSON.parse(sal) : [],
            settings: set ? { ...DEFAULT_SETTINGS, ...JSON.parse(set) } : DEFAULT_SETTINGS,
            pendingReviews: rev ? JSON.parse(rev) : [],
            buyers: buy ? JSON.parse(buy) : [],
            role: rol as Role | null,
          },
        });

        if (!inv && !seeded) {
          await AsyncStorage.setItem(KEYS.inventory, JSON.stringify(SEED_INVENTORY));
        }
      } catch {
        dispatch({
          type: 'LOAD',
          payload: {
            inventory: SEED_INVENTORY,
            batches: [],
            sales: [],
            settings: DEFAULT_SETTINGS,
            pendingReviews: [],
            buyers: [],
            role: null,
          },
        });
      }
    })();
  }, []);

  const save = useCallback(async (key: string, data: unknown) => {
    dispatch({ type: 'SET_SAVING', payload: true });
    await AsyncStorage.setItem(key, JSON.stringify(data));
    dispatch({ type: 'SET_SAVING', payload: false });
  }, []);

  const login = useCallback((pin: string): boolean => {
    if (pin === '1111') {
      dispatch({ type: 'SET_ROLE', payload: 'worker' });
      AsyncStorage.setItem(KEYS.role, 'worker');
      return true;
    }
    if (pin === '2222') {
      dispatch({ type: 'SET_ROLE', payload: 'director' });
      AsyncStorage.setItem(KEYS.role, 'director');
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    dispatch({ type: 'SET_ROLE', payload: null });
    AsyncStorage.removeItem(KEYS.role);
  }, []);

  const addInventoryItem = useCallback(
    (item: Omit<InventoryItem, 'id'>) => {
      const id = nextInventoryId(state.inventory, item.type);
      const updated = [...state.inventory, { ...item, id }];
      dispatch({ type: 'SET_INVENTORY', payload: updated });
      save(KEYS.inventory, updated);
    },
    [state.inventory, save],
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
          itemId,
          itemName: item.name,
          oldPrice: item.price,
          newPrice,
          weightedAvg: weighted,
          currency,
          addedQty: qty,
          existingQty: item.qty,
        };
        if (existing >= 0) reviews[existing] = review;
        else reviews.push(review);
        dispatch({ type: 'SET_REVIEWS', payload: reviews });
        save(KEYS.reviews, reviews);
      } else if (item.price === 0) {
        price = newPrice;
      }

      const updated = state.inventory.map((i) =>
        i.id === itemId ? { ...i, qty: i.qty + qty, price, currency } : i,
      );
      dispatch({ type: 'SET_INVENTORY', payload: updated });
      save(KEYS.inventory, updated);
    },
    [state.inventory, state.pendingReviews, save],
  );

  const updateItemPrice = useCallback(
    (itemId: string, price: number) => {
      const updated = state.inventory.map((i) => (i.id === itemId ? { ...i, price } : i));
      dispatch({ type: 'SET_INVENTORY', payload: updated });
      save(KEYS.inventory, updated);
    },
    [state.inventory, save],
  );

  const updateItemUnit = useCallback(
    (itemId: string, unit: string) => {
      const updated = state.inventory.map((i) => (i.id === itemId ? { ...i, unit } : i));
      dispatch({ type: 'SET_INVENTORY', payload: updated });
      save(KEYS.inventory, updated);
    },
    [state.inventory, save],
  );

  const deleteInventoryItem = useCallback(
    (itemId: string) => {
      const updated = state.inventory.filter((i) => i.id !== itemId);
      dispatch({ type: 'SET_INVENTORY', payload: updated });
      save(KEYS.inventory, updated);
    },
    [state.inventory, save],
  );

  const resolvePriceReview = useCallback(
    (itemId: string, choice: 'new' | 'avg' | 'old') => {
      const review = state.pendingReviews.find((r) => r.itemId === itemId);
      if (!review) return;

      const price =
        choice === 'new'
          ? review.newPrice
          : choice === 'avg'
            ? review.weightedAvg
            : review.oldPrice;

      const updated = state.inventory.map((i) => (i.id === itemId ? { ...i, price } : i));
      dispatch({ type: 'SET_INVENTORY', payload: updated });
      save(KEYS.inventory, updated);

      const reviews = state.pendingReviews.filter((r) => r.itemId !== itemId);
      dispatch({ type: 'SET_REVIEWS', payload: reviews });
      save(KEYS.reviews, reviews);
    },
    [state.inventory, state.pendingReviews, save],
  );

  const saveBatch = useCallback(
    (
      data: Omit<Batch, 'id' | 'chemCost' | 'rawCost' | 'otherCost' | 'totalCost' | 'revenue' | 'profit'>,
      editId?: string,
    ) => {
      let inventory = [...state.inventory];
      let batches = [...state.batches];
      let sales = [...state.sales];

      if (editId) {
        const old = batches.find((b) => b.id === editId);
        if (old) {
          old.chemicals.forEach((c) => {
            inventory = inventory.map((i) =>
              i.id === c.id ? { ...i, qty: i.qty + c.usedQty } : i,
            );
          });
          old.wetBlue.forEach((w) => {
            inventory = inventory.map((i) =>
              i.id === w.id ? { ...i, qty: i.qty + w.qty } : i,
            );
          });
          const linkedIds = inventory
            .filter((i) => i.batchId === editId)
            .map((i) => i.id);
          inventory = inventory.filter((i) => i.batchId !== editId);
          sales = sales.filter((s) => !linkedIds.includes(s.inventoryId));
        }
        batches = batches.filter((b) => b.id !== editId);
      }

      data.chemicals.forEach((c) => {
        inventory = inventory.map((i) =>
          i.id === c.id ? { ...i, qty: Math.max(0, i.qty - c.usedQty) } : i,
        );
      });
      data.wetBlue.forEach((w) => {
        inventory = inventory.map((i) =>
          i.id === w.id ? { ...i, qty: Math.max(0, i.qty - w.qty) } : i,
        );
      });

      const batchId = editId ?? nextBatchId(batches);
      GRADES.forEach((grade) => {
        const out: GradeOutput = data.output[grade as Grade];
        if (out.qty > 0) {
          const id = nextInventoryId(
            [...inventory, ...GRADES.map((_g, gi) => ({ id: `F${gi}` } as InventoryItem))],
            'Finished Leather',
          );
          inventory.push({
            id,
            name: `${data.name} - ${grade}`,
            type: 'Finished Leather',
            qty: out.qty,
            unit: 'dm²',
            price: out.price,
            currency: out.currency,
            grade: grade as Grade,
            batchId,
            batchName: data.name,
          });
        }
      });

      const costs = calcBatchCosts(
        data.chemicals,
        data.wetBlue,
        data.otherCosts,
        data.output as Record<Grade, GradeOutput>,
        state.settings.exchangeRates,
      );

      const batch: Batch = {
        ...data,
        id: batchId,
        output: data.output as Record<Grade, GradeOutput>,
        ...costs,
      };

      batches = [...batches, batch];

      dispatch({ type: 'SET_INVENTORY', payload: inventory });
      dispatch({ type: 'SET_BATCHES', payload: batches });
      dispatch({ type: 'SET_SALES', payload: sales });
      save(KEYS.inventory, inventory);
      save(KEYS.batches, batches);
      save(KEYS.sales, sales);
    },
    [state.inventory, state.batches, state.sales, state.settings.exchangeRates, save],
  );

  const deleteBatch = useCallback(
    (batchId: string) => {
      const batch = state.batches.find((b) => b.id === batchId);
      if (!batch) return;

      let inventory = [...state.inventory];

      batch.chemicals.forEach((c) => {
        inventory = inventory.map((i) =>
          i.id === c.id ? { ...i, qty: i.qty + c.usedQty } : i,
        );
      });
      batch.wetBlue.forEach((w) => {
        inventory = inventory.map((i) =>
          i.id === w.id ? { ...i, qty: i.qty + w.qty } : i,
        );
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
    },
    [state.inventory, state.batches, state.sales, save],
  );

  const addSale = useCallback(
    (data: Omit<Sale, 'id'>) => {
      const id = nextSaleId(state.sales);
      const updated = [...state.sales, { ...data, id }];

      // Deduct inventory for both leather and chemical sales
      const inventory = state.inventory.map((i) =>
        i.id === data.inventoryId ? { ...i, qty: Math.max(0, i.qty - data.qty) } : i,
      );

      dispatch({ type: 'SET_SALES', payload: updated });
      dispatch({ type: 'SET_INVENTORY', payload: inventory });
      save(KEYS.sales, updated);
      save(KEYS.inventory, inventory);
    },
    [state.sales, state.inventory, save],
  );

  const deleteSale = useCallback(
    (saleId: string) => {
      const sale = state.sales.find((s) => s.id === saleId);
      if (!sale) return;

      // Restore qty for both leather and chemical sales
      const inventory = state.inventory.map((i) =>
        i.id === sale.inventoryId ? { ...i, qty: i.qty + sale.qty } : i,
      );
      const sales = state.sales.filter((s) => s.id !== saleId);

      dispatch({ type: 'SET_SALES', payload: sales });
      dispatch({ type: 'SET_INVENTORY', payload: inventory });
      save(KEYS.sales, sales);
      save(KEYS.inventory, inventory);
    },
    [state.sales, state.inventory, save],
  );

  const updateSalePrice = useCallback(
    (saleId: string, price: number, currency: Currency) => {
      const updated = state.sales.map((s) =>
        s.id === saleId ? { ...s, price, currency, needsPricing: false } : s,
      );
      dispatch({ type: 'SET_SALES', payload: updated });
      save(KEYS.sales, updated);
    },
    [state.sales, save],
  );

  const addBuyer = useCallback(
    (data: Omit<Buyer, 'id'>) => {
      const id = nextBuyerId(state.buyers);
      const updated = [...state.buyers, { ...data, id }];
      dispatch({ type: 'SET_BUYERS', payload: updated });
      save(KEYS.buyers, updated);
    },
    [state.buyers, save],
  );

  const updateBuyer = useCallback(
    (id: string, data: Partial<Omit<Buyer, 'id'>>) => {
      const updated = state.buyers.map((b) => (b.id === id ? { ...b, ...data } : b));
      dispatch({ type: 'SET_BUYERS', payload: updated });
      save(KEYS.buyers, updated);
    },
    [state.buyers, save],
  );

  const deleteBuyer = useCallback(
    (id: string) => {
      const updated = state.buyers.filter((b) => b.id !== id);
      dispatch({ type: 'SET_BUYERS', payload: updated });
      save(KEYS.buyers, updated);
    },
    [state.buyers, save],
  );

  const updateSettings = useCallback(
    (patch: Partial<AppSettings>) => {
      const updated = { ...state.settings, ...patch };
      dispatch({ type: 'SET_SETTINGS', payload: updated });
      save(KEYS.settings, updated);
    },
    [state.settings, save],
  );

  const setLanguage = useCallback(
    (lang: Language) => updateSettings({ language: lang }),
    [updateSettings],
  );

  return (
    <AppContext.Provider
      value={{
        ...state,
        login,
        logout,
        addInventoryItem,
        addStock,
        updateItemPrice,
        updateItemUnit,
        deleteInventoryItem,
        resolvePriceReview,
        saveBatch,
        deleteBatch,
        addSale,
        deleteSale,
        updateSalePrice,
        addBuyer,
        updateBuyer,
        deleteBuyer,
        updateSettings,
        setLanguage,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
