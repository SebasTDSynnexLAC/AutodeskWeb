const { XMLParser } = require('fast-xml-parser');

function parseDatechXml(xml) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    allowBooleanAttributes: true,
    trimValues: true,
    parseTagValue: true,
    parseAttributeValue: true,
  });

  let obj;
  try {
    obj = parser.parse(xml);
  } catch (e) {
    throw new Error('XML parse failed: ' + (e.message || String(e)));
  }

  const root = obj.XML_Order_Submit || obj.XML_Order_Submit || obj.XML_Order_Submit;
  if (!root) {
    const k = Object.keys(obj || {})[0];
    if (!k) throw new Error('Invalid XML: empty document');
    throw new Error(`Invalid XML: expected XML_Order_Submit root, got ${k}`);
  }

  const header = root.Header || {};
  const detail = root.Detail || {};
  let lineInfo = detail.LineInfo || [];
  if (!Array.isArray(lineInfo)) lineInfo = [lineInfo];

  const extracted = {
    poNumber: safeString(header.PONbr),
    endCustomer: {
      name: safeString(header.Name) || safeString(header.EndUserInfo && header.EndUserInfo.EuiName),
      addressLine1: safeString((header.EndUserInfo && header.EndUserInfo.EuiAddr1) || (header.AddrInfo && header.AddrInfo.Addr && (Array.isArray(header.AddrInfo.Addr) ? header.AddrInfo.Addr[0] : header.AddrInfo.Addr)) ),
      addressLine2: safeString((header.EndUserInfo && header.EndUserInfo.EuiAddr2) || ''),
      addressLine3: safeString((header.EndUserInfo && header.EndUserInfo.EuiAddr3) || ''),
      city: safeString((header.EndUserInfo && header.EndUserInfo.EuiCityName) || header.CityName),
      stateProvinceCode: safeString((header.EndUserInfo && header.EndUserInfo.EuiStateProvinceCode) || header.StateProvinceCode),
      postalCode: safeString((header.EndUserInfo && header.EndUserInfo.EuiPostalCode) || header.PostalCode),
      countryCode: safeString((header.EndUserInfo && header.EndUserInfo.EuiCountryCode) || ''),
    },
    contractManager: {
      contactName: safeString((header.EndUserInfo && header.EndUserInfo.EuiContactName) || header.ContactName),
      phone: safeString((header.EndUserInfo && header.EndUserInfo.EuiPhoneNbr) || header.ContactPhoneNbr),
      email1: safeString(header.EndUserInfo && header.EndUserInfo.EuiContactEmailAddr1),
      email2: safeString(header.EndUserInfo && header.EndUserInfo.EuiContactEmailAddr2),
    },
    lines: lineInfo.filter(Boolean).map(li => ({
      lineNo: safeString(li.OrigCustPOLineNbr),
      quantity: toInt(li.QtyOrdered),
      unitPrice: toMoney(li.UnitPrice),
      partNumber: safeString(li.ProductID),
      message: safeString(li.OrderMessageLine || header.OrderMessageHdr),
    }))
  };

  if (!extracted.poNumber) throw new Error('XML missing Header/PONbr (poNumber)');
  if (!extracted.lines.length) throw new Error('XML missing Detail/LineInfo lines');
  return extracted;
}

