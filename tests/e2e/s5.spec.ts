import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
test("disconnected WhatsApp has private messages, disabled pairing, and no implied delivery", async ({ page }) => {
  const email = `channel-${randomUUID()}@example.test`;
  const signup = await page.request.post("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-public-key", { data: { email, password: "LocalTestPassword123!", returnSecureToken: true } });
  const headers = { Origin: "http://127.0.0.1:3100", "X-DukaanPilot-Request": "1", "Idempotency-Key": randomUUID() };
  expect((await page.request.post("/api/v1/auth/session", { headers, data: { idToken: (await signup.json()).idToken } })).status()).toBe(200);
  expect((await page.request.post("/api/v1/businesses", { headers, data: { name: "Synthetic channel shop", businessType: "Retail", city: "Karachi" } })).status()).toBe(201);
  await page.goto("/messages");
  await expect(page.getByText("No incoming messages yet.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create pairing command", exact: true })).toBeDisabled();
  await page.getByRole("checkbox").check();
  await expect(page.getByRole("button", { name: "Create pairing command", exact: true })).toBeDisabled();
  await expect(page.getByText("No outgoing messages yet.", { exact: true })).toBeVisible();
  expect((await page.request.post("/api/v1/whatsapp/pairing-challenges", { headers, data: { consent: true } })).status()).toBe(503);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
