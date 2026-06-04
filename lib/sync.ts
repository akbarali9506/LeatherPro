import { supabase } from './supabase';
import {
  AppSettings,
  Batch,
  Buyer,
  Currency,
  Grade,
  GradeOutput,
  InventoryItem,
  PriceReview,
  Sale,
} from '../types';
import { DEFAULT_SETTINGS } from '../constants/seedData';

// ─── Row types returned by Supabase ───────────────────────────────────────────

interface DbInventory {
  id: string; organization_id: string; name: string; type: string;
  qty: number; unit: string; price: number; currency: string;
  grade: string | null; batch_id: string | null; batch_name: string | null;
}

interface DbBatch {
  id: string; organization_id: string; name: string; date: string;
  hides: number; wet_blue: unknown; chemicals: unknown; other_costs: unknown;
  output: unknown; chem_cost: number; raw_cost: number; other_cost: number;
  total_cost: number; revenue: number; profit: number; status: string;
}

interface DbSale {
  id: string; organization_id: string; batch_id: string | null;
  inventory_id: string; grade: string | null; qty: number; price: number;
  currency: string; buyer: string; date: string; sale_type: string | null;
  payment_status: string | null; paid_amount: number | null; needs_pricing: boolean | null;
}

interface DbBuyer {
  id: string; organization_id: string; name: string; company: string;
  phone: string; email: string | null; notes: string | null;
}

interface DbSettings {
  organization_id: string; language: string; low_stock_threshold: number;
  exchange_rates: { USD: number; EUR: number; UZS: number };
}

interface DbPriceReview {
  id: string; organization_id: string; item_id: string; item_name: string;
  old_price: number; new_price: number; weighted_avg: number; currency: string;
  added_qty: number; existing_qty: number;
}

// ─── DB → App mappers ─────────────────────────────────────────────────────────

export function dbToInventory(r: DbInventory): InventoryItem {
  return {
    id: r.id,
    name: r.name,
    type: r.type as InventoryItem['type'],
    qty: r.qty,
    unit: r.unit,
    price: r.price,
    currency: r.currency as Currency,
    grade: (r.grade ?? undefined) as Grade | undefined,
    batchId: r.batch_id ?? undefined,
    batchName: r.batch_name ?? undefined,
  };
}

export function dbToBatch(r: DbBatch): Batch {
  return {
    id: r.id,
    name: r.name,
    date: r.date,
    hides: r.hides,
    wetBlue: (r.wet_blue as Batch['wetBlue']) ?? [],
    chemicals: (r.chemicals as Batch['chemicals']) ?? [],
    otherCosts: (r.other_costs as Batch['otherCosts']) ?? [],
    output: (r.output as Record<Grade, GradeOutput>) ?? {},
    chemCost: r.chem_cost,
    rawCost: r.raw_cost,
    otherCost: r.other_cost,
    totalCost: r.total_cost,
    revenue: r.revenue,
    profit: r.profit,
    status: r.status as Batch['status'],
  };
}

export function dbToSale(r: DbSale): Sale {
  return {
    id: r.id,
    batchId: r.batch_id,
    inventoryId: r.inventory_id,
    grade: r.grade ?? '',
    qty: r.qty,
    price: r.price,
    currency: r.currency as Currency,
    buyer: r.buyer,
    date: r.date,
    saleType: (r.sale_type ?? 'leather') as Sale['saleType'],
    paymentStatus: (r.payment_status ?? 'paid') as Sale['paymentStatus'],
    paidAmount: r.paid_amount ?? undefined,
    needsPricing: r.needs_pricing ?? false,
  };
}

export function dbToBuyer(r: DbBuyer): Buyer {
  return {
    id: r.id,
    name: r.name,
    company: r.company,
    phone: r.phone,
    email: r.email ?? undefined,
    notes: r.notes ?? undefined,
  };
}

export function dbToSettings(r: DbSettings): AppSettings {
  return {
    language: r.language as AppSettings['language'],
    lowStockThreshold: r.low_stock_threshold,
    exchangeRates: r.exchange_rates,
  };
}

