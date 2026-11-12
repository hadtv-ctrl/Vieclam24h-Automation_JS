'use strict';

/** Các nhóm finding của báo cáo truy vết không phụ thuộc danh sách ứng viên automation. */

/**
 * 0. LINT TÀI LIỆU — phải chạy trước mọi kiểm tra khác.
 *    Một parser im lặng bỏ qua file nó không hiểu sẽ báo "sạch" một cách dối trá.
 *    Ở đây nó buộc phải tự thú.
 */
function lintDocFindings(reqParse, tcParse) {
  const findings = [];
  for (const file of [...reqParse.unreadable, ...tcParse.unreadable]) {
    findings.push({
      kind: 'tai-lieu-khong-doc-duoc',
      severity: 'major',
      id: file,
      detail: `${file}: không tìm thấy định danh nào đúng quy ước — công cụ KHÔNG đọc được file này`,
    });
  }
  for (const { file, ids } of [...reqParse.malformed, ...tcParse.malformed]) {
    findings.push({
      kind: 'dinh-danh-sai-quy-uoc',
      severity: 'major',
      id: file,
      detail: `${file}: ${ids.slice(0, 6).join(', ')} gần giống định danh nhưng sai quy ước (đúng: REQ-001, AC-001, TC-001)`,
    });
  }
  for (const { file, req } of reqParse.withoutAc) {
    findings.push({
      kind: 'req-thieu-ac',
      severity: 'major',
      id: req,
      detail: `${file}: ${req} không có acceptance criterion nào — nghiệp vụ chưa được chốt thành điều kiện kiểm được`,
    });
  }
  return findings;
}

/** Bước 3–6: đối chiếu spec với tài liệu (truy vết, định danh, assertion, lệch AC). */
function specFindings({ specs, requirements, testCases, hasRequirements, hasTestCases, d }) {
  const findings = [];
  // 3. Spec đang chạy mà không truy về được nghiệp vụ nào -> nguy cơ missing business.
  for (const s of specs) {
    if (s.reqs.length === 0) {
      findings.push({
        kind: 'spec-khong-truy-vet',
        severity: hasRequirements ? 'major' : 'info',
        id: s.file,
        detail: `${s.file}: test.describe thiếu tag @REQ-xxx`,
      });
    }
  }

  // 4. Spec trỏ tới định danh không tồn tại trong tài liệu.
  for (const s of specs) {
    for (const r of s.reqs) {
      if (!requirements.has(r)) {
        findings.push({
          kind: 'dinh-danh-khong-ton-tai',
          severity: hasRequirements ? 'major' : 'info',
          id: r,
          detail: `${s.file} tham chiếu ${r} nhưng ${d.requirements}/ không có requirement này`,
        });
      }
    }
    for (const tc of s.tcs) {
      if (!testCases.has(tc)) {
        findings.push({
          kind: 'dinh-danh-khong-ton-tai',
          severity: hasTestCases ? 'major' : 'info',
          id: tc,
          detail: `${s.file} tham chiếu ${tc} nhưng ${d.testCases}/ không có test case này`,
        });
      }
    }
  }

  // 5. Spec tuyên bố phủ AC nào đó nhưng bên trong không có assertion -> không kiểm chứng gì cả.
  for (const s2 of specs) {
    for (const b of s2.blocks) {
      if (!b.tcs.length && !b.acs.length) continue;
      if (b.hasAssertion) continue;
      findings.push({
        kind: 'test-khong-co-assertion',
        severity: 'major',
        id: `${s2.file}::${b.tcs.join(',') || b.acs.join(',')}`,
        detail: `${s2.file}: "${b.title.slice(0, 70)}" khai phủ ${b.tcs.concat(b.acs).join(', ')} nhưng không có assertion nào`,
      });
    }
  }

  // 6. Spec và tài liệu nói khác nhau về việc TC đó phủ AC nào.
  for (const s2 of specs) {
    for (const b of s2.blocks) {
      for (const tc of b.tcs) {
        const doc = testCases.get(tc);
        if (!doc || !doc.acs.length || !b.acs.length) continue;
        const lech = b.acs.filter((ac) => !doc.acs.includes(ac));
        if (lech.length) {
          findings.push({
            kind: 'ac-lech-giua-tai-lieu-va-spec',
            severity: 'major',
            id: tc,
            detail: `${s2.file}: ${tc} ghi ${b.acs.join(',')} nhưng tài liệu khai ${doc.acs.join(',')}`,
          });
        }
      }
    }
  }
  return findings;
}

module.exports = { lintDocFindings, specFindings };
