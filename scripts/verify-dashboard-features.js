#!/usr/bin/env node
// master-process-disable-size-check: Legacy module, queued for modular decomposition
'use strict';

/**
 * KIỂM CHỨNG TÍNH NĂNG DASHBOARD CÓ MẶT ĐẦY ĐỦ TRONG MỘT REPO — CHỈ ĐỌC.
 *
 * Đếm số file đã copy KHÔNG chứng minh được tính năng chạy được ở vệ tinh. Một view của
 * dashboard chỉ sống khi đủ 5 mảnh nối với nhau, mỗi mảnh nằm một file khác nhau:
 *
 *   1. slice ESM            dashboard/public/js/views/<x>/<x>Slice.js
 *   2. đăng ký trong registry   dashboard/public/js/main.js
 *   3. khung <section>      dashboard/public/index.html
 *   4. template + ánh xạ    dashboard/public/templates/<t>.html + templateLoader._viewMap
 *   5. stylesheet           dashboard/public/styles/views/<x>.css  (@import trong styles.css)
 *
 * Thiếu một mảnh thì view hiện ra trắng hoặc không hiện — không có lỗi nào được ném ra.
 * Đúng kiểu hỏng âm thầm mà sync dễ gây ra nhất (một file lọt vào excludes, một wiring
 * bị quên). Backend cũng vậy: route có file nhưng không được server.js gọi thì API 404.
 *
 * Công cụ này đọc chính source để suy ra danh sách view, nên tính năng mới được kiểm tự
 * động mà không cần ai nhớ cập nhật danh sách ở đây.
 *
 * Cách dùng:
 *   node scripts/verify-dashboard-features.js                 # kiểm repo hiện tại
 *   node scripts/verify-dashboard-features.js --root=D:/path  # kiểm repo khác (vd. vệ tinh)
 *   node scripts/verify-dashboard-features.js --json
 */

const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\u001b[0m',
  bright: '\u001b[1m',
  green: '\u001b[32m',
  yellow: '\u001b[33m',
  red: '\u001b[31m',
  cyan: '\u001b[36m',
  dim: '\u001b[2m',
};

function read(root, rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full, 'utf8').replace(/^\uFEFF/, '');
}

function exists(root, rel) {
  return fs.existsSync(path.join(root, rel));
}

/** Tất cả `import { x } from './y.js'` trong main.js -> Map<tên biến, đường dẫn tương đối>. */
function parseImports(source) {
  const map = new Map();
  const re = /import\s*\{\s*([A-Za-z0-9_$]+)\s*\}\s*from\s*'(\.[^']+)'/g;
  let m = re.exec(source);
  while (m) {
    map.set(m[1], m[2]);
    m = re.exec(source);
  }
  return map;
}

/** Các mục `'x-view': { slice: xSlice, ... }` trong SLICE_REGISTRY. */
function parseRegistry(source) {
  const out = [];
  const re = /'([a-z][a-z0-9-]*-view)'\s*:\s*\{\s*slice\s*:\s*([A-Za-z0-9_$]+)/g;
  let m = re.exec(source);
  while (m) {
    out.push({ viewId: m[1], sliceVar: m[2] });
    m = re.exec(source);
  }
  return out;
}

/** Ánh xạ `'x-view': 'template'` bên trong khối this._viewMap = { ... }. */
function parseViewMap(source) {
  const start = source.indexOf('_viewMap');
  if (start === -1) return [];
  const open = source.indexOf('{', start);
  const close = source.indexOf('};', open);
  if (open === -1 || close === -1) return [];
  const block = source.slice(open, close);
  const out = [];
  const re = /'([a-z][a-z0-9-]*-view)'\s*:\s*'([a-z0-9-]+)'/g;
  let m = re.exec(block);
  while (m) {
    out.push({ viewId: m[1], template: m[2] });
    m = re.exec(block);
  }
  return out;
}

/**
 * `const { handleXRoutes, ... } = require('./routes/xRoutes');` trong server.js.
 * Phải chấp nhận danh sách destructuring nhiều tên — recorderRoutes và resourceRoutes
 * xuất kèm helper, nên mẫu "chỉ một tên" sẽ bỏ sót đúng hai nhóm route đó.
 */
function parseRouteRequires(source) {
  const out = [];
  const re = /\{([^}]*)\}\s*=\s*require\('(\.\/routes\/[^']+)'\)/g;
  let m = re.exec(source);
  while (m) {
    const names = m[1].split(',').map((s) => s.trim()).filter((s) => /^handle[A-Za-z0-9_$]*Routes$/.test(s));
    for (const handler of names) out.push({ handler, modulePath: m[2] });
    m = re.exec(source);
  }
  return out;
}

function parseStyleImports(source) {
  const out = [];
  const re = /@import\s+url\('\.\/(styles\/views\/[^']+)'\)/g;
  let m = re.exec(source);
  while (m) {
    out.push(m[1]);
    m = re.exec(source);
  }
  return out;
}

