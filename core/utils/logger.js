/**
 * core/utils/logger.js
 * Structured Logger nhẹ cho QA Automation Framework.
 * Configurable qua env var LOG_LEVEL (default: INFO).
 * Giữ output console.* nhưng thêm timestamp + level + prefix.
 */

const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, SILENT: 4 };

function getConfiguredLevel() {
  const envLevel = (process.env.LOG_LEVEL || 'INFO').toUpperCase();
  return LOG_LEVELS[envLevel] ?? LOG_LEVELS.INFO;
}

function formatTimestamp() {
  const now = new Date();
  return now.toISOString().replace('T', ' ').replace('Z', '');
}

class Logger {
  /**
   * @param {string} [prefix] - Module/component name prefix
   */
  constructor(prefix = '') {
    this.prefix = prefix ? `[${prefix}]` : '';
    this._level = getConfiguredLevel();
  }

  _shouldLog(level) {
    return LOG_LEVELS[level] >= this._level;
  }

  _format(level, message) {
    return `${formatTimestamp()} ${level.padEnd(5)} ${this.prefix} ${message}`.trim();
  }

  debug(message, ...args) {
    if (this._shouldLog('DEBUG')) {
      console.debug(this._format('DEBUG', message), ...args);
    }
  }

  info(message, ...args) {
    if (this._shouldLog('INFO')) {
      console.log(this._format('INFO', message), ...args);
    }
  }

  warn(message, ...args) {
    if (this._shouldLog('WARN')) {
      console.warn(this._format('WARN', message), ...args);
    }
  }

  error(message, ...args) {
    if (this._shouldLog('ERROR')) {
      console.error(this._format('ERROR', message), ...args);
    }
  }

  /**
   * Tạo child logger với prefix kế thừa
   * @param {string} childPrefix
   * @returns {Logger}
   */
  child(childPrefix) {
    const combined = this.prefix ? `${this.prefix.slice(1, -1)}:${childPrefix}` : childPrefix;
    return new Logger(combined);
  }
}

/**
 * Factory tạo logger cho từng module
 * @param {string} [moduleName]
 * @returns {Logger}
 */
function createLogger(moduleName) {
  return new Logger(moduleName);
}

module.exports = { Logger, createLogger, LOG_LEVELS };
