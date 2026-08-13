const { test: setup, expect } = require('@playwright/test');

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Thực hiện các bước login tại đây (ví dụ)
  // await page.goto('/login');
  // await page.fill('input[name="username"]', 'admin');
  // await page.fill('input[name="password"]', 'password');
  // await page.click('button[type="submit"]');
  // await expect(page.locator('text=Welcome')).toBeVisible();

  // Lưu lại storage state để dùng cho các test khác
  // await page.context().storageState({ path: authFile });
});
