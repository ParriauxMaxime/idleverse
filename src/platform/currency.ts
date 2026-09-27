import { formatNumber } from "../engine/format";

export const CURRENCY = {
  name: "dollar",
  symbol: "$",
};

export function formatMoney(amount: number): string {
  return `${formatNumber(amount)} ${CURRENCY.symbol}`;
}

export function formatIncome(amountPerSecond: number): string {
  return `+${formatNumber(amountPerSecond, 1)} ${CURRENCY.symbol}/s`;
}
