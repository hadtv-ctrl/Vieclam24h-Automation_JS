const { LoginPopup } = require('../desktop/LoginPopup');

class MobileLoginPopup extends LoginPopup {
  constructor(page, featureName) {
    super(page, featureName);
    this.loginHeaderBtn = page.getByRole('button', { name: 'Đăng nhập' }).first();
  }
}

module.exports = { MobileLoginPopup };
