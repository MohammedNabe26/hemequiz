// Runs hourly in GitHub Actions. Sends ONE push notification with a question.
const webpush = require('web-push');
const Core = require('../core.js');
const QB = Core.expand(require('../questions.js'));

const raw = process.env.HEMEQUIZ_CONFIG;
if (!raw) { console.log('Secret HEMEQUIZ_CONFIG is not set yet - nothing to send.'); process.exit(0); }
const cfg = JSON.parse(raw);

// local time of the user (tz = minutes from UTC, sent by the app)
const local = new Date(Date.now() + cfg.tz * 60000);
const pad = n => (n < 10 ? '0' : '') + n;
const todayISO = local.getUTCFullYear() + '-' + pad(local.getUTCMonth() + 1) + '-' + pad(local.getUTCDate());
const hour = local.getUTCHours();

if (process.env.FORCE !== '1' && (hour < cfg.from || hour > cfg.to)) {
  console.log(`Local hour ${hour} is outside ${cfg.from}-${cfg.to}; skipping.`); process.exit(0);
}
const q = Core.pickForSlot(QB, cfg.start, todayISO, hour, cfg.from);
const payload = JSON.stringify({
  title: `Hematology quiz · CH ${q.ch}`,
  body: q.q,
  id: q.id
});
webpush.setVapidDetails(cfg.origin.startsWith('https://') ? cfg.origin : 'https://github.com', cfg.pub, cfg.priv);
webpush.sendNotification(cfg.sub, payload, { TTL: 3300, urgency: 'high' })
  .then(r => console.log('Sent', q.id, 'status', r.statusCode))
  .catch(e => { console.error('Push failed', e.statusCode, e.body); process.exit(1); });
