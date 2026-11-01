import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import { DomainError } from "../errors.ts";

export function invalid(field: string, message: string): never {
  throw new DomainError("VALIDATION_ERROR", 422, "Please check the highlighted fields.", { [field]: message });
}

export function object(value: unknown, allowed: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid("form", "Send a JSON object.");
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some(key => !allowed.includes(key))) invalid("form", "Unexpected field. Tenant and owner identities are set by the server.");
  return record;
}

export function text(value: unknown, field: string, maximum: number, required = true, multiline = false): string {
  if (typeof value !== "string") invalid(field, "Enter text.");
  const cleaned = value.trim();
  const forbidden = multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/ : /[\u0000-\u001f\u007f]/;
  if ((required && !cleaned) || Array.from(cleaned).length > maximum || forbidden.test(cleaned)) invalid(field, `Use ${required ? "1" : "0"}–${maximum} characters without unsupported control characters.`);
  return cleaned;
}

export function uuid(value: string, field = "id") {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) invalid(field, "Use a valid record ID.");
  return value;
}

export function normalizePhone(value: unknown): string | null {
  if (value === null || value === undefined || (typeof value === "string" && !value.trim())) return null;
  const input = text(value, "phoneE164", 40).replace(/[\s()-]/g, "");
  const explicit = input.startsWith("00") ? "+" + input.slice(2) : /^92\d{10}$/.test(input) ? "+" + input : input;
  if (!/^\+\d+$/.test(explicit) && !/^0\d+$/.test(explicit)) invalid("phoneE164", "Use a Pakistani number starting with 0, or include + and the country code.");
  const parsed = parsePhoneNumberFromString(explicit, "PK");
  if (!parsed?.isValid() || parsed.ext) invalid("phoneE164", "Enter a valid phone number without an extension.");
  return parsed.number;
}

export function contactInput(value: unknown, patch = false) {
  const input = object(value, ["name", "phoneE164", "notes", ...(patch ? ["version", "archived"] : [])]);
  const result: { name?: string; phoneE164?: string | null; notes?: string | null; version?: number; archived?: boolean } = {};
  if (!patch || "name" in input) result.name = text(input.name, "name", 120);
  if (!patch || "phoneE164" in input) result.phoneE164 = normalizePhone(input.phoneE164);
  if (!patch || "notes" in input) result.notes = input.notes === null || input.notes === undefined ? null : text(input.notes, "notes", 2000, false, true) || null;
  if (patch) {
    if (!Number.isSafeInteger(input.version) || (input.version as number) < 1) invalid("version", "Refresh the record before editing.");
    result.version = input.version as number;
    if ("archived" in input) {
      if (typeof input.archived !== "boolean") invalid("archived", "Use true or false.");
      result.archived = input.archived;
    }
    if (Object.keys(input).length === 1) invalid("form", "Choose a field to update.");
  }
  return result;
}

export function businessInput(value: unknown, patch = false) {
  const input = object(value, ["name", "businessType", "city", "language", ...(patch ? ["version"] : [])]);
  const result: { name?: string; businessType?: string; city?: string; language?: string; version?: number } = {};
  for (const [key, maximum] of [["name", 120], ["businessType", 80], ["city", 80]] as const) if (!patch || key in input) result[key] = text(input[key], key, maximum);
  if (!patch || "language" in input) {
    const language = input.language ?? "roman-urdu";
    if (!["roman-urdu", "urdu", "english"].includes(language as string)) invalid("language", "Choose Roman Urdu, Urdu, or English.");
    result.language = language as string;
  }
  if (patch) {
    if (!Number.isSafeInteger(input.version) || (input.version as number) < 1) invalid("version", "Refresh the profile before editing.");
    result.version = input.version as number;
    if (Object.keys(input).length === 1) invalid("form", "Choose a field to update.");
  }
  return result;
}

export function listInput(params: URLSearchParams) {
  if ([...params.keys()].some(key => !["q", "cursor", "limit", "archived"].includes(key))) invalid("query", "Unsupported query parameter.");
  const q = text(params.get("q") ?? "", "q", 100, false);
  const limit = Number(params.get("limit") ?? 25);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) invalid("limit", "Use a limit from 1 to 100.");
  const archived = params.get("archived") ?? "false";
  if (!["true", "false"].includes(archived)) invalid("archived", "Use true or false.");
  const cursor = params.get("cursor");
  if (cursor) uuid(cursor, "cursor");
  return { q, limit, archived: archived === "true", cursor };
}
