export type Language = 'en' | 'uz' | 'ru';
export type Role = 'worker' | 'director';
export type Currency = 'USD' | 'EUR' | 'UZS';
export type ItemType = 'Chemical' | 'Wet Blue' | 'Finished Leather';
export type Grade = 'Grade 1' | 'Grade 2' | 'Grade 3';
export type BatchStatus = 'finished' | 'in_progress';
export type SaleType = 'leather' | 'chemical';
export type PaymentStatus = 'paid' | 'partial';

export interface InventoryItem {
  id: string;
  name: string;
  type: ItemType;
  qty: number;
  unit: string;
  price: number;
  currency: Currency;
  grade?: Grade;
  batchId?: string;
  batchName?: string;
}

export interface BatchMaterial {
  id: string;
  name: string;
  qty: number;
  price: number;
  currency: Currency;
}

export interface BatchChemical {
  id: string;
  name: string;
  usedQty: number;
  price: number;
  currency: Currency;
}

export interface OtherCost {
  label: string;
  amount: number;
  currency: Currency;
}

export interface GradeOutput {
  qty: number;
  price: number;
  currency: Currency;
}

export interface Batch {
  id: string;
  name: string;
  date: string;
  hides: number;
  wetBlue: BatchMaterial[];
  chemicals: BatchChemical[];
  otherCosts: OtherCost[];
  output: Record<Grade, GradeOutput>;
  chemCost: number;
  rawCost: number;
  otherCost: number;
  totalCost: number;
  revenue: number;
  profit: number;
  status: BatchStatus;
}

export interface Sale {
  id: string;
  batchId: string | null;
  inventoryId: string;
  grade: string;
  qty: number;
  price: number;
  currency: Currency;
  buyer: string;
  date: string;
  // extended fields (optional for backwards compat)
  saleType?: SaleType;        // defaults to 'leather'
  paymentStatus?: PaymentStatus; // defaults to 'paid'
  paidAmount?: number;        // set when paymentStatus === 'partial'
  needsPricing?: boolean;     // true when worker created sale without price
}

export interface Buyer {
  id: string;
  name: string;
  company: string;
  phone: string;
  email?: string;
  notes?: string;
}

export interface PriceReview {
  itemId: string;
  itemName: string;
  oldPrice: number;
  newPrice: number;
  weightedAvg: number;
  currency: Currency;
  addedQty: number;
  existingQty: number;
}

export interface ExchangeRates {
  USD: number;
  EUR: number;
  UZS: number;
}

export interface AppSettings {
  language: Language;
  lowStockThreshold: number;
  exchangeRates: ExchangeRates;
}

export interface DeletedBatch extends Batch {
  deletedAt: string;
}
