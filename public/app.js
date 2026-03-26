// Helper para acceder a elementos por id
const $ = (id) => document.getElementById(id);

let currentXml = '';

// Mostrar estado (OK / Error)
function badge(id, text, ok = true) {
  const el = $(id);
  el.textContent = text;
  el.style.color = ok ? '#22c55e' : '#f87171';
}

// POST JSON helper
async function postJson(url, body) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const t = await r.text();
  let j;
  try {
    j = JSON.parse(t);
  } catch {
    j = { raw: t };
  }

  if (!r.ok) {
    const msg =
      j?.error ||
      j?.message ||
      j?.raw ||
      ('HTTP ' + r.status);
    throw new Error(msg);
  }

  return j;
}

// Recolectar formulario completo
function collectForm() {
  return {
    env: $('env').value,
    discountPct: $('discountPct').value,
    soldToCsn: $('soldToCsn').value,
    resellerCsn: $('resellerCsn').value,

    ecName: $('ecName').value,
    ecCountry: $('ecCountry').value,
    ecAddress1: $('ecAddress1').value,
    ecAddress2: $('ecAddress2').value,
    ecCity: $('ecCity').value,
    ecState: $('ecState').value,
    ecPostal: $('ecPostal').value,

    cmFirst: $('cmFirst').value,
    cmLast: $('cmLast').value,
    cmEmail: $('cmEmail').value,
    cmLanguage: $('cmLanguage').value,
    cmPhone: $('cmPhone').value,

    shipSame: $('shipSame').checked
  };
}

// EXTRAER datos del XML (preview mínimo)
async function extract() {
  try {
    badge('extractStatus', 'Working…');

    const xml = $('xmlText').value.trim() || currentXml;
    if (!xml) throw new Error('Pega o carga un XML primero');

    currentXml = xml;

    const resp = await postJson('/api/preview', {
      xml,
      form: {
        env: $('env').value,
        discountPct: $('discountPct').value,
        shipSame: $('shipSame').checked,
        soldToCsn: $('soldToCsn').value,
        resellerCsn: $('resellerCsn').value
      }
    });

    $('extracted').textContent = JSON.stringify(resp.extracted, null, 2);

    const ex = resp.extracted;

    if (!$('ecName').value) $('ecName').value = ex.endCustomer?.name || '';
    if (!$('ecAddress1').value) $('ecAddress1').value = ex.endCustomer?.addressLine1 || '';
    if (!$('ecCity').value) $('ecCity').value = ex.endCustomer?.city || '';
    if (!$('ecState').value) $('ecState').value = ex.endCustomer?.stateProvinceCode || '';
    if (!$('ecPostal').value) $('ecPostal').value = ex.endCustomer?.postalCode || '';
    if (!$('ecCountry').value) $('ecCountry').value = ex.endCustomer?.countryCode || '';

    const cn = (ex.contractManager?.contactName || '').trim();
    if (cn && (!$('cmFirst').value && !$('cmLast').value)) {
      const parts = cn.split(/\s+/);
      $('cmFirst').value = parts[0] || '';
      $('cmLast').value = parts.slice(1).join(' ') || parts[0] || '';
    }

    if (!$('cmEmail').value) {
      $('cmEmail').value =
        ex.contractManager?.email1 ||
        ex.contractManager?.email2 ||
        '';
    }

    if (!$('cmPhone').value) {
      $('cmPhone').value = ex.contractManager?.phone || '';
    }

    badge('extractStatus', 'OK');
  } catch (e) {
    badge('extractStatus', 'Error', false);
    $('extracted').textContent = e.message;
  }
}

// PREVIEW payload completo
async function preview() {
  try {
    badge('sendStatus', 'Preview…');

    const xml = $('xmlText').value.trim() || currentXml;
    if (!xml) throw new Error('Falta XML');

    currentXml = xml;

    const resp = await postJson('/api/preview', {
      xml,
      form: collectForm()
    });

    $('payload').textContent = JSON.stringify(resp.payload, null, 2);
    $('response').textContent = '';

    badge('sendStatus', 'Preview OK');
  } catch (e) {
    badge('sendStatus', 'Preview Error', false);
    $('payload').textContent = e.message;
  }
}

// SEND a Autodesk
async function send() {
  try {
    badge('sendStatus', 'Sending…');

    const xml = $('xmlText').value.trim() || currentXml;
    if (!xml) throw new Error('Falta XML');

    currentXml = xml;

    const resp = await postJson('/api/send', {
      xml,
      form: collectForm(),
      auth: {
        csn: $('authCsn').value,
        accessToken: $('accessToken').value
      }
    });

    $('payload').textContent = JSON.stringify(resp.payload, null, 2);
    $('response').textContent = JSON.stringify(resp.result, null, 2);

    badge('sendStatus', 'Sent');
  } catch (e) {
    badge('sendStatus', 'Send Error', false);
    $('response').textContent = e.message;
  }
}

// Cargar XML desde archivo
$('xmlFile').addEventListener('change', async (e) => {
  const f = e.target.files && e.target.files[0];
  if (!f) return;

  const text = await f.text();
  $('xmlText').value = text;
  currentXml = text;
});

// Botones
$('btnExtract').addEventListener('click', extract);
$('btnPreview').addEventListener('click', preview);
$('btnSend').addEventListener('click', send);
``