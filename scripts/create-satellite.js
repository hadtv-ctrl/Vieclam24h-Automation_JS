#!/usr/bin/env node
'use strict';

/**
 * scripts/create-satellite.js
 * Tự động hóa 1-Click tạo mới một dự án vệ tinh từ Hub Automation.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

const HUB_ROOT = path.resolve(__dirname, '..');
const { syncToDirectory } = require('./sync-satellites');
const { registerInManifest } = require('./lib/satelliteManifestHelper');
const { generateStarterFiles, slugify } = require('./lib/satelliteStarterTemplates');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    name: '',
    path: '',
    url: 'https://example.com',
    title: '',
    repo: '',
    port: 'auto',
    dryRun: false,
    interactive: false,
  };

  for (const arg of args) {
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg.startsWith('--name=')) options.name = arg.slice(7).trim();
    else if (arg.startsWith('--path=')) options.path = arg.slice(7).trim();
    else if (arg.startsWith('--url=')) options.url = arg.slice(6).trim();
    else if (arg.startsWith('--title=')) options.title = arg.slice(8).trim();
    else if (arg.startsWith('--repo=')) options.repo = arg.slice(7).trim();
    else if (arg.startsWith('--port=')) options.port = arg.slice(7).trim();
  }

  if (!options.name || !options.path) {
    options.interactive = true;
  }
  return options;
}

function promptQuestion(rl, query, defaultValue = '') {
  return new Promise((resolve) => {
    const hint = defaultValue ? ` [Mặc định: ${colors.dim}${defaultValue}${colors.reset}]: ` : ': ';
    rl.question(`${query}${hint}`, (answer) => resolve(answer.trim() || defaultValue));
  });
}

async function collectInteractiveOptions(options) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    options.name = await promptQuestion(rl, '👉 Tên dự án vệ tinh (vd: Automation_MyApp)');
    if (!options.name) throw new Error('Tên dự án không được để trống!');
    const defaultDir = path.resolve(HUB_ROOT, '..', options.name);
    options.path = await promptQuestion(rl, '👉 Đường dẫn thư mục lưu trữ', defaultDir);
    options.url = await promptQuestion(rl, '👉 Base URL môi trường QC', 'https://example.com');
    options.port = await promptQuestion(rl, '👉 Port Dashboard (auto hoặc 4180-4999)', 'auto');
    options.title = await promptQuestion(rl, '👉 Tiêu đề hiển thị trên Dashboard', `${options.name.replace(/[_-]/g, ' ')} Studio`);
    options.repo = await promptQuestion(rl, '👉 Tên GitHub repo (tùy chọn)', `hadinhkms/${options.name}`);
  } finally {
    rl.close();
  }
}

async function main() {
  console.log(`\n${colors.cyan}${colors.bright}=====================================================${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright}   🚀 TẠO DỰ ÁN VỆ TINH AUTOMATION (ONE-CLICK SETUP)  ${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright}=====================================================${colors.reset}\n`);

  const options = parseArgs();
  if (options.interactive) await collectInteractiveOptions(options);

  const targetDir = path.resolve(options.path);
  console.log(`📋 ${colors.bright}Thông số khởi tạo:${colors.reset}`);
  console.log(`   - Tên vệ tinh  : ${colors.green}${options.name}${colors.reset}`);
  console.log(`   - Thư mục đích : ${colors.yellow}${targetDir}${colors.reset}`);
  console.log(`   - Base URL QC  : ${colors.cyan}${options.url}${colors.reset}`);
  console.log(`   - Cổng Port    : ${colors.yellow}${options.port}${colors.reset}`);

  if (options.dryRun) {
    console.log(`\n${colors.yellow}🔍 Dry-Run: Đã kiểm tra thông số hợp lệ, không ghi dữ liệu ra đĩa.${colors.reset}`);
    return;
  }

  // 1. Tạo cây thư mục dự án
  console.log(`\n⏳ [1/5] Đang tạo cây thư mục nghiệp vụ chuẩn POM...`);
  const dirs = ['pages/desktop', 'tests/e2e/desktop', 'tests/api', 'data', 'requirements', 'test-cases', 'core/local', 'core/config'];
  for (const dir of dirs) fs.mkdirSync(path.join(targetDir, dir), { recursive: true });

  // 2. Tạo các starter file nghiệp vụ
  console.log(`⏳ [2/5] Đang tạo các file starter (package.json, config, Page Objects, specs)...`);
  generateStarterFiles(targetDir, options);

  // 3. Đăng ký vào sync-manifest của Hub
  console.log(`⏳ [3/5] Đang đăng ký vệ tinh vào Hub Manifest...`);
  const regOk = registerInManifest(options.name, targetDir, options.repo, HUB_ROOT);
  console.log(regOk ? `   ${colors.green}✓${colors.reset} Đã ghi danh vào RAW_SATELLITES.` : `   ${colors.dim}i Vệ tinh đã có trong manifest.${colors.reset}`);

  // 4. Đồng bộ Framework từ Hub sang Vệ Tinh
  console.log(`⏳ [4/5] Đang đồng bộ Framework (Dashboard, Core, Scripts, Tools, Agent Rules)...`);
  const copiedCount = syncToDirectory(targetDir);
  console.log(`   ${colors.green}✓${colors.reset} Đã đồng bộ thành công ${copiedCount} files.`);

  // 5. Khởi tạo Git nếu chưa có
  console.log(`⏳ [5/5] Kiểm tra khởi tạo Git Repository...`);
  if (!fs.existsSync(path.join(targetDir, '.git'))) {
    try { execSync('git init', { cwd: targetDir, stdio: 'ignore' }); console.log(`   ${colors.green}✓${colors.reset} Đã khởi tạo Git repository.`); }
    catch (_) { console.log(`   ${colors.dim}i Không thể tự động chạy git init.${colors.reset}`); }
  }

  console.log(`\n${colors.green}${colors.bright}=====================================================${colors.reset}`);
  console.log(`${colors.green}${colors.bright}  🎉 HOÀN TẤT TẠO VỆ TINH MỚI THÀNH CÔNG RỰC RỠ!     ${colors.reset}`);
  console.log(`${colors.green}${colors.bright}=====================================================${colors.reset}\n`);
  console.log(`👉 Chạy dự án mới: cd "${targetDir}" && npm install && Start_Dashboard.bat\n`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`\n${colors.red}❌ Lỗi: ${err.message}${colors.reset}`);
    process.exit(1);
  });
}

module.exports = { parseArgs, slugify, registerInManifest, generateStarterFiles };
