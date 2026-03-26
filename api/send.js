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
    const { xml, form, auth } = req.body || {};

    if (!xml) {
      return res.status(400).json({ error: 'Missing xml' });
    }

    if (!auth || !auth.accessToken) {
      return res.status(400).json({ error: 'Missing accessToken' });
    }

    if (!auth.csn) {
      return res.status(400).json({ error: 'Missing CSN' });
    }

    const extracted = parseDatechXml(xml);
    const payload = buildAutodeskPayload({ extracted, form });

    const result = await sendToAutodesk({
      env: form?.env || 'stg',
      accessToken: auth.accessToken,
      csn: auth.csn,
      payload
    });

    return res.status(200).json({ payload, result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
``