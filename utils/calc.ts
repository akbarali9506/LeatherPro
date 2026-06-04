import { BatchChemical, BatchMaterial, ExchangeRates, Grade, GradeOutput, OtherCost } from '../types';
import { toUSD } from './currency';

export const GRADES: Grade[] = ['Grade 1', 'Grade 2', 'Grade 3'];

export function calcBatchCosts(
  chemicals: BatchChemical[],
  wetBlue: BatchMaterial[],
  otherCosts: OtherCost[],
  output: Record<Grade, GradeOutput>,
  rates: ExchangeRates,
) {
  const chemCost = chemicals.reduce(
    (sum, c) => sum + toUSD(c.usedQty * c.price, c.currency, rates),
    0,
  );
  const rawCost = wetBlue.reduce(
    (sum, w) => sum + toUSD(w.qty * w.price, w.currency, rates),
    0,
  );
  const otherCost = otherCosts.reduce(
    (sum, o) => sum + toUSD(o.amount, o.currency, rates),
    0,
  );
  const totalCost = chemCost + rawCost + otherCost;
  const revenue = GRADES.reduce(
    (sum, g) => sum + toUSD(output[g].qty * output[g].price, output[g].currency, rates),
    0,
  );
  const profit = revenue - totalCost;
  return { chemCost, rawCost, otherCost, totalCost, revenue, profit };
}

export function calcWeightedAvg(
  existingQty: number,
  existingPrice: number,
  addedQty: number,
  newPrice: number,
): number {
  const total = existingQty + addedQty;
  if (total === 0) return newPrice;
  return (existingQty * existingPrice + addedQty * newPrice) / total;
}
