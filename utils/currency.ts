import { Currency, ExchangeRates } from '../types';

export function toUSD(amount: number, currency: Currency, rates: ExchangeRates): number {
  return amount * rates[currency];
}

export function formatUSD(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatCurrency(amount: number, currency: Currency): string {
  if (currency === 'USD') return `$${amount.toFixed(2)}`;
  if (currency === 'EUR') return `€${amount.toFixed(2)}`;
  return `${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })} UZS`;
}
