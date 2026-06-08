import { AppSettings, Batch, Buyer, InventoryItem, Sale } from '../types';

// Native stub — PDF generation is web-only (Metro picks pdf.web.ts on web)
export function downloadChemicalPDF(_inventory: InventoryItem[], _settings: AppSettings): void {}
export function downloadLeatherPDF(_inventory: InventoryItem[], _settings: AppSettings): void {}
export function downloadBatchPDF(_batch: Batch, _inventory: InventoryItem[], _settings: AppSettings): void {}
export function downloadSalesPDF(_sales: Sale[], _inventory: InventoryItem[], _settings: AppSettings): void {}
export function downloadBuyerPDF(_buyer: Buyer, _bSales: Sale[], _inventory: InventoryItem[], _settings: AppSettings): void {}
