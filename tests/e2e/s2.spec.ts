import { test, expect, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";

const origin = "http://127.0.0.1:3100";
const writeHeaders = () => ({ Origin: origin, "X-DukaanPilot-Request": "1", "Idempotency-Key": randomUUID() });

async function apiOwner(request: APIRequestContext, name: string) {
  const email = `synthetic-${randomUUID()}@example.test`;
  const signup = await request.post("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-public-key", { data: { email, password: "LocalTestPassword123!", returnSecureToken: true } });
  expect(signup.ok()).toBeTruthy();
  const session = await request.post("/api/v1/auth/session", { headers: writeHeaders(), data: { idToken: (await signup.json()).idToken } });
  expect(session.status()).toBe(200);
  const business = await request.post("/api/v1/businesses", { headers: writeHeaders(), data: { name, businessType: "Retail", city: "Karachi" } });
  expect(business.status()).toBe(201);
  return (await business.json()).data;
}

test("owner can sign in, onboard, maintain customers/suppliers, and sign out", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(`synthetic-${randomUUID()}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill("LocalTestPassword123!");
  await page.getByRole("button", { name: "Create local test account", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Workspace setup", exact: true })).toBeVisible({ timeout: 60000 });
  await page.getByLabel("Business name", { exact: true }).fill("Synthetic Bakery " + testInfo.project.name);
  await page.getByLabel("Business type", { exact: true }).fill("Bakery");
  await page.getByLabel("City", { exact: true }).fill("Karachi");
  await page.getByRole("button", { name: "Create business workspace", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Customers", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add customer", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Ali Test");
  await page.getByLabel("Phone number (optional)", { exact: true }).fill("03001234567");
  await page.getByLabel("Notes (optional)", { exact: true }).fill("Synthetic test contact");
  await page.getByRole("button", { name: "Save customer", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ali Test", exact: true })).toBeVisible();
  await expect(page.getByText("+923001234567", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Edit Ali Test", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Ali Updated");
  await page.getByRole("button", { name: "Save customer", exact: true }).click();
  await expect(page.getByRole("region", { name: "customers directory", exact: true })).toHaveAttribute("aria-busy", "false", { timeout: 20000 });
  await expect(page.getByRole("heading", { name: "Ali Updated", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Ali Updated", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Archive Ali Updated", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ali Updated", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Archived", exact: true }).click();
  await page.getByRole("button", { name: "Restore Ali Updated", exact: true }).click();
  await page.getByRole("button", { name: "Active", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ali Updated", exact: true })).toBeVisible();
  await page.getByLabel("Search contacts", { exact: true }).fill("not-a-match");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No matching contacts.", exact: true })).toBeVisible();
  await page.getByLabel("Search contacts", { exact: true }).fill("0300");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ali Updated", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const nameBounds = await page.getByRole("heading", { name: "Ali Updated", exact: true }).boundingBox();
  expect(nameBounds!.width).toBeGreaterThan(100);
  await page.screenshot({ path: `work/screenshots/s2-customers-${testInfo.project.name}.png`, fullPage: true });
  await page.goto("/suppliers");
  await page.getByRole("button", { name: "Add supplier", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Synthetic flour supplier");
  await page.getByRole("button", { name: "Save supplier", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Synthetic flour supplier", exact: true })).toBeVisible();
  await page.goto("/setup");
  await page.getByLabel("City", { exact: true }).fill("Lahore");
  await page.getByRole("button", { name: "Save business profile", exact: true }).click();
  await expect(page.getByText("Business profile saved.", { exact: true })).toBeVisible();
  await expect(page.getByLabel("City", { exact: true })).toHaveValue("Lahore");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("button", { name: "Create local test account", exact: true })).toBeVisible();
  await page.goto("/customers");
  await expect(page.getByRole("heading", { name: "Sign in to your workspace.", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("API enforces session identity, tenant boundaries, CSRF, idempotency and logout revocation", async ({ playwright, request }) => {
  const unauth = await request.get("/api/v1/customers");
  expect(unauth.status()).toBe(401);
  const forged = await request.post("/api/v1/auth/session", { headers: writeHeaders(), data: { idToken: "forged-not-a-firebase-token" } });
  expect(forged.status()).toBe(401);
  const a = await playwright.request.newContext({ baseURL: origin });
  const b = await playwright.request.newContext({ baseURL: origin });
  try {
    await apiOwner(a, "Synthetic API A");
    await apiOwner(b, "Synthetic API B");
    const headers = writeHeaders();
    const body = { name: "Private API contact", phoneE164: "03021234567" };
    const created = await a.post("/api/v1/customers", { headers, data: body });
    expect(created.status()).toBe(201);
    const contact = (await created.json()).data;
    const replay = await a.post("/api/v1/customers", { headers, data: body });
    expect((await replay.json()).data.id).toBe(contact.id);
    expect((await a.post("/api/v1/customers", { headers, data: { name: "Changed" } })).status()).toBe(409);
    expect((await b.get(`/api/v1/customers/${contact.id}`)).status()).toBe(404);
    expect((await b.patch(`/api/v1/customers/${contact.id}`, { headers: writeHeaders(), data: { version: contact.version, name: "Stolen" } })).status()).toBe(404);
    expect((await b.get(`/api/v1/customers?cursor=${contact.id}`)).status()).toBe(404);
    expect((await b.get("/api/v1/customers?q=Private API contact")).status()).toBe(200);
    expect((await (await b.get("/api/v1/customers?q=Private API contact")).json()).data.items).toHaveLength(0);
    expect((await b.post("/api/v1/customers", { headers: writeHeaders(), data: { name: "Forged tenant", tenantId: contact.tenantId } })).status()).toBe(422);
    expect((await a.post("/api/v1/customers", { headers: { ...writeHeaders(), Origin: "https://evil.example" }, data: { name: "Blocked" } })).status()).toBe(403);
    expect((await a.post("/api/v1/customers", { headers: { Origin: origin }, data: { name: "Blocked" } })).status()).toBe(403);
    const stored = await a.storageState();
    const cookie = stored.cookies.find(cookie => cookie.name === "dukaanpilot_session")!;
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe("Lax");
    const clone = await playwright.request.newContext({ baseURL: origin, storageState: stored });
    try {
      expect((await a.delete("/api/v1/auth/session", { headers: writeHeaders() })).status()).toBe(200);
      expect((await clone.get("/api/v1/customers")).status()).toBe(401);
    } finally { await clone.dispose(); }
  } finally { await a.dispose(); await b.dispose(); }
});
