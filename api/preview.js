const { parseDatechXml, buildAutodeskPayload } = require('../lib/xml');

module.exports = (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { xml, form } = req.body || {};

    if (!xml) {
      return res.status(400).json({ error: 'Missing xml' });
    }

    const extracted = parseDatechXml(xml);
    const payload = buildAutodeskPayload({ extracted, form });

    return res.status(200).json({ extracted, payload });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};
``