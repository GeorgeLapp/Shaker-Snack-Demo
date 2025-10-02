const parseJsonBody = (req) => {
  return new Promise((resolve, reject) => {
    let raw = '';

    req.on('data', (chunk) => {
      raw += chunk;

      if (raw.length > 1e6) {
        req.connection.destroy();
        reject(new Error('Request body too large'));
      }
    });

    req.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error('Invalid JSON payload'));
      }
    });

    req.on('error', (err) => reject(err));
  });
};

const sendJson = (res, statusCode, payload) => {
  const responseBody = JSON.stringify(payload);

  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(responseBody),
  });
  res.end(responseBody);
};

module.exports = {
  parseJsonBody,
  sendJson,
};
