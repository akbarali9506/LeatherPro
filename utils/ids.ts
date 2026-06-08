import { InventoryItem, Batch, DeletedBatch, Sale } from '../types';

function nextId(existing: string[], prefix: string): string {
  const nums = existing
    .filter((id) => id.startsWith(prefix))
    .map((id) => parseInt(id.replace(prefix, ''), 10))
    .filter((n) => !isNaN(n));
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

export function nextInventoryId(
  items: InventoryItem[],
  type: 'Chemical' | 'Wet Blue' | 'Finished Leather',
): string {
  const prefix = type === 'Chemical' ? 'C' : type === 'Wet Blue' ? 'W' : 'F';
  return nextId(
    items.map((i) => i.id),
    prefix,
  );
}

export function nextBatchId(batches: Batch[], deletedBatches: DeletedBatch[] = []): string {
  return nextId(
    [...batches, ...deletedBatches].map((b) => b.id),
    'B',
  );
}

export function nextSaleId(sales: Sale[]): string {
  return nextId(
    sales.map((s) => s.id),
    'S',
  );
}
