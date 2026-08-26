const PORT = Number.parseInt(process.env.DASHBOARD_PORT || '4173', 10);
const URL = `http://127.0.0.1:${PORT}`;

async function stop() {
  try {
    const response = await fetch(`${URL}/api/shutdown`, {
      method: 'POST',
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    console.log(`Đã tắt dashboard tại ${URL}`);
  } catch {
    console.log(`Không có dashboard đang chạy tại ${URL}`);
  }
}

stop();

