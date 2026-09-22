/**
 * evidenceInjector.js
 * 
 * Bộ máy phân tích tĩnh (Static Analysis Engine) tự động chèn các mốc capture evidence
 * chuẩn theo quy tắc Section 7 trong AI_PROMPTS.md:
 * - Chụp sau khi mở trang / điều hướng xong (Entry Milestone)
 * - Chụp sau khi điền xong một form dữ liệu (Form Filled Milestone)
 * - Chụp sau thao tác Submit / Lưu làm thay đổi trạng thái UI (Action Mutated)
 * - Chụp sau bước kiểm tra / assertion then chốt (Verification Pass)
 * 
 * Logic chống trùng lặp (Anti-Duplicate):
 * - Không chèn 2 capture kề nhau nếu giữa chúng không có action làm đổi UI.
 * - Sau một loạt các fill liên tiếp (fillName, fillPhone, fillPassword...), chỉ chụp 1 lần ở cuối form.
 * - Tự động phân định fullPage: false khi có popup/modal, true khi là trang toàn cảnh.
 * - Không lặp lại cùng một tên ảnh trong kịch bản.
 */

/**
 * Danh sách các pattern hành động cần bắt
 */
const ACTION_PATTERNS = {
  NAVIGATE: /\.(?:navigate|goto|open\w*)\s*\(/i,
  FILL: /\.(?:fill\w*|input\w*|set\w*)\s*\(/i,
  SUBMIT: /\.(?:submit\w*|clickContinue|clickLogin|clickRegister|clickSave|clickSubmit|save\w*|confirm\w*)\s*\(/i,
  ASSERT: /\.(?:expect\w+Visible|expect\w+Hidden|expect\w+Success)\s*\(/i,
  POPUP_ACTION: /\b(?:modal|dialog|popup|drawer|otp)\b/i,
};

/**
 * Chuẩn hóa tên slug thành chuỗi an toàn cho file ảnh
 */
function toSafeSlug(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .trim();
}

/**
 * Sinh tên ảnh có ý nghĩa từ ngữ cảnh bước và hành động
 */
function generateSemanticCaptureName(stepTitle, actionLine, actionType, existingNames) {
  let baseName = '';

  // 1. Phân tích hành động từ actionLine
  const methodMatch = actionLine.match(/\.([a-zA-Z0-9_]+)\s*\(/);
  const methodName = methodMatch ? methodMatch[1] : '';

  if (actionType === 'NAVIGATE') {
    if (methodName.includes('navigate') || methodName.includes('goto')) baseName = 'page_loaded';
    else baseName = `${toSafeSlug(methodName)}_opened`;
  } else if (actionType === 'FILL') {
    if (methodName.includes('Email')) baseName = 'email_input_filled';
    else if (methodName.includes('Password')) baseName = 'password_input_filled';
    else if (methodName.includes('Phone')) baseName = 'phone_input_filled';
    else baseName = `${toSafeSlug(methodName)}_filled`;
  } else if (actionType === 'SUBMIT') {
    if (methodName.includes('submit')) baseName = `${toSafeSlug(methodName)}_submitted`;
    else if (methodName.includes('Continue')) baseName = 'continue_clicked';
    else baseName = `${toSafeSlug(methodName)}_completed`;
  } else if (actionType === 'ASSERT') {
    if (methodName.includes('Visible')) baseName = `${toSafeSlug(methodName.replace(/^expect/, ''))}_visible`;
    else baseName = `${toSafeSlug(methodName)}_verified`;
  }

  // Fallback từ stepTitle nếu baseName quá ngắn
  if (!baseName || baseName.length < 4) {
    const cleanTitle = stepTitle.replace(/^(?:Given|When|Then|And)\s+/i, '');
    baseName = toSafeSlug(cleanTitle).slice(0, 32);
  }

  // Đảm bảo không trùng lặp tên trong cùng 1 script
  let uniqueName = baseName;
  let counter = 2;
  while (existingNames.has(uniqueName)) {
    uniqueName = `${baseName}_${counter}`;
    counter++;
  }
  existingNames.add(uniqueName);
  return uniqueName;
}

/**
 * Tự động phân tích và chèn các lệnh capture evidence vào kịch bản Playwright
 * @param {string} specCode - Mã nguồn file .spec.js
 * @param {Object} options - Tùy chọn cấu hình
 * @returns {Object} { modifiedCode, addedCount, removedCount, injectedPoints: [] }
 */
function injectSmartEvidenceCaptures(specCode, options = {}) {
  if (!specCode || typeof specCode !== 'string') {
    return { modifiedCode: specCode, addedCount: 0, removedCount: 0, injectedPoints: [] };
  }

  let addedCount = 0;
  let removedCount = 0;
  const injectedPoints = [];
  const existingCaptureNames = new Set();

  // Thu thập các tên capture đã có sẵn trong file
  const existingCaptureRegex = /\.capture\(\s*['"`]([^'"`]+)['"`]/g;
  let exMatch;
  while ((exMatch = existingCaptureRegex.exec(specCode)) !== null) {
    existingCaptureNames.add(exMatch[1]);
  }

  // Bóc tách biến Page Objects khả dụng từ signature của test(...)
  const knownPageVars = new Set();
  const testArgsMatch = specCode.match(/test\([^,]+,\s*async\s*\(\s*\{([^}]*)\}\s*\)/);
  if (testArgsMatch) {
    testArgsMatch[1].split(',').forEach((arg) => {
      const v = arg.trim();
      if (v && !['page', 'test', 'expect', 'authenticatedUser', 'request', 'context'].includes(v)) {
        knownPageVars.add(v);
      }
    });
  }

  // Nhận diện các biến dynamic như detailsPage = createDetailsPage(newPage)
  const dynPageRegex = /(\b[a-zA-Z0-9_]+Page\b)\s*=\s*(?:create\w+|new\s+\w+)/g;
  let dynMatch;
  while ((dynMatch = dynPageRegex.exec(specCode)) !== null) {
    knownPageVars.add(dynMatch[1]);
  }

  // Phân tách từng test.step()
  const stepBlockRegex = /(await\s+test\.step\(\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`)\s*,\s*async\s*\(\s*\)\s*=>\s*\{)([\s\S]*?)(\n\s*\}\s*\);)/g;

  const modifiedCode = specCode.replace(stepBlockRegex, (fullMatch, stepHeader, t1, t2, t3, stepBody, stepFooter) => {
    const stepTitle = (t1 || t2 || t3 || '').trim();
    const lines = stepBody.split('\n');
    const newLines = [];

    // Tìm Page Object đang hoạt động trong step này
    let currentStepPageVar = null;
    for (const v of knownPageVars) {
      if (new RegExp(`\\b${v}\\.`).test(stepBody) || new RegExp(`\\b${v}\\s*=`).test(stepBody)) {
        currentStepPageVar = v;
        break;
      }
    }

    // Nếu không tìm thấy, fallback về page object đầu tiên được gọi
    if (!currentStepPageVar) {
      const anyCallMatch = stepBody.match(/\b([a-zA-Z0-9_]+Page|[a-zA-Z0-9_]+Popup)\./);
      if (anyCallMatch) {
        currentStepPageVar = anyCallMatch[1];
      }
    }

    let hasCaptureAfterAction = false;
    let pendingFillCapture = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Cập nhật page object nếu có gán mới trong dòng
      for (const v of knownPageVars) {
        if (new RegExp(`\\b${v}\\s*=`).test(line)) {
          currentStepPageVar = v;
        }
      }

      // Kiểm tra nếu dòng hiện tại là lệnh capture
      const isCaptureLine = /\.capture\(\s*['"`]/.test(line);

      // QUY TẮC CHỐNG TRÙNG LẶP: Nếu dòng trước đã có capture và dòng này lại có capture mà không có action giữa chúng -> bỏ dòng thừa
      if (isCaptureLine) {
        if (hasCaptureAfterAction) {
          // Bỏ qua dòng capture trùng lặp kề nhau
          removedCount++;
          continue;
        }
        hasCaptureAfterAction = true;
        pendingFillCapture = null;
        newLines.push(line);
        continue;
      }

      // Nhận diện action
      const isNav = ACTION_PATTERNS.NAVIGATE.test(line);
      const isFill = ACTION_PATTERNS.FILL.test(line);
      const isSubmit = ACTION_PATTERNS.SUBMIT.test(line);
      const isAssert = ACTION_PATTERNS.ASSERT.test(line);

      const isMutatingAction = isNav || isFill || isSubmit || isAssert;

      if (isMutatingAction) {
        hasCaptureAfterAction = false;
      }

      newLines.push(line);

      // Nếu đang trong nhóm fill liên tiếp, gom lại để chỉ chụp sau fill cuối cùng
      if (isFill) {
        const indentMatch = line.match(/^(\s*)/);
        const indent = indentMatch ? indentMatch[1] : '      ';
        const isPopup = ACTION_PATTERNS.POPUP_ACTION.test(stepTitle) || ACTION_PATTERNS.POPUP_ACTION.test(line);
        const fullPage = !isPopup;
        
        pendingFillCapture = {
          lineIdx: newLines.length,
          indent,
          pageVar: currentStepPageVar || 'homePage',
          stepTitle,
          actionLine: line,
          actionType: 'FILL',
          fullPage,
        };
      } else if (pendingFillCapture && !isFill) {
        // Đã kết thúc chuỗi fill, chèn capture cho nhóm form vừa điền
        const p = pendingFillCapture;
        const captureName = generateSemanticCaptureName(p.stepTitle, p.actionLine, p.actionType, existingCaptureNames);
        const captureStmt = `${p.indent}await ${p.pageVar}.capture('${captureName}'${p.fullPage ? ', true' : ''});`;
        
        // Chèn vào vị trí ngay sau action fill cuối cùng
        newLines.splice(newLines.length - 1, 0, captureStmt);
        addedCount++;
        hasCaptureAfterAction = true;
        injectedPoints.push({ name: captureName, step: stepTitle, reason: 'Form filled' });
        pendingFillCapture = null;
      }

      // Xử lý các action khác: NAVIGATE, SUBMIT, ASSERT
      if (isNav || isSubmit || isAssert) {
        // Kiểm tra xem dòng kế tiếp (hoặc sau khi gán biến page) có phải là capture sẵn chưa
        let nextHasCapture = false;
        for (let j = i + 1; j < lines.length; j++) {
          const nextTrimmed = lines[j].trim();
          if (!nextTrimmed || nextTrimmed.startsWith('//')) continue;
          // Bỏ qua dòng gán biến Page Object như: detailsPage = createDetailsPage(...)
          if (/^(?:let|const|var\s+)?[a-zA-Z0-9_]+\s*=\s*/.test(nextTrimmed)) continue;
          if (/\.capture\(\s*['"`]/.test(nextTrimmed)) {
            nextHasCapture = true;
          }
          break;
        }

        if (!nextHasCapture && currentStepPageVar) {
          const indentMatch = line.match(/^(\s*)/);
          const indent = indentMatch ? indentMatch[1] : '      ';
          const isPopup = ACTION_PATTERNS.POPUP_ACTION.test(stepTitle) || ACTION_PATTERNS.POPUP_ACTION.test(line);
          const fullPage = (isNav || isAssert) && !isPopup;
          const actionType = isNav ? 'NAVIGATE' : isSubmit ? 'SUBMIT' : 'ASSERT';
          
          const captureName = generateSemanticCaptureName(stepTitle, line, actionType, existingCaptureNames);
          const captureStmt = `${indent}await ${currentStepPageVar}.capture('${captureName}'${fullPage ? ', true' : ''});`;
          newLines.push(captureStmt);
          addedCount++;
          hasCaptureAfterAction = true;
          injectedPoints.push({ name: captureName, step: stepTitle, reason: `${actionType} completed` });
        }
      }
    }

    // Nếu cuối step vẫn còn pending fill capture chưa chèn
    if (pendingFillCapture && !hasCaptureAfterAction) {
      const p = pendingFillCapture;
      const captureName = generateSemanticCaptureName(p.stepTitle, p.actionLine, p.actionType, existingCaptureNames);
      const captureStmt = `${p.indent}await ${p.pageVar}.capture('${captureName}'${p.fullPage ? ', true' : ''});`;
      newLines.push(captureStmt);
      addedCount++;
      injectedPoints.push({ name: captureName, step: stepTitle, reason: 'Form filled' });
    }

    return `${stepHeader}${newLines.join('\n')}${stepFooter}`;
  });

  return {
    modifiedCode,
    addedCount,
    removedCount,
    injectedPoints,
    alreadyOptimal: addedCount === 0 && removedCount === 0,
  };
}

module.exports = {
  injectSmartEvidenceCaptures,
  generateSemanticCaptureName,
  toSafeSlug,
};
