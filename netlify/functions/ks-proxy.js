const crypto = require('crypto');

const ENDPOINTS = [
  'https://kingshot-giftcode.centurygame.com/api',
  'https://ks-giftcode.centurygame.com/api'
];

const SALTS = [
  'mN4!pQs6JrYwV9',
  'tB87#kPtkxqOS2',
  'U8v!9xP#2kLmQ7'
];

function makeSign(paramsObj, secret) {
  const sortedKeys = Object.keys(paramsObj).sort();
  const raw = sortedKeys.map(k => `${k}=${paramsObj[k]}`).join('&') + secret;
  return crypto.createHash('md5').update(raw).digest('hex');
}

async function callUpstream(path, baseParams) {
  for (const baseUrl of ENDPOINTS) {
    for (const secret of SALTS) {
      const time = Date.now();
      const params = { ...baseParams, time };
      const sign = makeSign(params, secret);
      const bodyObj = { ...params, sign };

      for (const mode of ['json', 'form']) {
        try {
          const headers = {
            'Accept': 'application/json, text/plain, */*',
            'Origin': baseUrl.replace('/api', ''),
            'Referer': baseUrl.replace('/api', '/'),
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
          };
          let body;
          if (mode === 'json') {
            headers['Content-Type'] = 'application/json';
            body = JSON.stringify(bodyObj);
          } else {
            headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
            body = new URLSearchParams(Object.entries(bodyObj).map(([k, v]) => [k, String(v)])).toString();
          }

          const res = await fetch(`${baseUrl}/${path}`, { method: 'POST', headers, body });
          const text = await res.text();
          if (text && text.trim().startsWith('{')) {
            const json = JSON.parse(text);
            if (json.code === 0 || json.err_code === 20000 || json.data || (json.msg && !String(json.msg).toLowerCase().includes('sign'))) {
              return { ok: true, data: json, via: `${baseUrl} (${mode})` };
            }
          }
        } catch (e) {}
      }
    }
  }
  return { ok: false, error: 'Upstream WAF or signature blocked' };
}

exports.handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    const req = JSON.parse(event.body || '{}');
    const action = req.action || 'player';
    const fid = String(req.fid || '').trim();
    if (!fid) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ ok: false, error: 'Missing fid' }) };
    }

    if (action === 'player') {
      const result = await callUpstream('player', { fid });
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(result) };
    }

    if (action === 'redeem') {
      const cdk = String(req.cdk || '').trim();
      if (!cdk) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ ok: false, error: 'Missing cdk' }) };
      }
      await callUpstream('player', { fid });
      const result = await callUpstream('gift_code', { fid, cdk });
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(result) };
    }

    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ ok: false, error: 'Invalid action' }) };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
