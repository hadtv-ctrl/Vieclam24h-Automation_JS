const { asString, asInteger } = require('./utils');
const { DEFAULT_CONFIG } = require('./constants');

function normalizeSuites(sourceSuites, existingSuites) {
  const suitesInput = sourceSuites && typeof sourceSuites === 'object' ? sourceSuites : (existingSuites || DEFAULT_CONFIG.suites);
  const suites = {};
  
  for (const [key, value] of Object.entries(suitesInput)) {

    if (typeof value === 'object' && value !== null) {
      const suiteKey = key.slice(0, 50);
      const isComposite = value.type === 'composite' || (Array.isArray(value.suites) && value.suites.length > 0);
      const isMulti = !isComposite && (value.type === 'multi-platform' || (value.platforms && typeof value.platforms === 'object'));

      if (isComposite) {
        const childSuites = Array.isArray(value.suites)
          ? value.suites.map((s) => asString(s, '')).filter(Boolean)
          : [];

        suites[suiteKey] = {
          label: asString(value.label, key).slice(0, 50),
          description: asString(value.description, '').slice(0, 200),
          type: 'composite',
          suites: childSuites,
          workers: asInteger(value.workers, 2, 1, 8),
        };
        continue;
      }
      
      let platforms = null;
      if (value.platforms && typeof value.platforms === 'object') {
        platforms = {};
        for (const [pKey, pVal] of Object.entries(value.platforms)) {
          if (typeof pVal === 'object' && pVal !== null) {
            let pSpecs = [];
            if (Array.isArray(pVal.specs)) {
              pSpecs = pVal.specs.map((s) => asString(s, '')).filter(Boolean);
            } else if (typeof pVal.spec === 'string' && pVal.spec && pVal.spec !== 'all') {
              pSpecs = [pVal.spec.trim()];
            }

            const pVpInput = pVal.viewport && typeof pVal.viewport === 'object' ? pVal.viewport : {};
            const pDefaultVp = pKey === 'mobile' ? { preset: '390x844', width: 390, height: 844 } : { preset: '1920x1080', width: 1920, height: 1080 };
            platforms[pKey] = {
              enabled: pVal.enabled !== false,
              label: asString(pVal.label, pKey === 'mobile' ? 'Mobile Web' : 'Desktop Web').slice(0, 50),
              project: asString(pVal.project, pKey === 'mobile' ? 'Pixel 7' : 'Desktop Chrome').slice(0, 100),
              device: asString(pVal.device, pKey === 'mobile' ? 'Pixel 7' : '').slice(0, 100),
              viewport: {
                preset: asString(pVpInput.preset || pVal.viewportPreset, pDefaultVp.preset),
                width: asInteger(pVpInput.width || pVal.viewportWidth, pDefaultVp.width, 320, 7680),
                height: asInteger(pVpInput.height || pVal.viewportHeight, pDefaultVp.height, 320, 4320),
              },
              spec: pSpecs.length === 1 ? pSpecs[0] : (pSpecs.length > 1 ? 'custom' : 'all'),
              specs: pSpecs.length > 0 ? pSpecs : 'all',
              grep: asString(pVal.grep, '').slice(0, 80),
              workers: asInteger(pVal.workers, 2, 1, 8),
            };
          }
        }
      }

      let specs = [];
      if (Array.isArray(value.specs)) {
        specs = value.specs.map((s) => asString(s, '')).filter(Boolean);
      } else if (typeof value.spec === 'string' && value.spec && value.spec !== 'all') {
        specs = [value.spec.trim()];
      }

      const vpInput = value.viewport && typeof value.viewport === 'object' ? value.viewport : {};
      const vpPreset = asString(vpInput.preset || value.viewportPreset, 'default');
      const vpWidth = asInteger(vpInput.width || value.viewportWidth, 1920, 320, 7680);
      const vpHeight = asInteger(vpInput.height || value.viewportHeight, 1080, 320, 4320);
      const viewport = {
        preset: vpPreset,
        width: vpWidth,
        height: vpHeight,
      };

      const platformVal = asString(value.platform, '').toLowerCase();
      let detectedPlatform = platformVal;
      if (!detectedPlatform) {
        const isMobileProj = asString(value.project, '').toLowerCase().includes('mobile');
        detectedPlatform = isMobileProj ? 'mobile' : 'desktop';
      }

      suites[suiteKey] = {
        label: asString(value.label, key).slice(0, 50),
        description: asString(value.description, '').slice(0, 200),
        type: isMulti ? 'multi-platform' : 'single',
        platform: detectedPlatform,
        project: asString(value.project, 'all').slice(0, 100),
        device: asString(value.device, '').slice(0, 100),
        viewport,
        spec: specs.length === 1 ? specs[0] : (specs.length > 1 ? 'custom' : 'all'),
        specs: specs.length > 0 ? specs : 'all',
        grep: asString(value.grep, '').slice(0, 80),
        workers: asInteger(value.workers, 2, 1, 8),
      };

      if (platforms) {
        suites[suiteKey].platforms = platforms;
      }
    }
  }

  // Đường dẫn QA phải là tương đối và nằm trong repo: chặn '..' và đường dẫn tuyệt đối,
  // vì giá trị này được dùng để quét thư mục.
  
  return suites;
}

module.exports = { normalizeSuites };
