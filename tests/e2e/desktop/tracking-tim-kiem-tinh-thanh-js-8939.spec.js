const { test, expect } = require('../../../core/fixtures/baseTest');
const { startMixpanelCapture, expectMixpanelEvent } = require('../../../core/deep-testing');
const { ProvinceFilterVersionHelper } = require('../../../pages/desktop/search/ProvinceFilterVersionHelper');
const trackingData = require('../../../data/js8939TrackingData.json');

const { event: SEARCH_EVENT, scenarios } = trackingData;

/**
 * Chỉ assert hành vi đã chốt (JS-8939 + solution PO): không chọn tỉnh -> null; số tỉnh và filter_version
 * theo phiên bản danh sách. Hành vi F5 sau khi chọn Toàn quốc còn Open question nên KHÔNG assert ở đây.
 */
test.describe('Feature: Tracking tìm kiếm theo tỉnh thành (JS-8939) @guest @no-auth  @desktop @e2e @tracking @REQ-013 @regression', () => {
  test.describe.configure({ timeout: 180000 });

  /** Mở trang tìm kiếm với capture bật sẵn; trả về mốc index để chỉ xét event phát sinh sau thao tác. */
  async function openSearchWithCapture(page, pages) {
    const capture = startMixpanelCapture(page);
    const jobSearchPage = pages.jobSearchPage;
    await jobSearchPage.registerGuestPopupAutoHandlers();
    await jobSearchPage.open();
    await jobSearchPage.closeAllPopupsIfVisible();
    await jobSearchPage.expectJobSearchPageVisible();
    return { capture, jobSearchPage };
  }

  const afterMark = (capture, mark) => (e) => capture.events.indexOf(e) >= mark;

  test('TC-172 - AC-071 Không chọn tỉnh thành rồi Tìm kiếm thì province_number và filter_version không được ghi nhận', async ({
    page,
    pages,
  }, testInfo) => {
    testInfo.annotations.push({ type: 'Precondition', description: 'Khách vãng lai, Desktop, trang tìm việc' });
    const { capture, jobSearchPage } = await openSearchWithCapture(page, pages);
    let mark = 0;

    await test.step('When Người dùng không chọn tỉnh thành và bấm Tìm kiếm', async () => {
      mark = capture.events.length;
      await jobSearchPage.clickSearch();
    });

    await test.step(`Then Event "${SEARCH_EVENT}" có province_number, filter_version, district_number = null`, async () => {
      const found = await expectMixpanelEvent(capture, SEARCH_EVENT, {
        where: afterMark(capture, mark),
        properties: scenarios.noProvince.expected,
      });
      expect(found.length).toBeGreaterThanOrEqual(1);
      await jobSearchPage.capture('js8939_no_province_search', false);
    });
  });

  /** Chọn tỉnh theo kịch bản rồi Tìm kiếm; assert event bắn đúng 1 lần với property mong đợi. */
  async function expectProvinceSearchEvent(key, { page, pages }, testInfo) {
    const scenario = scenarios[key];
    testInfo.annotations.push({ type: 'Precondition', description: 'Khách vãng lai, Desktop, trang tìm việc' });
    const { capture, jobSearchPage } = await openSearchWithCapture(page, pages);
    const provinceFilter = new ProvinceFilterVersionHelper(jobSearchPage);
    let mark = 0;

    await test.step(`When Người dùng chọn "${scenario.province}" ở danh sách ${scenario.version}, Áp dụng rồi Tìm kiếm`, async () => {
      mark = capture.events.length;
      await provinceFilter.searchByProvince(scenario.version, scenario.province);
    });

    await test.step(`Then Event "${SEARCH_EVENT}" bắn đúng 1 lần với ${JSON.stringify(scenario.expected)}`, async () => {
      await expectMixpanelEvent(capture, SEARCH_EVENT, {
        where: afterMark(capture, mark),
        count: 1,
        settleMs: 2000,
        properties: scenario.expected,
      });
      await jobSearchPage.capture(`js8939_${key}_search`, false);
    });
  }

  // Title viết literal (không sinh từ vòng lặp) để bộ quét truy vết đọc được mã TC/AC.
  test('TC-173 - AC-072 Filter tỉnh/thành cũ chọn Hà Nội ghi nhận province_number 1 và filter_version 1.0', async ({ page, pages }, testInfo) => {
    await expectProvinceSearchEvent('oldHaNoi', { page, pages }, testInfo);
  });

  test('TC-174 - AC-073 Filter sau sáp nhập chọn Toàn quốc ghi nhận province_number 34 và filter_version 2.0', async ({ page, pages }, testInfo) => {
    await expectProvinceSearchEvent('newNationwide', { page, pages }, testInfo);
  });
});