export function dbToPriceReview(r: DbPriceReview): PriceReview {
  return {
    itemId: r.item_id,
    itemName: r.item_name,
    oldPrice: r.old_price,
    newPrice: r.new_price,
    weightedAvg: r.weighted_avg,
    currency: r.currency as Currency,
    addedQty: r.added_qty,
    existingQty: r.existing_qty,
  };
}

// ─── App → DB mappers ─────────────────────────────────────────────────────────

export function inventoryToDb(item: InventoryItem, orgId: string) {
  return {
    id: item.id,
    organization_id: orgId,
    name: item.name,
    type: item.type,
    qty: item.qty,
    unit: item.unit,
    price: item.price,
    currency: item.currency,
    grade: item.grade ?? null,
    batch_id: item.batchId ?? null,
    batch_name: item.batchName ?? null,
    updated_at: new Date().toISOString(),
  };
}

export function batchToDb(batch: Batch, orgId: string) {
  return {
    id: batch.id,
    organization_id: orgId,
    name: batch.name,
    date: batch.date,
    hides: batch.hides,
    wet_blue: batch.wetBlue,
    chemicals: batch.chemicals,
    other_costs: batch.otherCosts,
    output: batch.output,
    chem_cost: batch.chemCost,
    raw_cost: batch.rawCost,
    other_cost: batch.otherCost,
    total_cost: batch.totalCost,
    revenue: batch.revenue,
    profit: batch.profit,
    status: batch.status,
    updated_at: new Date().toISOString(),
  };
}

export function saleToDb(sale: Sale, orgId: string) {
  return {
    id: sale.id,
    organization_id: orgId,
    batch_id: sale.batchId ?? null,
    inventory_id: sale.inventoryId,
    grade: sale.grade ?? null,
    qty: sale.qty,
    price: sale.price,
    currency: sale.currency,
    buyer: sale.buyer,
    date: sale.date,
    sale_type: sale.saleType ?? 'leather',
    payment_status: sale.paymentStatus ?? 'paid',
    paid_amount: sale.paidAmount ?? null,
    needs_pricing: sale.needsPricing ?? false,
    updated_at: new Date().toISOString(),
  };
}

export function buyerToDb(buyer: Buyer, orgId: string) {
  return {
    id: buyer.id,
    organization_id: orgId,
    name: buyer.name,
    company: buyer.company,
    phone: buyer.phone,
    email: buyer.email ?? null,
    notes: buyer.notes ?? null,
    updated_at: new Date().toISOString(),
  };
}

// ─── Pull all org data from Supabase ─────────────────────────────────────────

export interface SyncResult {
  inventory: InventoryItem[];
  batches: Batch[];
  sales: Sale[];
  buyers: Buyer[];
  settings: AppSettings;
  pendingReviews: PriceReview[];
}

export async function pullFromSupabase(orgId: string): Promise<SyncResult | null> {
  const [inv, bat, sal, buy, set, rev] = await Promise.all([
    supabase.from('inventory').select('*').eq('organization_id', orgId),
    supabase.from('batches').select('*').eq('organization_id', orgId),
    supabase.from('sales').select('*').eq('organization_id', orgId),
    supabase.from('buyers').select('*').eq('organization_id', orgId),
    supabase.from('org_settings').select('*').eq('organization_id', orgId).maybeSingle(),
    supabase.from('price_reviews').select('*').eq('organization_id', orgId),
  ]);

  if (inv.error || bat.error || sal.error || buy.error || rev.error) {
    console.warn('Supabase pull error', inv.error ?? bat.error ?? sal.error ?? buy.error ?? rev.error);
    return null;
  }

  return {
    inventory: (inv.data as DbInventory[]).map(dbToInventory),
    batches: (bat.data as DbBatch[]).map(dbToBatch),
    sales: (sal.data as DbSale[]).map(dbToSale),
    buyers: (buy.data as DbBuyer[]).map(dbToBuyer),
    settings: set.data ? dbToSettings(set.data as DbSettings) : DEFAULT_SETTINGS,
    pendingReviews: (rev.data as DbPriceReview[]).map(dbToPriceReview),
  };
}

// ─── Push helpers (fire-and-forget wrappers) ──────────────────────────────────

