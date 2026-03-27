// lib/autodesk.js

function getBaseUrl(env) {
  return env === 'prod'
    ? 'https://enterprise-api.autodesk.com'
    : 'https://enterprise-api-stg.autodesk.com';
}

function maskBearer(token) {
  if (!token) return '';
  if (token.length <= 10) return 'Bearer ***';
  return 'Bearer ' + token.slice(0, 6) + '...' + token.slice(-4);
}

/**
 * PlaceOrder v2 - OAuth Bearer ONLY
 * NO signature
 * NO timestamp
 */
async function sendToAutodesk({ env = 'stg', accessToken, payload }) {
  if (!accessToken) throw new Error('Missing Autodesk access token');
  if (!payload) throw new Error('Missing payload');

  const baseUrl = getBaseUrl(env);
  const url = baseUrl + '/v2/orders/fulfillment';

  let response;
  let text;

  response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  text = await response.text();

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
      status: response.status,
      ok: response.ok,
      body
    }
  };
}

module.exports = { sendToAutodesk };