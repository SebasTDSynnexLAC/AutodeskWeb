const { parseDatechXml, buildAutodeskPayload } = require('../lib/xml');
const { sendToAutodesk } = require('../lib/autodesk');

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { xml, form } = req.body || {};

    if (!xml) {
      return res.status(400).json({ error: 'Missing xml' });
    }

    // 🔑 Token desde Vercel Environment Variables
    const AUTODESK_TOKEN = process.env.AUTODESK_ACCESS_TOKEN;

    if (!AUTODESK_TOKEN) {
      return res.status(500).json({
        error: 'Missing AUTODESK_ACCESS_TOKEN environment variable'
      });
    }

    // Parsear XML y construir payload
    const extracted = parseDatechXml(xml);
    const payload = buildAutodeskPayload({ extracted, form });

    // Llamada a Autodesk PlaceOrder
    const result = await sendToAutodesk({
      env: form?.env || 'stg',
      accessToken: AUTODESK_TOKEN,   // ✅ token correcto
      csn: form?.soldToCsn,
      payload
    });

    return res.status(200).json({
      payload,
      result
    });
  } catch (err) {
    console.error('Error in /api/send:', err);
    return res.status(500).json({
      error: err.message || 'Unexpected error'
    });
  }
};
``