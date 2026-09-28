const { chromium } = require('playwright');

const VIEWPORTS = [
  { name: '1920x1080 (Wide)', width: 1920, height: 1080 },
  { name: '1440x900 (Laptop)', width: 1440, height: 900 },
  { name: '1280x800 (Compact)', width: 1280, height: 800 },
  { name: '390x844 (Mobile)', width: 390, height: 844 },
];

const THEMES = ['dark', 'light'];

async function runAudit() {
  console.log('Starting AI UI/UX Audit on http://127.0.0.1:4180 ...');
  const browser = await chromium.launch({ headless: true });
  const results = [];
  let totalErrors = 0;

  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      const label = vp.name + ' | Theme: ' + theme;
      const consoleErrors = [];
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
      });
      const page = await context.newPage();

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          const text = msg.text();
          if (!text.includes('favicon.ico')) {
            consoleErrors.push(text);
          }
        }
      });

      page.on('pageerror', (err) => {
        consoleErrors.push(err.message);
      });

      try {
        await page.goto('http://127.0.0.1:4180', { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(1000);

        if (theme === 'light') {
          await page.evaluate(() => {
            document.documentElement.setAttribute('data-theme', 'light');
            document.body.classList.remove('dark');
            document.body.classList.add('light');
          });
        } else {
          await page.evaluate(() => {
            document.documentElement.setAttribute('data-theme', 'dark');
            document.body.classList.remove('light');
            document.body.classList.add('dark');
          });
        }
        await page.waitForTimeout(300);

        const hasOverflow = await page.evaluate(() => {
          return document.documentElement.scrollWidth > window.innerWidth + 2;
        });

        const pillChecks = await page.evaluate(() => {
          const pill = document.querySelector('#agent-quota-pill');
          if (!pill) return { found: false };
          return {
            found: true,
            hasRoleStatus: pill.getAttribute('role') === 'status',
            dataView: pill.getAttribute('data-view'),
            title: pill.getAttribute('title') || '',
            liveRegionPresent: Boolean(pill.querySelector('[aria-live="polite"]')),
          };
        });

        let navSuccess = false;
        if (pillChecks.found) {
          await page.click('#agent-quota-pill');
          await page.waitForTimeout(400);
          navSuccess = await page.evaluate(() => {
            const agentView = document.querySelector('#agent-view');
            return agentView && !agentView.hidden && agentView.classList.contains('active');
          });
        }

        const pass = !hasOverflow && !pillChecks.hasRoleStatus && navSuccess && consoleErrors.length === 0;
        if (!pass) totalErrors++;

        console.log('[' + (pass ? 'PASS' : 'FAIL') + '] ' + label + ' | Overflow: ' + hasOverflow + ' | Pill a11y: ' + (!pillChecks.hasRoleStatus) + ' | Nav: ' + navSuccess + ' | Errors: ' + consoleErrors.length);
      } catch (err) {
        totalErrors++;
        console.error('[ERROR] ' + label + ': ' + err.message);
      } finally {
        await context.close();
      }
    }
  }

  await browser.close();
  console.log('\nAudit finished with ' + totalErrors + ' failures.');
  process.exit(totalErrors > 0 ? 1 : 0);
}

runAudit();
