import { test, expect } from '../fixtures/test-fixtures';

/**
 * REQ-008 - test
 * Requirement : requirements/REQ-008-test.md
 */
test.describe('REQ-008 - test', { tag: '@REQ-008' }, () => {
  test.fixme(
    'TC-032 - AC-001 verify test scenario 1',
    { tag: ['@wip', '@p2'] },
    async ({ page }) => {
      await test.step('Bước 1: Điều hướng tới trang', async () => {
        // await page.goto('/...');
        expect(page).toBeDefined();
      });

      await test.step('Bước 2: Kiểm tra kết quả mong đợi', async () => {
        expect(false, 'TODO: viết assertion cho AC-001').toBe(true);
      });
    },
  );

  test.fixme(
    'TC-033 - AC-002 verify test scenario 2',
    { tag: ['@wip', '@p2'] },
    async ({ page }) => {
      await test.step('Bước 1: Điều hướng tới trang', async () => {
        // await page.goto('/...');
        expect(page).toBeDefined();
      });

      await test.step('Bước 2: Kiểm tra kết quả mong đợi', async () => {
        expect(false, 'TODO: viết assertion cho AC-002').toBe(true);
      });
    },
  );
});
