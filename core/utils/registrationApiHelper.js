const fs = require('fs');
const path = require('path');
const envConfig = require('../config/env');
const { randomUUID } = require('crypto');

class RegistrationApiHelper {
  constructor(requestContext) {
    this.requestContext = requestContext;
  }

  buildHeaders(overrides = {}) {
    const rawAuthorizationToken = process.env.REGISTRATION_BEARER_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjaGFubmVsX2NvZGUiOiJ2bDI0aCIsInVzZXIiOm51bGx9.b_GBXepcnCjRzAc9I5OdamF0Mx2K1rEg9sZVYpNx_rU';
    const authorization = /^bearer\s+/i.test(rawAuthorizationToken)
      ? rawAuthorizationToken
      : `Bearer ${rawAuthorizationToken}`;

    return {
      accept: 'application/json',
      'accept-language': 'vi-VN,vi;q=0.9',
      authorization,
      'content-type': 'application/json',
      origin: 'https://seeker.vl24hv2.qc.sieuviet-team.com',
      priority: 'u=1, i',
      referer: 'https://seeker.vl24hv2.qc.sieuviet-team.com/',
      'sec-ch-ua': '"Not)A;Brand";v="99", "Google Chrome";v="127", "Chromium";v="127"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-site',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
      'x-branch': 'vl24h.north',
      'x-correlation-id': randomUUID(),
      'x-lang': 'vi',
      'x-request-id': randomUUID(),
      ...overrides,
    };
  }

  buildPayload(email, password, mobile, name = 'Hà JS') {
    return {
      name,
      password,
      mobile,
      is_check_policy: true,
      email,
    };
  }

  isRetryableNetworkError(error) {
    const message = error?.message || '';
    return /ETIMEDOUT|ECONNRESET|ECONNREFUSED|socket hang up|fetch failed|networkidle/i.test(message);
  }

  async register(payload, headers = {}, options = {}) {
    const endpoint = `${envConfig.apiBaseURL}/seeker/fe/register`;
    const retries = options.retries ?? 2;
    const timeout = options.timeout ?? 30000;

    let lastError;
    for (let attempt = 1; attempt <= retries; attempt += 1) {
      try {
        const response = await this.requestContext.post(endpoint, {
          data: payload,
          headers,
          timeout,
        });
        const body = await response.json().catch(() => null);
        return { response, body };
      } catch (error) {
        lastError = error;
        if (attempt < retries && this.isRetryableNetworkError(error)) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        throw new Error(`Register API request failed after ${attempt} attempt(s): ${error.message}`);
      }
    }

    throw lastError;
  }

  async acceptConsent(headers = {}, options = {}) {
    const endpoint = `${envConfig.apiBaseURL}/seeker/fe/me/personal-data-consent/accept`;
    const payload = {
      platform: 'web',
      source: 'login',
      login_method: 'email',
    };
    const retries = options.retries ?? 2;
    const timeout = options.timeout ?? 30000;

    let lastError;
    for (let attempt = 1; attempt <= retries; attempt += 1) {
      try {
        const response = await this.requestContext.post(endpoint, {
          data: payload,
          headers,
          timeout,
        });
        const body = await response.json().catch(() => null);
        return { response, body };
      } catch (error) {
        lastError = error;
        if (attempt < retries && this.isRetryableNetworkError(error)) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        throw new Error(`Accept consent API request failed after ${attempt} attempt(s): ${error.message}`);
      }
    }

    throw lastError;
  }

  setRuntimeCache(userRecord) {
    if (!global.__automationState) {
      global.__automationState = {};
    }
    global.__automationState.registeredUser = userRecord;
    return userRecord;
  }

  persistUserState(payload = {}, responseBody = {}, options = {}) {
    const extractToken = (body) => {
      if (!body || typeof body !== 'object') return null;
      const possibleKeys = ['token_auth', 'tokenAuth', 'token', 'access_token', 'accessToken'];
      for (const key of possibleKeys) {
        const value = body[key];
        if (typeof value === 'string' && value.trim()) {
          return value;
        }
      }
      if (body.data && typeof body.data === 'object') {
        return extractToken(body.data);
      }
      return null;
    };

    const tokenAuth = extractToken(responseBody);
    const phone = payload.mobile || payload.phone || null;
    const email = payload.email || null;
    const password = payload.password || null;
    const name = payload.name || 'Automation Tester';

    const userRecord = {
      username: phone || email || 'unknown',
      phone,
      mobile: phone,
      email,
      password,
      fullName: name,
      tokenAuth,
      registeredAt: new Date().toISOString(),
    };

    this.setRuntimeCache(userRecord);

    if (options.writeFile === false) {
      return userRecord;
    }

    const usersFilePath = path.join(__dirname, '../../data/users.json');
    let usersData = [];

    try {
      usersData = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));
    } catch (error) {
      usersData = [];
    }

    if (!Array.isArray(usersData)) {
      usersData = [];
    }

    if (usersData.length === 0) {
      usersData.push(userRecord);
    } else {
      usersData[0] = {
        ...usersData[0],
        ...userRecord,
      };
    }

    fs.writeFileSync(usersFilePath, JSON.stringify(usersData, null, 2), 'utf8');
    return userRecord;
  }
}

module.exports = { RegistrationApiHelper };
