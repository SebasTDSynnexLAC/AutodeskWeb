// lib/autodesk.js

function getBaseUrl(env) {
  return env === 'prod'
    ? 'https://enterprise-api.autodesk.com'
    : 'https://enterprise-api-stg.autodesk.com';
}

function maskBearer(token) {
  if (!token) return '';
  return token.length <= 10 ? 'Bearer ***' : Bearer ${token.slice(0, 6)}…${token.slice(-4)};
}

/**
 * PlaceOrder v2 - OAuth Bearer ONLY.
 * NO signature / NO timestamp headers here.
 */
async function sendToAutodesk({ env = 'stg', accessToken, payload }) {
  if (!accessToken) throw new Error('Missing Autodesk access token');

  const baseUrl = getBaseUrl(env);
  const url = ${baseUrl}/v2/orders/fulfillment; // ✅ FIX

  // Timeout defensivo (30s)
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 30000);

  let resp, text;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': Bearer ${accessToken},
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    text = await resp.text();
  } finally {
    clearTimeout(t);
  }

  let body;
  try { body = JSON.parse(text); } catch { body = text; }

  return {
    request: {
      url,
      headers: {
        Authorization: maskBearer(accessToken),
        'Content-Type': 'application/json'
      }
    },
    response: {
      status: resp.status,
      ok: resp.ok,
      body
    }
  };
}

module.exports = { sendToAutodesk };
``