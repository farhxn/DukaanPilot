import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
test("owner can download private data and request deletion review without erasing records", async ({ page }) => {
  const email = `privacy-${randomUUID()}@example.test`;
  const signup = await page.request.post("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-public-key", { data: { email, password: "LocalTestPassword123!", returnSecureToken: true } });
  const headers = { Origin: "http://127.0.0.1:3100", "X-DukaanPilot-Request": "1", "Idempotency-Key": randomUUID() };
  expect((await page.request.post("/api/v1/auth/session", { headers, data: { idToken: (await signup.json()).idToken } })).status()).toBe(200);
  expect((await page.request.post("/api/v1/businesses", { headers, data: { name: "Synthetic privacy shop", businessType: "Retail", city: "Karachi" } })).status()).toBe(201);
  await page.goto("/setup");
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download business data", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("dukaanpilot-business-data.json");
  await page.getByRole("button", { name: "Request deletion review", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Your records have not been erased");
  expect((await page.request.get("/api/v1/business")).status()).toBe(200);
  expect((await page.request.get("/health/live")).status()).toBe(200);
  expect((await page.request.get("/health/ready")).status()).toBe(200);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
