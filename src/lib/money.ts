import { latinDigits } from "./human-text.ts";
export const MAX_PAISA = 1_000_000_000n;

export function parsePaisa(value: unknown, allowZero = false): bigint {
  if (typeof value !== "string" || !/^\d{1,10}$/.test(value)) throw new Error("Enter an exact integer-paisa string.");
  const amount = BigInt(value);
  if (amount < (allowZero ? 0n : 1n) || amount > MAX_PAISA) throw new Error("Amount must be positive and no more than PKR 10,000,000.");
  return amount;
}

export function rupeesToPaisa(value: string): string {
  let cleaned = latinDigits(value).trim();
  if (cleaned.includes(",")) {
    if (!/^(?:\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})+,\d{3})(?:\.\d{1,2})?$/.test(cleaned)) throw new Error("Use correctly grouped commas, for example 1,000 or 1,00,000.");
    cleaned = cleaned.replaceAll(",", "");
  }
  const match = /^(\d{1,8})(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) throw new Error("Enter rupees with at most two decimal places.");
  const amount = BigInt(match[1]) * 100n + BigInt((match[2] ?? "").padEnd(2, "0"));
  if (amount > MAX_PAISA) throw new Error("Amount exceeds PKR 10,000,000.");
  return amount.toString();
}

export function formatPkr(value: string | bigint): string {
  const amount = BigInt(value), positive = amount < 0n ? -amount : amount;
  return `Rs ${amount < 0n ? "-" : ""}${(positive / 100n).toLocaleString("en-PK")}.${(positive % 100n).toString().padStart(2, "0")}`;
}

export function quantityMills(value: unknown): bigint {
  if (typeof value !== "string" || !/^\d{1,9}(?:\.\d{1,3})?$/.test(value)) throw new Error("Use a positive quantity with up to three decimal places.");
  const [whole, fraction = ""] = value.split(".");
  const mills = BigInt(whole) * 1000n + BigInt(fraction.padEnd(3, "0"));
  if (mills <= 0n) throw new Error("Quantity must be positive.");
  return mills;
}

export function quantityString(mills: bigint): string { return `${mills / 1000n}.${(mills % 1000n).toString().padStart(3, "0")}`; }
export function lineTotal(unitPrice: bigint, mills: bigint): bigint { return (unitPrice * mills + 500n) / 1000n; }
