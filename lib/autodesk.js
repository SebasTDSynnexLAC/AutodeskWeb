/**
 * Envía el payload a Autodesk PlaceOrder v2 usando OAuth (Bearer token)
 */
async function sendToAutodesk({ env = 'stg', accessToken, payload }) {
  if (!accessToken) {
    throw new Error('Missing Autodesk access token');
  }

  const baseUrl =
    env === 'prod'
      ? 'https://enterprise-api.autodesk.com'
      : 'https://enterprise-api-stg.autodesk.com';

  const url = ${baseUrl}/v2/orders/fulfillment;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': Bearer ${accessToken},
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  return {
    status: response.status,
    ok: response.ok,
    body
  };
}

module.exports = { sendToAutodesk };
``