/**
 * qaBoundaryMatrix.js - Xây dựng ma trận phân vùng tương đương (EP) và điểm biên (BVA).
 * Thuần thuật toán xác định (0 token AI), bảo vệ đảo ngược biên, ngân sách dòng <= 200.
 */

function buildMatrix(constraint) {
  if (!constraint || typeof constraint !== 'object') {
    return { partitions: [], values: [], invalidTypes: [] };
  }

  const { kind = 'number', min = null, max = null } = constraint;
  const isLength = kind === 'length';
  let rawPoints = [];
  let partitions = [];

  let actualMin = min;
  let actualMax = max;
  if (actualMin !== null && actualMax !== null && actualMin > actualMax) {
    actualMin = max;
    actualMax = min;
  }

  if (actualMin !== null && actualMax !== null) {
    if (actualMin === actualMax) {
      rawPoints = [
        { value: actualMin - 1, valid: false, label: 'Dưới cận' },
        { value: actualMin, valid: true, label: 'Đúng giá trị' },
        { value: actualMin + 1, valid: false, label: 'Trên cận' }
      ];
      partitions = [
        { label: '≠ ' + actualMin, valid: false },
        { label: '= ' + actualMin, valid: true }
      ];
    } else {
      const nominal = actualMin + Math.floor((actualMax - actualMin) / 2);
      rawPoints = [
        { value: actualMin - 1, valid: false, label: 'Dưới min' },
        { value: actualMin, valid: true, label: 'Tại min' },
        { value: actualMin + 1, valid: true, label: 'Trên min' },
        { value: nominal, valid: true, label: 'Điểm giữa (nominal)' },
        { value: actualMax - 1, valid: true, label: 'Dưới max' },
        { value: actualMax, valid: true, label: 'Tại max' },
        { value: actualMax + 1, valid: false, label: 'Trên max' }
      ];
      partitions = [
        { label: '< ' + actualMin, valid: false },
        { label: actualMin + ' … ' + actualMax, valid: true },
        { label: '> ' + actualMax, valid: false }
      ];
    }
  } else if (actualMin !== null) {
    rawPoints = [
      { value: actualMin - 1, valid: false, label: 'Dưới min' },
      { value: actualMin, valid: true, label: 'Tại min' },
      { value: actualMin + 1, valid: true, label: 'Trên min' }
    ];
    partitions = [
      { label: '< ' + actualMin, valid: false },
      { label: '≥ ' + actualMin, valid: true }
    ];
  } else if (actualMax !== null) {
    rawPoints = [
      { value: actualMax - 1, valid: true, label: 'Dưới max' },
      { value: actualMax, valid: true, label: 'Tại max' },
      { value: actualMax + 1, valid: false, label: 'Trên max' }
    ];
    if (isLength) {
      rawPoints.unshift({ value: 0, valid: true, label: 'Độ dài tối thiểu (implicit)', implicit: true });
    }
    partitions = [
      { label: '≤ ' + actualMax, valid: true },
      { label: '> ' + actualMax, valid: false }
    ];
  }

  const seen = new Set();
  const values = [];

  for (let i = 0; i < rawPoints.length; i++) {
    const pt = rawPoints[i];
    if (isLength && pt.value < 0) continue;
    if (seen.has(pt.value)) continue;
    seen.add(pt.value);

    const item = {
      value: pt.value,
      valid: pt.valid,
      label: pt.label
    };
    if (pt.implicit) item.implicit = true;
    if (isLength && pt.value >= 0 && pt.value <= 1024) {
      item.sample = 'x'.repeat(pt.value);
    }
    values.push(item);
  }

  values.sort((a, b) => a.value - b.value);

  let invalidTypes = [];
  if (kind === 'number') {
    invalidTypes = ['', 'abc', '1.5', ' '];
  } else if (isLength) {
    invalidTypes = ['   '];
    if (actualMin !== null && actualMin >= 1) {
      invalidTypes.unshift('');
    }
  }

  return { partitions, values, invalidTypes };
}

module.exports = {
  buildMatrix
};
