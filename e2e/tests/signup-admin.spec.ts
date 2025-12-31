import path from "node:path";
import { config as loadEnv } from "dotenv";
import { test, expect } from "@playwright/test";

const envConfig = loadEnv({ path: path.resolve(process.cwd(), ".env"), quiet: true }).parsed ?? {};
const adminPort = process.env.ADMIN_FRONTEND_PORT ?? envConfig.ADMIN_FRONTEND_PORT ?? "8082";
const adminBase = process.env.ADMIN_BASE_URL ?? `http://localhost:${adminPort}`;
const adminUser = process.env.ADMIN_USER ?? envConfig.ADMIN_USER ?? "admin";
const adminPass = process.env.ADMIN_PASS ?? envConfig.ADMIN_PASS ?? "admin12345";

test("admin can login, create blog post, and read metrics", async ({ browser }) => {
  const adminPage = await browser.newPage();
  await adminPage.goto(`${adminBase}/admin/login`);
  await adminPage.getByRole("textbox", { name: /username/i }).fill(adminUser);
  await adminPage.getByRole("textbox", { name: /password/i }).fill(adminPass);
  await adminPage.getByRole("button", { name: "Sign in" }).click();
  await expect(adminPage.locator(".panelTitle")).toHaveText("New Signups");
  await adminPage.getByRole("button", { name: "Blog editor" }).click();
  await expect(adminPage.getByLabel("Title", { exact: true })).toBeVisible();

  const uniqueTitle = `Playwright blog ${Date.now()}`;
  await adminPage.getByLabel("Title", { exact: true }).fill(uniqueTitle);
  await adminPage
    .getByLabel("Excerpt (optional)", { exact: true })
    .fill("Playwright generated excerpt.");
  await adminPage
    .getByLabel("Content (markdown)", { exact: true })
    .fill("## Playwright edit\n- Step 1\n- Step 2");
  await adminPage.getByLabel("Tags (comma separated)", { exact: true }).fill("playwright,test");
  await adminPage.getByLabel("Publish immediately", { exact: true }).check();
  await adminPage.getByLabel("Queue newsletter", { exact: true }).check();
  await adminPage.getByRole("button", { name: "Create blog post" }).click();
  await expect(adminPage.locator(".toastMsg")).toContainText(/Blog post/);

  const metricsResponse = await adminPage.request.get(`${adminBase}/metrics`);
  expect(metricsResponse.ok()).toBeTruthy();
  const metrics = await metricsResponse.json();
  expect(metrics.requestsTotal).toBeGreaterThan(0);

  const notifyResponse = await adminPage.request.get(`${adminBase}/api/admin/blog/notifications`);
  expect(notifyResponse.ok()).toBeTruthy();
  const notificationData = await notifyResponse.json();
  expect(Array.isArray(notificationData.pending)).toBe(true);
});

test("signup flow and related posts are visible", async ({ page }) => {
  const username = `pw${Date.now()}`;
  await page.goto("/");
  await page
    .getByRole("textbox", { name: /username/i })
    .first()
    .fill(username);
  await page.getByRole("textbox", { name: /^Mobile number/i }).fill("+15555551234");
  await page.getByRole("textbox", { name: /^Create password/i }).fill("Playwright1");
  await page.getByRole("textbox", { name: /^Re-enter password/i }).fill("Playwright1");
  await expect(page.locator(".signupPanel")).toBeVisible();
  await expect(page.locator(".signupBlogSidebar")).toHaveCount(2);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/success/);
  await expect(page.locator(".successTitle")).toHaveText("SignUp Successful");
});
