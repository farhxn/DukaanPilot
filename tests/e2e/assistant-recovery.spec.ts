import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

test.skip(process.env.E2E_AI_RECOVERY !== "true", "Run with the isolated recovery test server; extraction is intercepted, never a real model key.");
const headers = () => ({ Origin: "http://127.0.0.1:3100", "X-DukaanPilot-Request": "1", "Idempotency-Key": randomUUID() });
async function onboard(page: Page) {
  const signup = await page.request.post("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-public-key", { data: { email: `recovery-${randomUUID()}@example.test`, password: "LocalTestPassword123!", returnSecureToken: true } });
  expect((await page.request.post("/api/v1/auth/session", { headers: headers(), data: { idToken: (await signup.json()).idToken } })).status()).toBe(200);
  expect((await page.request.post("/api/v1/businesses", { headers: headers(), data: { name: "Synthetic recovery audit", businessType: "Retail", city: "Karachi" } })).status()).toBe(201);
}

for (const duplicate of [false, true]) test(duplicate ? "duplicate customer can be selected without guessing or losing the instruction" : "missing customer can be added inline, then draft reviewed without posting", async ({ page }) => {
  // Pin the fixture's document. Dev-server HMR updates are unrelated to the
  // user transaction and must not refresh it while interception disables cache.
  await page.routeWebSocket(/\/_next\/webpack-hmr/, () => {});
  await onboard(page);
  const matches: { id: string; name: string; phoneE164: null }[] = [];
  if (duplicate) for (let i = 0; i < 2; i++) {
    const result = await page.request.post("/api/v1/customers", { headers: headers(), data: { name: "Sana" } });
    matches.push((await result.json()).data);
  }
  let requests = 0, selected: string | undefined;
  await page.route("**/api/v1/assistant", async route => {
    const input = route.request().postDataJSON(); requests++;
    expect(input.text).toBe("Sana sale 650 received 0");
    if (!input.customerId) return route.fulfill({ json: { data: { kind: "customer_required", customerName: "Sana", reason: duplicate ? "ambiguous" : "missing", matches, message: "Choose or add this customer. Nothing posted." } } });
    selected = input.customerId;
    const result = await page.request.post("/api/v1/proposals", { headers: headers(), data: { intent: "POST_SALE", payload: { customerId: selected, totalPaisa: "65000", receivedPaisa: "0" } } });
    expect(result.status()).toBe(201);
    const proposal = (await result.json()).data;
    return route.fulfill({ json: { data: { kind: "proposal", proposalId: proposal.id, message: "A draft is ready in Approvals." } } });
  });
  await page.goto("/assistant");
  await page.getByLabel("Your business instruction").fill("Sana sale 650 received 0");
  await page.getByRole("button", { name: "Prepare draft", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Choose or add the customer" })).toBeVisible();
  if (duplicate) {
    await page.getByRole("button", { name: new RegExp(matches[1].id.slice(0, 8)) }).click();
  } else {
    await expect(page.getByLabel("New customer name")).toHaveValue("Sana");
    await page.getByLabel("Customer phone (optional)", { exact: true }).fill("not-a-phone");
    await page.getByRole("button", { name: "Add customer and prepare draft", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Use a Pakistani number");
    await expect(page.getByLabel("Your business instruction")).toHaveValue("Sana sale 650 received 0");
    await page.getByLabel("Customer phone (optional)", { exact: true }).fill("03061234567");
    await page.getByRole("button", { name: "Add customer and prepare draft", exact: true }).click();
  }
  await expect(page.getByRole("link", { name: "Review in Approvals", exact: true })).toBeVisible();
  expect(requests).toBe(2);
  if (duplicate) expect(selected).toBe(matches[1].id);
  await expect(page.getByLabel("Your business instruction")).toHaveValue("Sana sale 650 received 0");
  expect((await (await page.request.get("/api/v1/dashboard")).json()).data.outstandingPaisa).toBe("0");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("link", { name: "Review in Approvals", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Approvals", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Review proposal", exact: true }).first()).toBeVisible();
});

