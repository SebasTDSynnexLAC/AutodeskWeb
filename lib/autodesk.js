// lib/autodesk.js

/**
 * Devuelve la URL base según el ambiente
 */
function getBaseUrl(env) {
  return env === 'prod'
    ? 'https://enterprise-api.autodesk.com'
    : 'https://enterprise-api-stg.autodesk.com';
}

/**
 * Oculta el token en logs (seguridad)
 */
function maskBearer(token) {
  if (!token) return '';
  return token.length <= 10
    ? 'Bearer ***'
    : Bearer ${token.slice(0, 6)}…${token.slice(-4)};
}

/**
 * Envía el payload a Autodesk PlaceOrder v2 usando OAuth (Bearer token)
 * IMPORTANTE:
 *  - NO usar signature
 *  - NO usar timestamp
 *  - El CSN va en el payload, NO en headers
 */
async function sendToAutodesk({ env = 'stg', accessToken, payload }) {
  if (!accessToken) {
    throw new Error('Missing Autodesk access token');
  }

  if (!payload) {
    throw new Error('Missing payload');
  }

  const baseUrl = getBaseUrl(env);
  const url = ${baseUrl}/v2/orders/fulfillment;

  // Timeout defensivo (30s)
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  let response;
  let text;

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        // ✅ OAuth ONLY
        'Authorization': Bearer ${accessToken},
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    text = await response.text();
  } catch (err) {
    throw new Error(Fetch to Autodesk failed: ${err.message});
  } finally {
    clearTimeout(timeout);
  }

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

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

module.exports = {
  sendToAutodesk
};
``