function buildAutodeskPayload({ extracted, form = {}, defaults = {} }) {
  const discountPct = Number(form.discountPct || 0);
  const isEsi = discountPct === 3;

  const soldToCsn = safeString(form.soldToCsn) || defaults.DEFAULT_SOLD_TO_CSN || '';
  const resellerCsn = safeString(form.resellerCsn) || defaults.DEFAULT_RESELLER_CSN || '';
  if (!soldToCsn) throw new Error('Missing Sold-To CSN (soldToCsn)');
  if (!resellerCsn) throw new Error('Missing Reseller CSN (resellerCsn)');

  const ec = {
    name: safeString(form.ecName) || extracted.endCustomer.name,
    addressLine1: safeString(form.ecAddress1) || extracted.endCustomer.addressLine1,
    addressLine2: safeString(form.ecAddress2) || extracted.endCustomer.addressLine2,
    addressLine3: safeString(form.ecAddress3) || extracted.endCustomer.addressLine3,
    city: safeString(form.ecCity) || extracted.endCustomer.city,
    stateProvinceCode: safeString(form.ecState) || extracted.endCustomer.stateProvinceCode,
    postalCode: safeString(form.ecPostal) || extracted.endCustomer.postalCode,
    countryCode: safeString(form.ecCountry) || extracted.endCustomer.countryCode || defaults.DEFAULT_COUNTRY_CODE || '',
  };

  const cmFirstLast = splitName(safeString(form.cmName) || extracted.contractManager.contactName);
  const cm = {
    firstName: safeString(form.cmFirst) || cmFirstLast.first,
    lastName: safeString(form.cmLast) || cmFirstLast.last,
    email: safeString(form.cmEmail) || extracted.contractManager.email1 || extracted.contractManager.email2,
    language: safeString(form.cmLanguage) || defaults.DEFAULT_LANGUAGE || 'EN',
    countryCode: safeString(form.cmCountry) || ec.countryCode,
    phoneNumber: safeString(form.cmPhone) || extracted.contractManager.phone,
  };

  const shipSame = !!form.shipSame;
  const shipTo = shipSame ? {
    name: ec.name,
    addressLine1: ec.addressLine1,
    addressLine2: ec.addressLine2,
    addressLine3: ec.addressLine3,
    city: ec.city,
    stateProvinceCode: ec.stateProvinceCode,
    postalCode: ec.postalCode,
    countryCode: ec.countryCode,
  } : {
    name: safeString(form.shipName) || ec.name,
    addressLine1: safeString(form.shipAddress1) || ec.addressLine1,
    addressLine2: safeString(form.shipAddress2) || ec.addressLine2,
    addressLine3: safeString(form.shipAddress3) || ec.addressLine3,
    city: safeString(form.shipCity) || ec.city,
    stateProvinceCode: safeString(form.shipState) || ec.stateProvinceCode,
    postalCode: safeString(form.shipPostal) || ec.postalCode,
    countryCode: safeString(form.shipCountry) || ec.countryCode,
  };

  const missing = [];
  if (!ec.name) missing.push('endCustomer.account.name');
  if (!ec.addressLine1) missing.push('endCustomer.account.addressLine1');
  if (!ec.city) missing.push('endCustomer.account.city');
  if (!ec.postalCode) missing.push('endCustomer.account.postalCode');
  if (!ec.countryCode) missing.push('endCustomer.account.countryCode');
  if (!cm.firstName) missing.push('endCustomer.contractManager.firstName');
  if (!cm.lastName) missing.push('endCustomer.contractManager.lastName');
  if (!cm.email) missing.push('endCustomer.contractManager.email');
  if (missing.length) throw new Error('Missing required fields: ' + missing.join(', '));

  const lineItems = extracted.lines.map((l) => ({
    partNumber: l.partNumber,
    quantity: l.quantity,
    netPrice: calcNetPrice(l.quantity, l.unitPrice, discountPct),
  }));

  const payload = {
    action: 'Initial',
    endCustomer: { account: ec, contractManager: cm },
    shipTo,
    reseller: { csn: resellerCsn },
    soldTo: { csn: soldToCsn },
    poNumber: extracted.poNumber,
    lineItems,
  };

  if (isEsi) payload.orderDiscounts = [{ discountType: 'ESI' }];
  if (form.customerPoNumber) payload.customerPoNumber = safeString(form.customerPoNumber);
  return payload;
}

function calcNetPrice(qty, unitPrice, discountPct) {
  const base = Number(qty) * Number(unitPrice);
  const disc = discountPct ? base * (1 - discountPct / 100) : base;
  return disc.toFixed(2);
}

function splitName(name) {
  const n = (name || '').trim();
  if (!n) return { first: '', last: '' };
  const parts = n.split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: parts[0] };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

function safeString(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function toInt(v) {
  const n = parseInt(String(v), 10);
  if (Number.isNaN(n)) return 0;
  return n;
}

function toMoney(v) {
  const n = parseFloat(String(v));
  if (Number.isNaN(n)) return 0;
  return Number(n.toFixed(2));
}

module.exports = { parseDatechXml, buildAutodeskPayload };
