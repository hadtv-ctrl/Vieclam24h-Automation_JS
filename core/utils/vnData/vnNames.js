/**
 * Tu dien va thuat toan sinh ho ten tieng Viet chuan NFC va toAscii.
 */

const FAMILY_NAMES = [
  'Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ',
  'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý', 'Đinh', 'Đoàn'
];

const MALE_MIDDLE_NAMES = [
  'Văn', 'Hữu', 'Đức', 'Quang', 'Minh', 'Đình', 'Quốc', 'Trọng', 'Tuấn', 'Hải'
];

const FEMALE_MIDDLE_NAMES = [
  'Thị', 'Ngọc', 'Thu', 'Mai', 'Phương', 'Thanh', 'Ánh', 'Quỳnh', 'Hồng', 'Thùy'
];

const MALE_GIVEN_NAMES = [
  'Hùng', 'Dũng', 'Tuấn', 'Nam', 'Long', 'Cường', 'Hải', 'Quân', 'Phong',
  'Khoa', 'Kiên', 'Bách', 'Thành', 'Bảo', 'Hoàng', 'Khánh', 'Sơn', 'Tú'
];

const FEMALE_GIVEN_NAMES = [
  'Lan', 'Hoa', 'Mai', 'Linh', 'Trang', 'Hương', 'Thảo', 'Nga', 'Hà',
  'Yến', 'Anh', 'Ngân', 'Huyền', 'Tâm', 'Trâm', 'Vy', 'Châu', 'Chi'
];

function toAscii(text) {
  if (!text) return '';
  return String(text)
    .replace(/[đĐ]/g, (m) => (m === 'đ' ? 'd' : 'D'))
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .normalize('NFC');
}

function generateFullName(rng, opts = {}) {
  let gender = opts.gender || 'any';
  if (!['any', 'male', 'female'].includes(gender)) {
    const err = new Error(`Gioi tinh khong hop le: ${gender}`);
    err.field = 'gender';
    throw err;
  }
  if (gender === 'any') {
    gender = rng.next() > 0.5 ? 'male' : 'female';
  }

  const surname = rng.pick(FAMILY_NAMES);
  const middle = rng.pick(gender === 'male' ? MALE_MIDDLE_NAMES : FEMALE_MIDDLE_NAMES);
  const given = rng.pick(gender === 'male' ? MALE_GIVEN_NAMES : FEMALE_GIVEN_NAMES);

  let fullName = `${surname} ${middle} ${given}`.normalize('NFC');
  if (opts.diacritics === false) {
    fullName = toAscii(fullName);
  }

  return {
    fullName,
    surname,
    middle,
    given,
    gender
  };
}

module.exports = {
  FAMILY_NAMES,
  toAscii,
  generateFullName
};
