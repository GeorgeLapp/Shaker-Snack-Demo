const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { getProductMatrix, startSale, issueProduct } = require('./controllers/clientController');
const { parseJsonBody, sendJson } = require('./utils/requestUtils');
const { logEvent } = require('./logger');

const ensureLeadingSlash = (value) => (value.startsWith('/') ? value : `/${value}`);
const ensureTrailingSlash = (value) => (value.endsWith('/') ? value : `${value}/`);

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const STATIC_ROUTE_PREFIX = ensureTrailingSlash(
  ensureLeadingSlash(process.env.STATIC_ROUTE_PREFIX || '/media'),
);
const STATIC_MEDIA_ROOT = process.env.STATIC_MEDIA_ROOT
  ? path.resolve(process.env.STATIC_MEDIA_ROOT)
  : path.resolve(__dirname, '../../SnackMedia');

const MIME_TYPES = {
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

const getContentType = (filePath) => MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';

const sanitizeRelativePath = (inputPath) =>
  path
    .normalize(inputPath)
    .replace(/^([\\/])+/g, '')
    .replace(/^(\.\.(?:\\|\/|$))+/, '');

const serveStaticFile = (pathname, res) =>
  new Promise((resolve) => {
    let relativePath;

    try {
      relativePath = decodeURIComponent(pathname.slice(STATIC_ROUTE_PREFIX.length));
    } catch (error) {
      logEvent('static.decodeError', { pathname, message: error.message });
      sendJson(res, 400, { message: 'Invalid path' });
      resolve(true);
      return;
    }

    if (!relativePath) {
      sendJson(res, 404, { message: 'File not found' });
      resolve(true);
      return;
    }

    const sanitizedRelativePath = sanitizeRelativePath(relativePath);
    const absolutePath = path.join(STATIC_MEDIA_ROOT, sanitizedRelativePath);

    if (!absolutePath.startsWith(STATIC_MEDIA_ROOT)) {
      logEvent('static.forbidden', { resource: sanitizedRelativePath });
      sendJson(res, 403, { message: 'Access denied' });
      resolve(true);
      return;
    }

    fs.stat(absolutePath, (statError, stats) => {
      if (statError || !stats.isFile()) {
        logEvent('static.notFound', {
          resource: sanitizedRelativePath,
          error: statError ? statError.message : undefined,
        });
        sendJson(res, 404, { message: 'File not found' });
        resolve(true);
        return;
      }

      const stream = fs.createReadStream(absolutePath);
      const contentType = getContentType(absolutePath);
      let settled = false;
      const settle = () => {
        if (!settled) {
          settled = true;
          resolve(true);
        }
      };

      stream.on('open', () => {
        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': stats.size,
          'Cache-Control': 'public, max-age=86400',
        });
        stream.pipe(res);
      });

      stream.on('end', () => {
        logEvent('static.served', { resource: sanitizedRelativePath, size: stats.size });
        settle();
      });

      stream.on('error', (streamError) => {
        logEvent('static.error', { resource: sanitizedRelativePath, message: streamError.message });
        if (!res.headersSent) {
          sendJson(res, 500, { message: 'Unable to read file' });
        } else {
          res.destroy(streamError);
        }
        settle();
      });

      res.on('close', () => {
        if (!stream.destroyed) {
          stream.destroy();
        }
        settle();
      });
    });
  });

const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
};

const server = http.createServer(async (req, res) => {
  setCorsHeaders(res);

  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const { pathname } = requestUrl;

  logEvent('http.request', {
    method: req.method,
    path: pathname,
    traceId: req.headers['x-request-id'] || null,
  });

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && pathname.startsWith(STATIC_ROUTE_PREFIX)) {
    const served = await serveStaticFile(pathname, res);
    if (served) {
      return;
    }
  }

  try {
    if (req.method === 'GET' && pathname === '/api/product-matrix') {
      const data = getProductMatrix();
      sendJson(res, 200, data);
      return;
    }

    if (req.method === 'POST' && pathname === '/api/start-sale') {
      const payload = await parseJsonBody(req);
      const data = await startSale(payload);
      sendJson(res, 200, data);
      return;
    }

    if (req.method === 'POST' && pathname === '/api/issue-product') {
      const payload = await parseJsonBody(req);
      const data = await issueProduct(payload);
      sendJson(res, 200, data);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ message: 'Route not found' }));
  } catch (error) {
    const statusCode = error.statusCode && Number.isInteger(error.statusCode) ? error.statusCode : 500;
    logEvent('http.error', {
      message: error.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : error.stack,
      statusCode,
    });
    sendJson(res, statusCode, { message: error.message || 'Internal server error' });
  }
});

server.listen(PORT, () => {
  logEvent('server.start', { port: PORT });
});
