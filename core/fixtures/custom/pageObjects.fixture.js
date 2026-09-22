/**
 * Custom Fixtures: Page Objects Shortcuts
 * Cung cấp shortcut trực tiếp vào các page objects thông dụng từ pages container
 * Giúp các kịch bản test có thể khai báo trực tiếp { homePage, loginPopup, ... }
 */

const { MobileJobApplyNoCVPage } = require('../../../pages/mobile-web/MobileJobApplyNoCVPage');
const { MobileJobApplyPage } = require('../../../pages/mobile-web/MobileJobApplyPage');
const { MobilePopupConsent } = require('../../../pages/mobile-web/MobilePopupConsent');

module.exports = {
  homePage: async ({ pages }, use) => {
    await use(pages.homePage);
  },
  loginPopup: async ({ pages }, use) => {
    await use(pages.loginPopup);
  },
  popupConsent: async ({ pages }, use) => {
    await use(pages.popupConsent);
  },
  onboardingPopup: async ({ pages }, use) => {
    await use(pages.onboardingPopup);
  },
  userProfilePage: async ({ pages }, use) => {
    await use(pages.userProfilePage);
  },
  jobSearchPage: async ({ pages }, use) => {
    await use(pages.jobSearchPage);
  },
  createJobApplyPage: async ({}, use) => {
    await use((p) => new MobileJobApplyPage(p));
  },
  createJobApplyNoCVPage: async ({}, use) => {
    await use((p) => new MobileJobApplyNoCVPage(p));
  },
  createPopupConsent: async ({}, use) => {
    await use((p) => new MobilePopupConsent(p));
  },
};
