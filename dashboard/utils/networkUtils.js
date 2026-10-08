const os = require('os');

function getLanIps() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  return ips;
}

function printServerAddresses(appName, port, configuredHost, isBackground = false) {
  const isAll = configuredHost === '0.0.0.0' || configuredHost === '::';
  if (isBackground) {
    console.log(`${appName} dashboard đang chạy ngầm:`);
    console.log(`  > Local:   http://localhost:${port}`);
  } else {
    if (isAll) {
      console.log(`Playwright Dashboard (${appName}):`);
      console.log(`  > Local:   http://localhost:${port}`);
    } else {
      console.log(`Playwright Dashboard (${appName}): http://${configuredHost}:${port}`);
    }
  }

  if (isAll) {
    const lanIps = getLanIps();
    lanIps.forEach((ip) => {
      console.log(`  > Network: http://${ip}:${port}`);
    });
  }
}

module.exports = { getLanIps, printServerAddresses };
