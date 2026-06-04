import { InventoryItem } from '../types';

export const SEED_INVENTORY: InventoryItem[] = [
  {
    id: 'C001',
    name: 'Chrome Sulfate',
    type: 'Chemical',
    qty: 500,
    unit: 'kg',
    price: 1.2,
    currency: 'USD',
  },
  {
    id: 'C002',
    name: 'Formic Acid',
    type: 'Chemical',
    qty: 200,
    unit: 'kg',
    price: 0.9,
    currency: 'USD',
  },
  {
    id: 'C003',
    name: 'Sodium Bicarbonate',
    type: 'Chemical',
    qty: 300,
    unit: 'kg',
    price: 0.5,
    currency: 'USD',
  },
  {
    id: 'W001',
    name: 'Wet Blue Hide',
    type: 'Wet Blue',
    qty: 3000,
    unit: 'piece',
    price: 12.0,
    currency: 'USD',
  },
];

export const DEFAULT_SETTINGS = {
  language: 'en' as const,
  lowStockThreshold: 50,
  exchangeRates: {
    USD: 1,
    EUR: 1.08,
    UZS: 0.000078,
  },
};
