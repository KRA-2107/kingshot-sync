const crypto = require('crypto');

const SUPABASE_URL = 'https://soyodukrsykhgsufwtth.supabase.co';
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_KEY || '').trim();
const SECRET = 'mN4!pQs6JrYwV9';

function sbHeaders(extra = {}) {
  const h = {
    apikey: SERVICE_KEY,
    'Content-Type': 'application/json',
    ...extra
  };
  if (SERVICE_KEY && !SERVICE_KEY.startsWith('sb_')) {
    h.Authorization = `Bearer ${SERVICE_KEY}`;
  }
  return h;
}

async function fetchPlayer(fid) {
  const time = Date.now();
  const raw = `fid=${fid}&time=${time}${SECRET}`;
  const sign = crypto.createHash('md5').update(raw).digest('hex');
  const res = await fetch('https://kingshot-giftcode.centurygame.com/api/player', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fid: String(fid), time, sign })
  });
  const json = await res.json();
  return json?.data || null;
}

async function run() {
  if (!SERVICE_KEY) {
    throw new Error('Missing SUPABASE_SERVICE_KEY secret!');
  }

  const listRes = await fetch(`${SUPABASE_URL}/rest/v1/players?select=fid`, {
    headers: sbHeaders()
  });
  const players = await listRes.json();

  if (!Array.isArray(players)) {
    throw new Error('Supabase response error: ' + JSON.stringify(players));
  }
  console.log('Target players:', players.length);

  for (const p of players) {
    const info = await fetchPlayer(p.fid);
    console.log('Fetched:', p.fid, info ? info.nickname : 'no data');
    if (info) {
      await fetch(`${SUPABASE_URL}/rest/v1/players?fid=eq.${p.fid}`, {
        method: 'PATCH',
        headers: sbHeaders(),
        body: JSON.stringify({
          nickname: info.nickname,
          kid: info.kid,
          stove_lv: info.stove_lv,
          avatar_image: info.avatar_image,
          updated_at: new Date().toISOString()
        })
      });
    }
    await new Promise(r => setTimeout(r, 800));
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
