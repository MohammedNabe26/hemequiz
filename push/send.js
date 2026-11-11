// Runs hourly in GitHub Actions. Sends one question notification to every
// configured device: HEMEQUIZ_CONFIG (Android) and HEMEQUIZ_CONFIG_2 (iPhone).
const webpush = require('web-push');
const Core = require('../core.js');
const QB = Core.expand(require('../questions.js'));

const devices = [['HEMEQUIZ_CONFIG', process.env.HEMEQUIZ_CONFIG], ['HEMEQUIZ_CONFIG_2', process.env.HEMEQUIZ_CONFIG_2]]
  .filter(d => d[1] && d[1].trim());
if (!devices.length) { console.log('No HEMEQUIZ_CONFIG secrets set yet - nothing to send.'); process.exit(0); }
const pad = n => (n < 10 ? '0' : '') + n;

async function sendTo(name, raw) {
  let cfg;
  try { cfg = JSON.parse(raw); } catch (e) { console.error(name + ': not valid JSON'); return false; }
  const local = new Date(Date.now() + cfg.tz * 60000); // user's local time
  const todayISO = local.getUTCFullYear() + '-' + pad(local.getUTCMonth() + 1) + '-' + pad(local.getUTCDate());
  const hour = local.getUTCHours();
  if (process.env.FORCE !== '1' && (hour < cfg.from || hour > cfg.to)) {
    console.log(`${name}: local hour ${hour} is outside ${cfg.from}-${cfg.to}; skipping.`); return true;
  }
  const q = Core.pickForSlot(QB, cfg.start, todayISO, hour, cfg.from);
  const payload = JSON.stringify({ title: `Hematology quiz · CH ${q.ch}`, body: q.q, id: q.id });
  let subject = 'https://github.com';
  try { if (cfg.origin.startsWith('https://')) subject = new URL(cfg.origin).origin; } catch (e) {}
  try {
    const r = await webpush.sendNotification(cfg.sub, payload, {
      TTL: 3300, urgency: 'high',
      vapidDetails: { subject, publicKey: cfg.pub, privateKey: cfg.priv }
    });
    console.log(`${name}: Sent ${q.id} status ${r.statusCode}`); return true;
  } catch (e) {
    console.error(`${name}: Push failed`, e.statusCode, e.body); return false;
  }
}

(async () => {
  let ok = true;
  for (const [name, raw] of devices) ok = (await sendTo(name, raw)) && ok;
  if (!ok) process.exit(1);
})();
