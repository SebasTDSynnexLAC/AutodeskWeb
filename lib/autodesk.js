const crypto = require('crypto');

async function sendToAutodesk({ env = 'stg', accessToken, csn, payload }) {
  const url = env === 'prod'
    ? 'https://enterprise-api.autodesk.com/v2/orders/fulfillment'
    : 'https://enterprise-api-stg.autodesk.com/v2/orders/fulfillment';

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const raw = `${url}${accessToken}${timestamp}`;
  const signature = crypto.createHash('sha256').update(raw, 'utf8').digest('base64');

  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'timestamp': timestamp,
    'signature': signature,
    'CSN': csn,
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const text = await resp.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text }; }

  return {
    request: { url, headers: redactHeaders(headers) },
    response: { status: resp.status, ok: resp.ok, body }
  };
}

function redactHeaders(h) {
  const out = { ...h };
  if (out.Authorization) {
    out.Authorization = 'Bearer ' + out.Authorization.replace(/^Bearer\s+/i, '').slice(0, 6) + '…';
  }
  return out;
}

module.exports = { sendToAutodesk };
