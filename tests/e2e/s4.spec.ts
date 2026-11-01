import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
test("disconnected assistant preserves manual operations and truthful usage", async ({ page }) => {
  const email = `assistant-${randomUUID()}@example.test`;
  const signup = await page.request.post("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-public-key", { data: { email, password: "LocalTestPassword123!", returnSecureToken: true } });
  const headers = { Origin: "http://127.0.0.1:3100", "X-DukaanPilot-Request": "1", "Idempotency-Key": randomUUID() };
  expect((await page.request.post("/api/v1/auth/session", { headers, data: { idToken: (await signup.json()).idToken } })).status()).toBe(200);
  expect((await page.request.post("/api/v1/businesses", { headers, data: { name: "Synthetic assistant shop", businessType: "Retail", city: "Karachi" } })).status()).toBe(201);
  await page.goto("/assistant");
  await expect(page.getByRole("button", { name: "Prepare draft", exact: true })).toBeDisabled();
  await expect(page.getByRole("status")).toContainText("assistant is disconnected");
  await page.getByRole("link", { name: "Enter a sale or receipt", exact: true }).click();
  await expect(page.getByRole("button", { name: "Record sale", exact: true })).toBeEnabled();
  expect((await page.request.post("/api/v1/assistant", { headers, data: { text: "Ali sale 650" } })).status()).toBe(503);
  await page.goto("/usage");
  await expect(page.getByRole("heading", { name: "free pilot plan", exact: true })).toBeVisible();
  await expect(page.getByText("0 / 50", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
