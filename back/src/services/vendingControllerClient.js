const http = require('http');
const https = require('https');
const { URL } = require('url');

const ensureTrailingSlash = (input) => (input.endsWith('/') ? input : `${input}/`);
const stripLeadingSlash = (input) => input.replace(/^\/+/, '');
const parsePositiveInt = (value) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const CONTROLLER_API_BASE_URL = ensureTrailingSlash(
  process.env.VENDING_CONTROLLER_API_URL?.trim() || 'http://127.0.0.1:3001/api/v1',
);
const REQUEST_TIMEOUT_MS = parsePositiveInt(process.env.VENDING_CONTROLLER_REQUEST_TIMEOUT_MS) || 10000;
const DEFAULT_VEND_TIMEOUT_MS = parsePositiveInt(process.env.VENDING_CONTROLLER_VEND_TIMEOUT_MS);

const buildUrl = (path) => {
  const normalizedPath = stripLeadingSlash(path);
  return new URL(normalizedPath, CONTROLLER_API_BASE_URL);
};

const requestJson = (method, path, body) => {
  const endpoint = buildUrl(path);
  const isHttps = endpoint.protocol === 'https:';
  const client = isHttps ? https : http;
  const payload = body ? JSON.stringify(body) : undefined;
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
  };

  const options = {
    hostname: endpoint.hostname,
    port: endpoint.port || (isHttps ? 443 : 80),
    path: `${endpoint.pathname}${endpoint.search}`,
    method,
    headers,
  };

  return new Promise((resolve, reject) => {
    const req = client.request(options, (res) => {
      const chunks = [];

      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const rawBody = Buffer.concat(chunks).toString('utf8');
        let parsedBody = null;

        if (rawBody) {
          try {
            parsedBody = JSON.parse(rawBody);
          } catch (error) {
            const parseError = new Error(`Invalid JSON from vending controller: ${error.message}`);
            parseError.statusCode = 502;
            parseError.responseBody = rawBody;
            reject(parseError);
            return;
          }
        }

        if (res.statusCode < 200 || res.statusCode >= 300) {
          const error = new Error(
            parsedBody?.error?.message ||
              `Vending controller responded with status ${res.statusCode}`,
          );
          error.statusCode = res.statusCode;
          error.details = parsedBody?.error?.details;
          error.code = parsedBody?.error?.code;
          reject(error);
          return;
        }

        resolve(parsedBody);
      });
    });

    req.on('error', (error) => {
      const wrappedError = new Error(`Unable to reach vending controller: ${error.message}`);
      wrappedError.code = error.code;
      wrappedError.statusCode = 502;
      reject(wrappedError);
    });

    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error(`Request timed out after ${REQUEST_TIMEOUT_MS}ms`));
    });

    if (payload) {
      req.write(payload);
    }

    req.end();
  });
};

const vendProduct = async ({ channel }) => {
  if (!Number.isInteger(channel) || channel <= 0) {
    const error = new Error('vendProduct: "channel" must be a positive integer');
    error.statusCode = 400;
    throw error;
  }

  const payload = { channel };
  if (DEFAULT_VEND_TIMEOUT_MS) {
    payload.timeoutMs = DEFAULT_VEND_TIMEOUT_MS;
  }

  const response = await requestJson('POST', '/vend/simple', payload);

  if (!response || typeof response !== 'object') {
    const error = new Error('Unexpected response from vending controller');
    error.statusCode = 502;
    throw error;
  }

  if (!response.success) {
    const error = new Error(
      response.error?.message || 'Vending controller rejected the vend command',
    );
    error.statusCode = 502;
    error.code = response.error?.code;
    error.details = response.error?.details;
    throw error;
  }

  return response.data || null;
};

module.exports = {
  vendProduct,
};
