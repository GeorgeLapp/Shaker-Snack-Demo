const logEvent = (label, payload = {}) => {
  const timestamp = new Date().toISOString();
  const hasPayload = payload && typeof payload === 'object' && Object.keys(payload).length > 0;
  const serialized = hasPayload ? ` | data: ${JSON.stringify(payload)}` : '';
  console.log(`[${timestamp}] ${label}${serialized}`);
};

module.exports = {
  logEvent,
};
