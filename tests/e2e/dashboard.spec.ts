import { test, expect } from "@playwright/test";

test("overview is truthful, responsive, and links through every workspace section", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Use AI assistant", exact: false })).toBeVisible();
  await expect(page.locator("#sidebar").getByRole("link", { name: "WhatsApp & messages", exact: true })).toHaveCount(0);
  await expect(page.getByText("Business, over WhatsApp", { exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Use AI assistant", exact: false }).click();
  await expect(page.getByRole("heading", { name: "Your business assistant", exact: true })).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "A fresh start for your business." })).toBeVisible();
  await expect(page.getByText("No financial data yet.", { exact: false })).toBeVisible();
  await expect(page.getByLabel("Not available", { exact: true })).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.getByRole("button", { name: /approve|record sale|send message/i })).toHaveCount(0);
  await page.getByText("About this preview", { exact: true }).click();
  await expect(page.getByText("Every financial action needs your approval.", { exact: false })).toBeVisible();
  await page.getByText("About this preview", { exact: true }).click();
  for (const [label, heading] of [["Orders", "Orders"], ["Customers", "Customers"], ["Ledger & udhaar", "Ledger & udhaar"], ["Approvals", "Approvals"], ["Usage", "Usage"], ["Workspace setup", "Workspace setup"]]) {
    if (testInfo.project.name === "mobile") await page.getByRole("button", { name: "Open navigation", exact: true }).click();
    await page.locator("#sidebar").getByRole("link", { name: label, exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: heading, exact: true })).toBeVisible();
    if (testInfo.project.name === "mobile") await expect(page.getByRole("button", { name: "Open navigation", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await expect(page.getByText("Gemini assistant", { exact: true })).toBeVisible();
  await expect(page.getByText("Not connected", { exact: true })).toBeVisible();
  await page.goto("/");
  await page.screenshot({ path: `work/screenshots/overview-${testInfo.project.name}.png`, fullPage: true });
  expect(errors).toEqual([]);
});

test("unknown routes give a recovery path and security headers", async ({ page }) => {
  const response = await page.goto("/does-not-exist");
  await expect(page.getByRole("heading", { name: "We couldn’t find that page." })).toBeVisible();
  expect(response?.headers()["x-frame-options"]).toBe("DENY");
  await page.getByRole("link", { name: "Back to overview", exact: true }).click();
  await expect(page.getByRole("heading", { name: "A fresh start for your business." })).toBeVisible();
});
