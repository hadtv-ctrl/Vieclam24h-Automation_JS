/**
 * dashboard/routes/systemRoutes.js
 * Handles System Configuration, Health, Updater, Settings, Remote Run, and Discord Webhooks.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const {
  CONFIG_PATH, getDashboardConfig, publicDashboardConfig, saveDashboardConfig,
} = require('../../core/config/dashboardConfig');
const { checkForUpdates, applyUpdate, getCurrentVersion } = require('../../core/system/updater');
const { createRemoteRunService } = require('../../core/ci/remoteRunService');
const { listSpecs, listSpecDetails, specProjects, getPlaywrightProjects } = require('../services/specService');
const { createBackup } = require('../services/resourceService');
const { parseEnvFile, writeEnvFile } = require('./aiRoutes');
const { sendJson, parseBody } = require('./routeUtils');

const remoteRunConfig = { environments: {}, suites: {}, github: {} };
const remoteRunService = createRemoteRunService({ config: remoteRunConfig, allowProd: process.env.DASHBOARD_ALLOW_PROD_REMOTE === '1' });

async function sendDiscordWebhook(webhookUrl, payload) {
  if (!webhookUrl || typeof webhookUrl !== 'string') throw new Error('Discord Webhook URL không hợp lệ.');
  const parsedUrl = new URL(webhookUrl);
  if (parsedUrl.protocol !== 'https:' || !/(^|\.)discord(?:app)?\.com$/i.test(parsedUrl.hostname) || !parsedUrl.pathname.startsWith('/api/webhooks/')) {
    throw new Error('Discord Webhook URL không hợp lệ.');
  }
  const body = JSON.stringify(payload);
  return new Promise((resolve, reject) => {
    const req = https.request(parsedUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => res.statusCode >= 200 && res.statusCode < 300 ? resolve(data) : reject(new Error(`Discord HTTP ${res.statusCode}: ${data}`)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function handleSystemRoutes(request, response, url, context = {}) {
  const root = context.root || process.env.QA_PROJECT_ROOT || process.cwd();
  const engineDir = context.engineDir || path.resolve(__dirname, '../..');
  const appName = context.appName || 'qa-dashboard';
  const port = context.port || 4200;
  const discordBotDir = process.env.DISCORD_BOT_DIR ? path.resolve(process.env.DISCORD_BOT_DIR) : path.resolve(root, '../discord-qa-bot');
  const discordBotEnvPath = path.join(discordBotDir, '.env');

  if (request.method === 'GET' && url.pathname === '/api/config') {
    const settings = getDashboardConfig();
    const details = listSpecDetails(root);
    return sendJson(response, 200, {
      projects: getPlaywrightProjects(root),
      environments: Object.keys(settings.environments),
      specs: details.specs || listSpecs(path.join(root, 'tests'), root),
      specTags: details.specTags,
      availableTags: details.availableTags,
      specProjects: specProjects(root),
      defaults: { environment: settings.runtime.defaultEnvironment, workers: settings.runtime.workers },
      branding: publicDashboardConfig(settings).branding,
      suites: settings.suites || {},
    }) || true;
  }
  if (request.method === 'GET' && url.pathname === '/api/health') {
    return sendJson(response, 200, { appName, workspaceRoot: root, port, pid: process.pid }) || true;
  }
  if (request.method === 'GET' && url.pathname === '/api/system/version') {
    return sendJson(response, 200, {
      appName, version: getCurrentVersion(), workspaceRoot: root, engineDir, port, isEngineStandalone: root === engineDir,
    }) || true;
  }
  if (request.method === 'GET' && url.pathname === '/api/system/check-update') {
    try { sendJson(response, 200, await checkForUpdates()); } catch (e) { sendJson(response, 500, { ok: false, error: e.message }); }
    return true;
  }
  if (request.method === 'POST' && url.pathname === '/api/system/apply-update') {
    try { const r = applyUpdate(); sendJson(response, r.ok ? 200 : 400, r); } catch (e) { sendJson(response, 500, { ok: false, error: e.message }); }
    return true;
  }
  if (request.method === 'GET' && url.pathname === '/api/settings') {
    return sendJson(response, 200, publicDashboardConfig()) || true;
  }
  if (request.method === 'PUT' && url.pathname === '/api/settings') {
    try {
      const body = await parseBody(request);
      const backup = createBackup('core/config/dashboardConfig.json', CONFIG_PATH, root);
      const saved = saveDashboardConfig(body);
      sendJson(response, 200, { message: 'Đã lưu cấu hình.', backup, settings: publicDashboardConfig(saved) });
    } catch (e) { sendJson(response, 400, { error: `Không thể lưu cấu hình: ${e.message}` }); }
    return true;
  }
  if (request.method === 'POST' && url.pathname === '/api/remote-run') {
    try {
      const body = await parseBody(request);
      const env = parseEnvFile(discordBotEnvPath);
      const settings = getDashboardConfig();
      Object.assign(remoteRunConfig, {
        environments: settings.environments, suites: settings.suites,
        github: { token: env.GITHUB_TOKEN, owner: env.GITHUB_OWNER || 'hadinhkms', repo: env.GITHUB_REPO || 'Automation_playwright_SV', workflow: env.GITHUB_WORKFLOW || 'discord-run-playwright.yml', ref: env.GITHUB_REF || 'main' },
      });
      sendJson(response, 202, await remoteRunService.dispatch(body));
    } catch (e) { sendJson(response, 400, { error: e.message }); }
    return true;
  }
  if (request.method === 'POST' && url.pathname === '/api/discord/test') {
    return handleDiscordTest(request, response);
  }
  if (request.method === 'GET' && url.pathname === '/api/discord-bot/config') {
    return handleDiscordBotGetConfig(response, root, discordBotDir, discordBotEnvPath);
  }
  if (request.method === 'PUT' && url.pathname === '/api/discord-bot/config') {
    return handleDiscordBotPutConfig(request, response, discordBotDir, discordBotEnvPath);
  }
  return false;
}

async function handleDiscordTest(request, response) {
  try {
    const body = await parseBody(request);
    const settings = getDashboardConfig();
    const webhookUrl = body.webhookUrl || settings.discord?.webhookUrl;
    if (!webhookUrl) throw new Error('Chưa cung cấp Discord Webhook URL.');
    const testEmbed = {
      title: '🧪 Kiểm Tra Kết Nối Discord Webhook Thành Công!', color: 0x3b82f6,
      description: `${settings.branding?.projectName || 'QA Automation'} Dashboard đã kết nối thành công tới kênh Discord này.\nBạn sẽ nhận được thông báo tự động mỗi khi có lượt chạy test!`,
      fields: [{ name: '🖥️ Hệ thống', value: settings.branding?.projectName || 'QA Automation Studio', inline: true }, { name: '⏰ Thời gian', value: new Date().toLocaleString('vi-VN'), inline: true }],
      footer: { text: `${settings.branding?.projectName || 'QA Automation'} Bot` }, timestamp: new Date().toISOString(),
    };
    await sendDiscordWebhook(webhookUrl, { username: `${settings.branding?.projectName || 'QA Automation'} Bot`, avatar_url: settings.branding?.logoUrl || undefined, embeds: [testEmbed] });
    sendJson(response, 200, { success: true, message: 'Đã gửi tin nhắn thử nghiệm thành công tới Discord!' });
  } catch (e) { sendJson(response, 400, { error: `Không thể gửi tin nhắn Discord: ${e.message}` }); }
  return true;
}

function handleDiscordBotGetConfig(response, root, discordBotDir, discordBotEnvPath) {
  const exists = fs.existsSync(discordBotEnvPath);
  const env = exists ? parseEnvFile(discordBotEnvPath) : {};
  let currentGitBranch = 'main';
  try {
    const headPath = path.join(root, '.git', 'HEAD');
    if (fs.existsSync(headPath)) {
      const headContent = fs.readFileSync(headPath, 'utf8').trim();
      const branchMatch = headContent.match(/ref:\s+refs\/heads\/(.+)/);
      currentGitBranch = branchMatch ? branchMatch[1] : headContent.slice(0, 7);
    }
  } catch {}
  sendJson(response, 200, {
    exists, botDir: discordBotDir, currentGitBranch,
    config: {
      discordToken: env.DISCORD_TOKEN ? `${env.DISCORD_TOKEN.slice(0, 10)}...${env.DISCORD_TOKEN.slice(-6)}` : '',
      hasDiscordToken: Boolean(env.DISCORD_TOKEN), allowedChannelId: env.ALLOWED_CHANNEL_ID || '',
      githubToken: env.GITHUB_TOKEN ? `${env.GITHUB_TOKEN.slice(0, 12)}...${env.GITHUB_TOKEN.slice(-4)}` : '',
      hasGithubToken: Boolean(env.GITHUB_TOKEN), githubOwner: env.GITHUB_OWNER || 'hadinhkms',
      githubRepo: env.GITHUB_REPO || 'Automation_playwright_SV', githubWorkflow: env.GITHUB_WORKFLOW || 'discord-run-playwright.yml', githubRef: env.GITHUB_REF || 'main',
    },
  });
  return true;
}

async function handleDiscordBotPutConfig(request, response, discordBotDir, discordBotEnvPath) {
  try {
    const body = await parseBody(request);
    if (!fs.existsSync(discordBotDir)) throw new Error(`Thư mục Discord Bot không tồn tại: ${discordBotDir}`);
    const current = parseEnvFile(discordBotEnvPath);
    if (body.discordToken && !body.discordToken.includes('...')) current.DISCORD_TOKEN = body.discordToken.trim();
    if (body.githubToken && !body.githubToken.includes('...')) current.GITHUB_TOKEN = body.githubToken.trim();
    if (body.allowedChannelId !== undefined) current.ALLOWED_CHANNEL_ID = String(body.allowedChannelId).trim();
    if (body.githubOwner) current.GITHUB_OWNER = String(body.githubOwner).trim();
    if (body.githubRepo) current.GITHUB_REPO = String(body.githubRepo).trim();
    if (body.githubWorkflow) current.GITHUB_WORKFLOW = String(body.githubWorkflow).trim();
    if (body.githubRef) current.GITHUB_REF = String(body.githubRef).trim();
    writeEnvFile(discordBotEnvPath, current);
    sendJson(response, 200, { message: 'Đã lưu cấu hình Discord QA Bot thành công!' });
  } catch (e) { sendJson(response, 400, { error: `Không thể lưu cấu hình Bot: ${e.message}` }); }
  return true;
}

module.exports = { handleSystemRoutes, sendDiscordWebhook };
