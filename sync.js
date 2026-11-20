const crypto = require('crypto');

const SUPABASE_URL = 'https://soyodukrsykhgsufwtth.supabase.co';
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_KEY || '').trim();
const SALTS = ['tB87#kPtkxqOS2', 'mN4!pQs6JrYwV9', 'U8v!9xP#2kLmQ7'];

function sbHeaders(extra = {}) {
  const h = { apikey: SERVICE_KEY, 'Content-Type': 'application/json', ...extra };
  if (SERVICE_KEY && !SERVICE_KEY.startsWith('sb_')) h.Authorization = `Bearer ${SERVICE_KEY}`;
  return h;
}

async function fetchPlayer(fid) {
  for (const secret of SALTS) {
    const time = Date.now();
    const sign = crypto.createHash('md5').update(`fid=${fid}&time=${time}${secret}`).digest('hex');
    const res = await fetch('https://kingshot-giftcode.centurygame.com/api/player', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Origin': 'https://kingshot-giftcode.centurygame.com',
        'Referer': 'https://kingshot-giftcode.centurygame.com/',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15'
      },
      body: new URLSearchParams({ fid: String(fid), time: String(time), sign }).toString()
    });
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      if (json?.code === 0 && json?.data) return json.data;
      console.log(`Salt [${secret.slice(0,4)}] resp:`, text.slice(0, 120));
    } catch (e) {}
  }
  return null;
}

async function run() {
  const listRes = await fetch(`${SUPABASE_URL}/rest/v1/players?select=fid`, { headers: sbHeaders() });
  const players = await listRes.json();
  console.log('Target players:', players.length);

  for (const p of players) {
    const info = await fetchPlayer(p.fid);
    console.log('Result:', p.fid, info ? `${info.nickname} (Kid:${info.kid}, Lv:${info.stove_lv})` : 'skipped');
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

run().catch(err => { console.error(err); process.exit(1); });
