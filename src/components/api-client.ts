export class ClientError extends Error {
  fields: Record<string, string>;
  status: number;
  constructor(message: string, status: number, fields: Record<string, string> = {}) {
    super(message); this.fields = fields; this.status = status;
  }
}

export function failureMessage(error: unknown, fallback: string) {
  if (error instanceof ClientError && Object.keys(error.fields).length) return Object.values(error.fields).join(" ");
  return error instanceof Error ? error.message : fallback;
}

export async function apiRequest<T>(url: string, options: { method?: string; body?: unknown; key?: string; signal?: AbortSignal; timeoutMs?: number } = {}): Promise<T> {
  let result: Response;
  const timeout = AbortSignal.timeout(options.timeoutMs ?? (options.method && !["GET", "HEAD"].includes(options.method.toUpperCase()) ? 60000 : 20000));
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  try {
    result = await fetch(url, { method: options.method ?? "GET", credentials: "same-origin", signal,
      headers: { "Content-Type": "application/json", "X-DukaanPilot-Request": "1", ...(options.key ? { "Idempotency-Key": options.key } : {}) },
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ClientError("We couldn’t confirm this request. Check your connection, then retry without changing the details.", 0);
  }
  const payload = await result.json().catch(() => null);
  if (!result.ok) throw new ClientError(payload?.error?.message ?? "The request could not be completed. Please try again.", result.status, payload?.error?.fieldErrors);
  if (!payload || typeof payload !== "object" || !("data" in payload)) throw new ClientError("We couldn’t confirm the response. Retry without changing the details, or refresh your records before starting another action.", 0);
  return payload.data as T;
}
