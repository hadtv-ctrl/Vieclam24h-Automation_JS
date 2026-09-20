const fs = require('fs');
const path = require('path');
const { sanitizeToIdentifier } = require('./namingUtils');

/**
 * Sinh draft Page Object va draft BDD Spec theo quy chuan AI_PROMPTS.md
 */
function transformToPomAndSpec({
  platform = 'desktop',
  actions = [],
  isNewPage = true,
  pageClassName = 'CustomPage',
  baseClass = 'BasePage',
  existingPagePath = '',
  existingContent = '',
  methodName = 'performRecordedActions',
  featureName = 'Recorded Feature',
  testName = 'Thuc hien kich ban thao tac da ghi',
  includeEvidence = true,
  url = '',
}) {
  const cleanClassName = sanitizeToIdentifier(pageClassName, true) || 'CustomPage';
  const finalClassName = (cleanClassName.endsWith('Page') || cleanClassName.endsWith('Popup'))
    ? cleanClassName
    : `${cleanClassName}Page`;

  const cleanMethodName = sanitizeToIdentifier(methodName) || 'performRecordedActions';
  const cleanFeatureName = featureName.trim() || 'Recorded Feature';
  const cleanTestName = testName.trim() || 'Thuc hien kich ban thao tac da ghi';

  // 1. Thu thap locators duy nhat
  const locatorMap = new Map();
  const collectedWarnings = [];
  let hasAssertions = false;

  actions.forEach((act) => {
    if (act.locator && act.locatorVar) {
      if (!locatorMap.has(act.locatorVar)) {
        locatorMap.set(act.locatorVar, act.locator.replace(/^page\./, ''));
      }
    }
    if (act.type === 'assertion') {
      hasAssertions = true;
    }
    if (act.warnings && act.warnings.length > 0) {
      act.warnings.forEach((w) => {
        const warnText = `[${act.type.toUpperCase()}] ${act.summary}: ${w}`;
        if (!collectedWarnings.includes(warnText)) collectedWarnings.push(warnText);
      });
    }
  });

  // 2. Tao than ham Page Object method
  const methodLines = [];
  actions.forEach((act) => {
    if (act.type === 'goto') {
      methodLines.push(`    await this.navigate('${act.url}');`);
      if (includeEvidence) {
        methodLines.push(`    await this.capture('${sanitizeToIdentifier(finalClassName).toLowerCase()}_page_loaded');`);
      }
    } else if (act.type === 'click') {
      methodLines.push(`    await this.actions.click(this.${act.locatorVar});`);
    } else if (act.type === 'fill') {
      methodLines.push(`    await this.actions.fill(this.${act.locatorVar}, '${act.value || ''}');`);
    } else if (act.type === 'select') {
      methodLines.push(`    await this.${act.locatorVar}.selectOption('${act.value || ''}');`);
    } else if (act.type === 'check') {
      methodLines.push(`    await this.${act.locatorVar}.check();`);
    } else if (act.type === 'uncheck') {
      methodLines.push(`    await this.${act.locatorVar}.uncheck();`);
    } else if (act.type === 'assertion') {
      const target = act.locatorVar ? `this.${act.locatorVar}` : 'this.page';
      const aType = act.assertionType || 'toBeVisible';
      const val = act.expectedVal ? `'${act.expectedVal}'` : '';
      if (aType === 'toHaveURL') {
        methodLines.push(`    await expect(this.page).toHaveURL(/${act.expectedVal || ''}/);`);
      } else if (val) {
        methodLines.push(`    await expect(${target}).${aType}(${val});`);
      } else {
        methodLines.push(`    await expect(${target}).${aType}();`);
      }
    }
  });

  if (includeEvidence && methodLines.length > 0) {
    methodLines.push(`    await this.capture('${sanitizeToIdentifier(cleanMethodName).toLowerCase()}_completed');`);
  }

  const methodCode = `  async ${cleanMethodName}() {\n${methodLines.join('\n')}\n  }`;

  // 3. Dung ma Page Object
  let pomCode = '';
  let pomRelativePath = existingPagePath || `pages/${platform}/${finalClassName}.js`;

  const expectImport = hasAssertions ? 'const { expect } = require("@playwright/test");\n' : '';

  if (isNewPage || !existingContent) {
    const locatorsCode = Array.from(locatorMap.entries())
      .map(([name, expr]) => `    this.${name} = page.${expr};`)
      .join('\n');

    pomCode = `${expectImport}const { ${baseClass} } = require('../${baseClass}');

class ${finalClassName} extends ${baseClass} {
  /**
   * @param {import('@playwright/test').Page} page
   * @param {string} [featureName]
   */
  constructor(page, featureName) {
    super(page, featureName);

${locatorsCode ? locatorsCode : '    // Khoi tao cac locators'}
  }

${methodCode}
}

module.exports = { ${finalClassName} };
`;
  } else {
    // Bo sung vao class hien co
    let updatedContent = existingContent;
    if (hasAssertions && !updatedContent.includes('expect')) {
      updatedContent = `${expectImport}${updatedContent}`;
    }
    
    // Them locator con thieu vao constructor
    const missingLocators = [];
    locatorMap.forEach((expr, name) => {
      const checkRegex = new RegExp(`this\\.${name}\\s*=`);
      if (!checkRegex.test(updatedContent)) {
        missingLocators.push(`    this.${name} = page.${expr};`);
      }
    });

    if (missingLocators.length > 0) {
      const constructorMatch = updatedContent.match(/(super\([^)]*\);)/);
      if (constructorMatch) {
        updatedContent = updatedContent.replace(
          constructorMatch[1],
          `${constructorMatch[1]}\n${missingLocators.join('\n')}`
        );
      }
    }

    // Them method moi truoc dau dong ngoac cuoi
    const lastBraceIdx = updatedContent.lastIndexOf('}');
    if (lastBraceIdx !== -1) {
      updatedContent =
        updatedContent.slice(0, lastBraceIdx).trimEnd() +
        `\n\n${methodCode}\n}\n` +
        updatedContent.slice(lastBraceIdx + 1);
    }
    pomCode = updatedContent;
  }

  // 4. Dung ma Spec BDD
  const pageVar = finalClassName.charAt(0).toLowerCase() + finalClassName.slice(1);
  const specFileName = `${sanitizeToIdentifier(cleanFeatureName).toLowerCase() || 'recorded_flow'}-bdd.spec.js`;
  const specRelativePath = `tests/e2e/${platform}/${specFileName}`;

  const projectRoot = process.env.QA_PROJECT_ROOT || process.cwd();
  const hasLocalFixtures = fs.existsSync(path.join(projectRoot, 'core', 'fixtures', platform === 'mobile-web' ? 'mobileWebTest.js' : 'baseTest.js'));

  const fixtureImport = hasLocalFixtures
    ? (platform === 'mobile-web'
        ? "const { test } = require('../../../core/fixtures/mobileWebTest');"
        : "const { test } = require('../../../core/fixtures/baseTest');")
    : "const { test, expect } = require('@playwright/test');";

  const specCode = `${fixtureImport}
const { ${finalClassName} } = require('../../../pages/${platform}/${finalClassName}');

test.describe('Feature: ${cleanFeatureName} @record @e2e', () => {

  test('${cleanTestName}', async ({ page }, testInfo) => {
    const ${pageVar} = new ${finalClassName}(page, '${sanitizeToIdentifier(cleanFeatureName).toLowerCase()}');

    // Khai báo Precondition hiển thị trên header của Playwright Report
    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Khách vãng lai truy cập màn hình kiểm thử (Chưa đăng nhập)',
    });

    await test.step('Given Tiền điều kiện: Người dùng truy cập và chuẩn bị trang kiểm thử', async () => {
${url ? `      await ${pageVar}.navigate('${url}');\n` : '      // Trạng thái xuất phát đã sẵn sàng.\n'}    });

    await test.step('When Người dùng thực hiện các thao tác đã ghi', async () => {
      await ${pageVar}.${cleanMethodName}();
    });

    await test.step('Then Kiểm tra trạng thái hoàn tất thành công', async () => {
      // Các assertion đã được tổng hợp trong Page Object hoặc bổ sung thêm tại đây
    });
  });

});
`;

  return {
    pomDraft: {
      relativePath: pomRelativePath,
      content: pomCode,
      isNewFile: isNewPage || !existingContent,
    },
    specDraft: {
      relativePath: specRelativePath,
      content: specCode,
    },
    warnings: collectedWarnings,
  };
}

module.exports = {
  transformToPomAndSpec,
};