export function pushInventory(items: InventoryItem[], orgId: string) {
  supabase.from('inventory')
    .upsert(items.map((i) => inventoryToDb(i, orgId)))
    .then(({ error }) => { if (error) console.warn('inventory push:', error.message); });
}

export function pushInventoryDeleted(itemId: string, orgId: string) {
  supabase.from('inventory')
    .delete()
    .eq('id', itemId)
    .eq('organization_id', orgId)
    .then(({ error }) => { if (error) console.warn('inventory delete push:', error.message); });
}

export function pushBatches(batches: Batch[], orgId: string) {
  supabase.from('batches')
    .upsert(batches.map((b) => batchToDb(b, orgId)))
    .then(({ error }) => { if (error) console.warn('batches push:', error.message); });
}

export function pushBatchDeleted(batchId: string, orgId: string) {
  supabase.from('batches')
    .delete()
    .eq('id', batchId)
    .eq('organization_id', orgId)
    .then(({ error }) => { if (error) console.warn('batch delete push:', error.message); });
}

export function pushInventoryBatchDeleted(batchId: string, orgId: string) {
  supabase.from('inventory')
    .delete()
    .eq('batch_id', batchId)
    .eq('organization_id', orgId)
    .then(({ error }) => { if (error) console.warn('inventory batch delete push:', error.message); });
}

export function pushSalesBatchDeleted(batchId: string, orgId: string) {
  supabase.from('sales')
    .delete()
    .eq('batch_id', batchId)
    .eq('organization_id', orgId)
    .then(({ error }) => { if (error) console.warn('sales batch delete push:', error.message); });
}

export function pushFinishedLeatherCleared(orgId: string) {
  supabase.from('inventory')
    .delete()
    .eq('type', 'Finished Leather')
    .eq('organization_id', orgId)
    .then(({ error }) => { if (error) console.warn('leather clear push:', error.message); });
}

export function pushSales(sales: Sale[], orgId: string) {
  supabase.from('sales')
    .upsert(sales.map((s) => saleToDb(s, orgId)))
    .then(({ error }) => { if (error) console.warn('sales push:', error.message); });
}

export function pushSaleDeleted(saleId: string, orgId: string) {
  supabase.from('sales')
    .delete()
    .eq('id', saleId)
    .eq('organization_id', orgId)
    .then(({ error }) => { if (error) console.warn('sale delete push:', error.message); });
}

export function pushBuyers(buyers: Buyer[], orgId: string) {
  supabase.from('buyers')
    .upsert(buyers.map((b) => buyerToDb(b, orgId)))
    .then(({ error }) => { if (error) console.warn('buyers push:', error.message); });
}

export function pushBuyerDeleted(buyerId: string, orgId: string) {
  supabase.from('buyers')
    .delete()
    .eq('id', buyerId)
    .eq('organization_id', orgId)
    .then(({ error }) => { if (error) console.warn('buyer delete push:', error.message); });
}

export function pushSettings(settings: AppSettings, orgId: string) {
  supabase.from('org_settings')
    .upsert({
      organization_id: orgId,
      language: settings.language,
      low_stock_threshold: settings.lowStockThreshold,
      exchange_rates: settings.exchangeRates,
      updated_at: new Date().toISOString(),
    })
    .then(({ error }) => { if (error) console.warn('settings push:', error.message); });
}

export function pushPriceReviews(reviews: PriceReview[], orgId: string) {
  // Delete all then re-insert (reviews are small in number)
  supabase.from('price_reviews')
    .delete()
    .eq('organization_id', orgId)
    .then(({ error }) => {
      if (error) { console.warn('reviews delete push:', error.message); return; }
      if (reviews.length === 0) return;
      supabase.from('price_reviews')
        .insert(reviews.map((r) => ({
          organization_id: orgId,
          item_id: r.itemId,
          item_name: r.itemName,
          old_price: r.oldPrice,
          new_price: r.newPrice,
          weighted_avg: r.weightedAvg,
          currency: r.currency,
          added_qty: r.addedQty,
          existing_qty: r.existingQty,
        })))
        .then(({ error: e }) => { if (e) console.warn('reviews insert push:', e.message); });
    });
}
