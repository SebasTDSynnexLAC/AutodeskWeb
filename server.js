require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const express = require('express');
const { parseDatechXml, buildAutodeskPayload } = require('./lib/xml');
const { sendToAutodesk } = require('./lib/autodesk');

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.post('/api/preview', (req, res) => {
  try {
    const { xml, form } = req.body;
    if (!xml) return res.status(400).json({ error: 'Missing xml' });
    const extracted = parseDatechXml(xml);
    const payload = buildAutodeskPayload({ extracted, form, defaults: getDefaults() });
    res.json({ payload, extracted });
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

app.post('/api/send', async (req, res) => {
  try {
    const { xml, form, auth } = req.body;
    if (!xml) return res.status(400).json({ error: 'Missing xml' });
    if (!auth || !auth.accessToken) return res.status(400).json({ error: 'Missing auth.accessToken' });
    if (!auth.csn) return res.status(400).json({ error: 'Missing auth.csn (header CSN)' });

    const extracted = parseDatechXml(xml);
    const payload = buildAutodeskPayload({ extracted, form, defaults: getDefaults() });

    const result = await sendToAutodesk({
      env: (form && form.env) || getDefaults().DEFAULT_ENV,
      accessToken: auth.accessToken,
      csn: auth.csn,
      payload,
    });

    writeAudit({ extracted, payload, result });
    res.json({ payload, result });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

function getDefaults() {
  return {
    PORT: process.env.PORT || '3280',
    DEFAULT_ENV: process.env.DEFAULT_ENV || 'stg',
    DEFAULT_SOLD_TO_CSN: process.env.DEFAULT_SOLD_TO_CSN || '',
    DEFAULT_RESELLER_CSN: process.env.DEFAULT_RESELLER_CSN || '',
    DEFAULT_COUNTRY_CODE: process.env.DEFAULT_COUNTRY_CODE || 'CA',
    DEFAULT_LANGUAGE: process.env.DEFAULT_LANGUAGE || 'EN',
  };
}

function safeFileName(s){
  return String(s||'').replace(/[^a-zA-Z0-9._-]+/g,'_').slice(0,120);
}

function writeAudit({ extracted, payload, result }){
  try{
    const stamp = new Date().toISOString().replace(/[:.]/g,'-');
    const po = safeFileName(extracted && extracted.poNumber);
    const dir = path.join(__dirname, 'audit', `${stamp}__${po||'PO'}`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'extracted.json'), JSON.stringify(extracted, null, 2));
    fs.writeFileSync(path.join(dir, 'payload.json'), JSON.stringify(payload, null, 2));
    fs.writeFileSync(path.join(dir, 'result.json'), JSON.stringify(result, null, 2));
  } catch (e) {
    console.warn('[audit] failed:', e.message || String(e));
  }
}

function tryOpenBrowser(url){
  try{
    const p = process.platform;
    if (p === 'win32') exec(`start \"\" ${url}`);
    else if (p === 'darwin') exec(`open ${url}`);
    else exec(`xdg-open ${url}`);
  } catch { /* ignore */ }
}

const port = Number(process.env.PORT || 3280);
app.listen(port, () => {
  const url = `http://localhost:${port}`;
  console.log(`[local-po-uploader] running on ${url}`);
  tryOpenBrowser(url);
});
