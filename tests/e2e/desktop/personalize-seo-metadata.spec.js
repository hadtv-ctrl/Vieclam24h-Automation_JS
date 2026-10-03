const { test, expect } = require('../../../core/fixtures/baseTest');
const { PersonalizePage } = require('../../../pages/desktop/PersonalizePage');

test.describe('Feature: Cá nhân hóa tiêu chí tìm việc & gợi ý việc làm phù hợp @seo @metadata @personalize @desktop @e2e @REQ-008', () => {
  test('TC-105 - AC-023: Kiểm tra cấu hình SEO Metadata và Open Graph tags trên Personalized Page', async ({ page }, testInfo) => {
    test.setTimeout(120000);
    const personalizePage = new PersonalizePage(page, 'personalize_seo_metadata');

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Truy cập trang Việc làm dành riêng cho bạn để kiểm tra các thẻ SEO & Social Metadata',
    });

    await test.step('Given Tiền điều kiện: Truy cập trực tiếp trang Personalized Page', async () => {
      await personalizePage.navigateToPersonalizedPage();
      await personalizePage.capture('seo_page_loaded');
    });

    await test.step('When Kiểm tra tiêu đề trang (Title) và các thẻ Meta chuẩn SEO', async () => {
      // 1. Title tag
      const pageTitle = await page.title();
      expect(pageTitle).toContain('Việc làm dành riêng cho bạn');
      expect(pageTitle).toContain('Vieclam24h');

      // 2. Meta description
      const metaDescription = await personalizePage.getMetaDescription();
      expect(metaDescription).toBeTruthy();
      expect(metaDescription).toContain('dành riêng cho bạn');

      // 3. Meta keywords
      const metaKeywords = await personalizePage.getMetaKeywords();
      expect(metaKeywords).toBeTruthy();
      expect(metaKeywords).toContain('việc làm dành riêng cho bạn');

      // 4. Canonical link
      const canonical = await personalizePage.getCanonicalHref();
      expect(canonical).toBeTruthy();
      expect(canonical).toContain(personalizePage.personalizedPath);

      await personalizePage.capture('seo_meta_tags_verified');
    });

    await test.step('Then Kiểm tra các thẻ Open Graph (OG) phục vụ chia sẻ mạng xã hội', async () => {
      // OG title
      const ogTitle = await personalizePage.getOgTitle();
      expect(ogTitle).toBeTruthy();
      expect(ogTitle).toContain('Việc làm dành riêng cho bạn');

      // OG url
      const ogUrl = await personalizePage.getOgUrl();
      expect(ogUrl).toBeTruthy();
      expect(ogUrl).toContain(personalizePage.personalizedPath);

      // OG description
      const ogDesc = await personalizePage.getOgDescription();
      expect(ogDesc).toBeTruthy();

      await personalizePage.capture('og_meta_tags_verified');
    });
  });
});