function verify(root) {
  const errors = [];
  const warnings = [];
  const views = [];

  const fail = (view, part, detail) => errors.push({ view, part, detail });

  const REQUIRED = {
    main: 'dashboard/public/js/main.js',
    index: 'dashboard/public/index.html',
    loader: 'dashboard/public/js/core/templateLoader.js',
    server: 'dashboard/server.js',
    styles: 'dashboard/public/styles.css',
  };

  const src = {};
  for (const [key, rel] of Object.entries(REQUIRED)) {
    src[key] = read(root, rel);
    if (src[key] === null) fail('(repo)', 'file nền tảng', `thiếu ${rel}`);
  }
  if (errors.length) return { root, views, errors, warnings };

  const imports = parseImports(src.main);
  const registry = parseRegistry(src.main);
  const viewMap = new Map(parseViewMap(src.loader).map((v) => [v.viewId, v.template]));
  const styleImports = new Set(parseStyleImports(src.styles));

  if (!registry.length) fail('(repo)', 'registry', 'không đọc được view nào trong SLICE_REGISTRY');

  for (const { viewId, sliceVar } of registry) {
    const parts = { slice: false, section: false, template: null, style: null };

    // 1 + 2. slice phải được import và file phải tồn tại
    const importPath = imports.get(sliceVar);
    if (!importPath) {
      fail(viewId, 'slice', `registry dùng '${sliceVar}' nhưng main.js không import biến này`);
    } else {
      const rel = path.posix.join('dashboard/public/js', importPath.replace(/^\.\//, ''));
      if (!exists(root, rel)) fail(viewId, 'slice', `thiếu file ${rel}`);
      else parts.slice = true;
    }

    // 3. khung <section> trong index.html
    if (!new RegExp(`id="${viewId}"`).test(src.index)) {
      fail(viewId, 'section', `index.html không có phần tử id="${viewId}"`);
    } else {
      parts.section = true;
    }

    // 4. template (chỉ những view có khai báo trong _viewMap mới cần)
    if (viewMap.has(viewId)) {
      const tpl = `dashboard/public/templates/${viewMap.get(viewId)}.html`;
      if (!exists(root, tpl)) fail(viewId, 'template', `_viewMap trỏ tới ${tpl} nhưng file không tồn tại`);
      else parts.template = viewMap.get(viewId);
    }

    // 5. stylesheet riêng của view (nếu có file thì bắt buộc phải được @import)
    const name = viewMap.get(viewId) || viewId.replace(/-view$/, '');
    const cssRel = `styles/views/${name}.css`;
    if (exists(root, path.posix.join('dashboard/public', cssRel))) {
      if (!styleImports.has(cssRel)) {
        fail(viewId, 'style', `có ${cssRel} nhưng styles.css không @import -> view mất toàn bộ định dạng`);
      } else {
        parts.style = cssRel;
      }
    }

    views.push({ viewId, sliceVar, parts });
  }

  // View khai báo template nhưng không nằm trong registry: template chết, không ai nạp.
  for (const [viewId, tpl] of viewMap) {
    if (!registry.some((r) => r.viewId === viewId)) {
      warnings.push(`_viewMap có '${viewId}' -> ${tpl}.html nhưng SLICE_REGISTRY không đăng ký view này`);
    }
  }

  // @import trỏ tới file không tồn tại: trình duyệt bỏ qua im lặng.
  for (const rel of styleImports) {
    if (!exists(root, path.posix.join('dashboard/public', rel))) {
      fail('(styles)', 'style', `styles.css @import '${rel}' nhưng file không tồn tại`);
    }
  }

  // Backend: route phải vừa có file, vừa được server.js gọi thật.
  const routes = parseRouteRequires(src.server);
  for (const { handler, modulePath } of routes) {
    const rel = path.posix.join('dashboard', modulePath.replace(/^\.\//, ''));
    const withExt = rel.endsWith('.js') ? rel : `${rel}.js`;
    if (!exists(root, withExt)) {
      fail('(routes)', 'route', `server.js require '${modulePath}' nhưng thiếu ${withExt}`);
      continue;
    }
    // Dòng require viết `handler }` hoặc `handler,` nên không bao giờ khớp `handler(`.
    const called = new RegExp(`${handler}\\s*\\(`).test(src.server);
    if (!called) fail('(routes)', 'route', `${handler} được require nhưng không bao giờ được gọi -> API trả 404`);
  }

  return { root, views, errors, warnings, routeCount: routes.length };
}

function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const rootArg = argv.find((a) => a.startsWith('--root='));
  const root = rootArg ? rootArg.slice('--root='.length) : path.resolve(__dirname, '..');

  const result = verify(root);

  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`${colors.cyan}${colors.bright}KIỂM CHỨNG TÍNH NĂNG DASHBOARD${colors.reset}`);
    console.log(`${colors.dim}Repo: ${root}${colors.reset}\n`);

    if (result.views.length) {
      const width = Math.max(8, ...result.views.map((v) => v.viewId.length));
      console.log(`   ${'VIEW'.padEnd(width)}  SLICE  SECTION  TEMPLATE  STYLE`);
      console.log(`   ${'-'.repeat(width)}  -----  -------  --------  -----`);
      for (const v of result.views) {
        const mark = (ok) => (ok ? ' ok  ' : ' --  ');
        console.log(`   ${v.viewId.padEnd(width)}  ${mark(v.parts.slice)}  ${mark(v.parts.section)}   `
          + `${(v.parts.template || '-').padEnd(8)}  ${v.parts.style ? 'ok' : '-'}`);
      }
    }

    for (const w of result.warnings) console.log(`\n${colors.yellow}⚠️  ${w}${colors.reset}`);

    console.log('');
    if (result.errors.length) {
      console.log(`${colors.red}${colors.bright}❌ ${result.errors.length} mảnh bị thiếu:${colors.reset}`);
      for (const e of result.errors) {
        console.log(`${colors.red}   [${e.view}] ${e.part}: ${e.detail}${colors.reset}`);
      }
    } else {
      console.log(`${colors.green}${colors.bright}✅ ${result.views.length} view đủ mảnh, `
        + `${result.routeCount} nhóm route được server gọi thật.${colors.reset}`);
    }
  }

  if (result.errors.length) process.exitCode = 1;
}

if (require.main === module) {
  main();
}

module.exports = { verify, parseImports, parseRegistry, parseViewMap, parseRouteRequires, parseStyleImports };
