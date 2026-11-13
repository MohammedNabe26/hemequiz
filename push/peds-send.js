// Runs every 30 min in GitHub Actions. Sends the scheduled Pediatrics MCQ question
// number to every phone saved as PEDS_CONFIG, PEDS_CONFIG_2, PEDS_CONFIG_3.
const webpush = require('web-push');
const names = ['PEDS_CONFIG', 'PEDS_CONFIG_2', 'PEDS_CONFIG_3'];
const devices = names.map(n => [n, process.env[n]]).filter(d => d[1] && d[1].trim());
if (!devices.length) { console.log('No PEDS_CONFIG secrets yet - nothing to send.'); process.exit(0); }

function slotFor(cfg, nowMs) {
  const local = new Date(nowMs + cfg.tz * 60000);              // phone's local time (read with UTC getters)
  const m = local.getUTCHours() * 60 + local.getUTCMinutes();
  if (m < cfg.f || m > cfg.t + cfg.e - 1) return null;          // outside active hours
  const slot = Math.floor((m - cfg.f) / cfg.e);
  if (cfg.f + slot * cfg.e > cfg.t) return null;
  const [y, mo, d] = cfg.d.split('-').map(Number);
  const day = Math.round((Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - Date.UTC(y, mo - 1, d)) / 864e5);
  if (day < 0) return null;                                     // schedule not started yet
  const perDay = Math.floor((cfg.t - cfg.f) / cfg.e) + 1;
  return (cfg.q + day * perDay + slot) % cfg.N;                 // 0-based position in the fixed order
}

async function sendTo(name, raw) {
  let cfg; try { cfg = JSON.parse(raw); } catch (e) { console.error(name + ': not valid JSON'); return false; }
  let p = slotFor(cfg, Date.now());
  if (p === null) { if (process.env.FORCE !== '1') { console.log(name + ': outside active hours; skipping.'); return true; } p = cfg.q; }
  const n = p + 1;
  const payload = JSON.stringify({ title: 'Peds MCQ · Q' + n, body: 'Question ' + n + ' is ready — tap to answer.', q: n });
  let subject = 'https://github.com'; try { if (cfg.origin.startsWith('https://')) subject = new URL(cfg.origin).origin; } catch (e) {}
  try {
    const r = await webpush.sendNotification(cfg.sub, payload, { TTL: 1700, urgency: 'high', vapidDetails: { subject, publicKey: cfg.pub, privateKey: cfg.priv } });
    console.log(`${name}: sent Q${n} (${r.statusCode})`); return true;
  } catch (e) { console.error(`${name}: push failed`, e.statusCode, e.body); return false; }
}
module.exports = { slotFor };
if (require.main === module) (async () => { let ok = true; for (const [n, raw] of devices) ok = (await sendTo(n, raw)) && ok; if (!ok) process.exit(1); })();
