(function () {
'use strict';
var C = window.HQCore;
var QB = C.expand(window.QB);
var BYID = {}; QB.forEach(function (q) { BYID[q.id] = q; });
var BYCH = {}; QB.forEach(function (q) { (BYCH[q.ch] = BYCH[q.ch] || []).push(q); });
var KEY = 'hq.v1';
var INTERVAL = [0, 1, 3, 7, 14, 30]; // days per Leitner box
var SESSION_N = 10;

/* ---------- storage (safe) ---------- */
var mem = null;
function pad(n) { return (n < 10 ? '0' : '') + n; }
function isoOf(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function today() { return isoOf(new Date()); }
function load() {
  var s = null;
  try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
  if (!s) s = mem;
  if (!s) s = { start: today(), from: 8, to: 22, cards: {}, log: {}, keys: null, sub: null };
  return s;
}
var S = load();
function save() { mem = S; try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
save();

/* ---------- helpers ---------- */
function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function $(s, r) { return (r || document).querySelector(s); }
function todayCh() { return C.chapterFor(S.start, today()); }
function card(id) { return S.cards[id] || (S.cards[id] = { b: 0, d: 0, s: 0, c: 0 }); }
function isDue(id) { var c = S.cards[id]; return c && c.b > 0 && c.d <= Date.now(); }
function dueIds() { return Object.keys(S.cards).filter(isDue); }
function todayLog() { return S.log[today()] || { n: 0, c: 0 }; }
function streak() {
  var n = 0, d = new Date();
  if (!S.log[isoOf(d)]) d.setDate(d.getDate() - 1);
  while (S.log[isoOf(d)] && S.log[isoOf(d)].n > 0) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
var toastT;
function toast(t) {
  var el = document.createElement('div'); el.className = 'toast'; el.textContent = t; document.body.appendChild(el);
  clearTimeout(toastT); toastT = setTimeout(function () { el.remove(); }, 2600);
}
var ICON = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>',
  stats: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  set: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/></svg>',
  table: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10"/></svg>',
  drop: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5S5 10 5 14.5a7 7 0 0014 0C19 10 12 2.5 12 2.5z"/></svg>'
};

/* ---------- state ---------- */
var view = 'home';
var quiz = null; // {queue:[ids], i, first:{}, wrong:[], title, single}

/* ---------- session building ---------- */
function buildSession(n) {
  var ch = todayCh();
  var due = C.shuffle(dueIds().filter(function (id) { return BYID[id].ch !== ch; }), Math.random).slice(0, 3);
  var pool = (BYCH[ch] || []).slice();
  pool.sort(function (a, b) {
    var ca = S.cards[a.id], cb = S.cards[b.id];
    var ra = ca ? (ca.b === 0 ? 0 : 1 + ca.b) : -1, rb = cb ? (cb.b === 0 ? 0 : 1 + cb.b) : -1; // unseen first, then low box
    return ra - rb || Math.random() - .5;
  });
  var picks = pool.slice(0, n - due.length).map(function (q) { return q.id; });
  var ids = due.concat(picks);
  if (ids.length < n) { // fill from any due / random
    var extra = C.shuffle(QB.map(function (q) { return q.id; }).filter(function (id) { return ids.indexOf(id) < 0; }), Math.random);
    ids = ids.concat(extra.slice(0, n - ids.length));
  }
  return C.shuffle(ids, Math.random);
}
function startQuiz(ids, title, single, key) {
  if (!ids.length) { toast('No questions here'); return; }
  quiz = { queue: ids.slice(), i: 0, first: {}, wrong: [], title: title, single: !!single, cur: null, key: key || null };
  view = 'quiz'; nextQ();
}
/* ---------- saved sessions: continue where you stopped ---------- */
function todayKey() { return 'today:' + today(); }
function saved(key) { var s = S.sess && S.sess[key]; return s && s.i < s.queue.length ? s : null; }
function persist() {
  if (!quiz || !quiz.key) return;
  S.sess = S.sess || {};
  Object.keys(S.sess).forEach(function (k) { if (k.indexOf('today:') === 0 && k !== todayKey()) delete S.sess[k]; });
  var resumeAt = quiz.cur && quiz.cur.chosen !== null ? quiz.i + 1 : quiz.i; // an answered question is not asked again
  if (resumeAt >= quiz.queue.length) delete S.sess[quiz.key];
  else S.sess[quiz.key] = { queue: quiz.queue, i: resumeAt, first: quiz.first, wrong: quiz.wrong, title: quiz.title };
  save();
}
function resumeOrStart(key, makeIds, title) {
  var s = saved(key);
  if (!s) { startQuiz(makeIds(), title, false, key); return; }
  quiz = { queue: s.queue.slice(), i: s.i, first: s.first || {}, wrong: s.wrong || [], title: s.title, single: false, cur: null, key: key };
  view = 'quiz'; nextQ(); toast('Continuing from question ' + (s.i + 1));
}
function chapterIds(ch) { return C.shuffle((BYCH[ch] || []).map(function (q) { return q.id; }), Math.random); }
function makerFor(key) {
  if (key.indexOf('ch:') === 0) { var ch = +key.slice(3); return function () { return chapterIds(ch); }; }
  return function () { return buildSession(SESSION_N); };
}
function nextQ() {
  if (quiz.i >= quiz.queue.length) {
    if (quiz.key && S.sess) { delete S.sess[quiz.key]; save(); }
    view = 'done'; render(); return;
  }
  var q = BYID[quiz.queue[quiz.i]];
  var opts = C.shuffle([{ t: q.a, ok: true }].concat(q.w.map(function (t) { return { t: t, ok: false }; })), Math.random);
  quiz.cur = { q: q, opts: opts, chosen: null, rated: false };
  persist(); render(); window.scrollTo(0, 0);
}
function onAnswer(idx) {
  var cur = quiz.cur; if (cur.chosen !== null) return;
  cur.chosen = idx;
  var ok = cur.opts[idx].ok, q = cur.q, c = card(q.id);
  var firstTry = !quiz.first.hasOwnProperty(q.id);
  if (firstTry) {
    quiz.first[q.id] = ok;
    c.s++; if (ok) c.c++;
    var L = S.log[today()] || (S.log[today()] = { n: 0, c: 0 }); L.n++; if (ok) L.c++;
    cur.prev = c.b;
    c.b = ok ? Math.min(5, c.b + 1) : 1;
    c.d = Date.now() + (INTERVAL[c.b] || 1) * 86400000;
    if (!ok) { quiz.wrong.push(q.id); }
  }
  if (!ok && quiz.queue.indexOf(q.id, quiz.i + 1) < 0) quiz.queue.push(q.id); // see it again at the end
  save(); persist(); render();
}
function onRate(kind) { // 'easy' | 'hard' (only after correct first try)
  var cur = quiz.cur; if (cur.rated) return; cur.rated = true;
  var c = card(cur.q.id);
  if (quiz.first[cur.q.id] === true && cur.prev !== undefined) {
    if (kind === 'hard') { c.b = Math.max(1, cur.prev); c.d = Date.now() + (INTERVAL[c.b] || 1) * 86400000; }
    if (kind === 'easy') { c.b = Math.min(5, cur.prev + 2); c.d = Date.now() + (INTERVAL[c.b] || 1) * 86400000; }
  }
  save(); quiz.i++; nextQ();
}
function onNext() { quiz.i++; nextQ(); }

/* ---------- views ---------- */
function topbar() {
  var st = streak();
  return '<div class="top"><div class="brand"><span class="drop">' + ICON.drop + '</span><span class="en">Hematology Quiz</span></div>' +
    '<span class="chip">🔥 ' + st + ' <span class="small mute">day streak</span></span></div>';
}
function vHome() {
  var ch = todayCh(), list = BYCH[ch] || [], seen = list.filter(function (q) { return S.cards[q.id] && S.cards[q.id].s > 0; }).length;
  var due = dueIds().length, tl = todayLog(), goal = Math.max(1, S.to - S.from + 1);
  var h = topbar();
  h += '<div class="card today"><div class="kicker">TODAY · DAY ' + (C.dayIndex(S.start, today()) + 1) + '</div>' +
    '<h2 class="en">Chapter ' + ch + '</h2><div class="en mute">' + esc(C.CHAPTERS[ch]) + '</div>' +
    '<div class="stats"><div class="stat"><b>' + list.length + '</b><span>Questions</span></div>' +
    '<div class="stat"><b>' + seen + '</b><span>Seen</span></div>' +
    '<div class="stat"><b>' + tl.n + '</b><span>Answered today</span></div></div>' +
    (function () { var s = saved(todayKey()); return '<button class="btn primary" data-act="session">' + (s ? 'Continue today\'s quiz (' + (s.i + 1) + '/' + s.queue.length + ')' : 'Start today\'s quiz (' + SESSION_N + ' questions)') + '</button>'; })() +
    '<div class="row"><button class="btn" data-act="due"' + (due ? '' : ' disabled') + '>Review due (' + due + ')</button>' +
    '<button class="btn" data-act="chall" data-ch="' + ch + '">' + (saved('ch:' + ch) ? 'Continue chapter (' + (saved('ch:' + ch).i + 1) + '/' + saved('ch:' + ch).queue.length + ')' : 'Whole chapter (' + list.length + ')') + '</button></div></div>';
  h += '<h3 style="margin:18px 2px 10px">All chapters</h3><div class="grid">';
  for (var c = 1; c <= C.NCH; c++) {
    var L = BYCH[c] || [], sn = L.filter(function (q) { return S.cards[q.id] && S.cards[q.id].s > 0; }).length;
    h += '<button class="ch' + (c === ch ? ' now' : '') + '" data-act="chall" data-ch="' + c + '"><span class="n">CH ' + c + '</span><span class="t">' + esc(C.CHAPTERS[c]) + '</span>' +
      '<div class="bar"><i style="width:' + Math.round(100 * sn / L.length) + '%"></i></div><span class="small mute en">' + sn + ' / ' + L.length +
      (saved('ch:' + c) ? ' · <b class="resume">▶ Q' + (saved('ch:' + c).i + 1) + '</b>' : '') + '</span></button>';
  }
  return h + '</div>';
}
function vQuiz() {
  var cur = quiz.cur, q = cur.q, total = quiz.queue.length, answered = cur.chosen !== null;
  var h = '<div class="qhead"><button class="x" data-act="quit" aria-label="Close">✕</button>' +
    '<div class="prog"><div class="bar"><i style="width:' + Math.round(100 * quiz.i / total) + '%"></i></div></div>' +
    '<span class="small mute en">' + (quiz.i + 1) + '/' + total + '</span>' +
    (quiz.key ? '<button class="x" data-act="restart" aria-label="Restart" title="Restart">↺</button>' : '') + '</div>' +
    '<div class="card"><span class="tag">CH ' + q.ch + ' · Table ' + esc(q.tbl) + '</span>' +
    '<div class="qtext en">' + esc(q.q) + '</div>';
  var L = 'ABCD';
  cur.opts.forEach(function (o, i) {
    var cls = '';
    if (answered) { if (o.ok) cls = ' ok'; else if (i === cur.chosen) cls = ' bad'; }
    h += '<button class="opt' + cls + '" data-act="opt" data-i="' + i + '"' + (answered ? ' disabled' : '') + '><span class="k">' + L[i] + '</span><span>' + esc(o.t) + '</span></button>';
  });
  if (answered) {
    var ok = cur.opts[cur.chosen].ok;
    h += '<div class="fb ' + (ok ? 'ok' : 'bad') + '"><h3>' + (ok ? 'Correct ✓' : 'Incorrect ✗') + '</h3>' +
      '<div class="ans">' + esc(q.a) + '</div><div class="exp">' + esc(q.e) + '</div>' +
      '<button class="tblbtn" data-act="table" data-t="' + esc(q.tbl) + '">' + ICON.table + ' Show Table ' + esc(q.tbl) + '</button></div>';
    if (ok && quiz.first[q.id] === true) {
      h += '<div class="rate"><button class="btn" data-act="rate" data-k="hard">Unsure</button><button class="btn primary" data-act="rate" data-k="easy">Easy</button></div>';
    } else {
      h += '<button class="btn primary" data-act="next">' + (quiz.i + 1 >= quiz.queue.length ? 'Finish' : 'Next') + '</button>';
    }
  }
  return h + '</div>';
}
function vDone() {
  var ids = Object.keys(quiz.first), ok = ids.filter(function (id) { return quiz.first[id]; }).length;
  var h = '<div class="card" style="margin-top:20px"><div class="kicker">' + esc(quiz.title) + '</div><h2>Quiz complete</h2>' +
    '<div class="big en">' + ok + ' / ' + ids.length + '</div><div class="bar ok"><i style="width:' + (ids.length ? Math.round(100 * ok / ids.length) : 0) + '%"></i></div>';
  if (quiz.wrong.length) {
    h += '<h3 style="margin:18px 0 4px">Your mistakes</h3>';
    quiz.wrong.forEach(function (id) { var q = BYID[id]; h += '<div class="miss en"><div>' + esc(q.q) + '</div><div class="a">' + esc(q.a) + '</div></div>'; });
  }
  if (!quiz.single) h += '<button class="btn primary" data-act="newsession">Another 10 questions</button>';
  else h += '<button class="btn primary" data-act="session">Continue with today\'s quiz</button>';
  return h + '<button class="btn" data-act="home">Back to home</button></div>';
}
function vStats() {
  var ids = Object.keys(S.cards), tot = ids.length, s = 0, c = 0, mast = 0;
  ids.forEach(function (id) { var k = S.cards[id]; s += k.s; c += k.c; if (k.b >= 4) mast++; });
  var h = topbar() + '<div class="card"><div class="stats" style="margin-top:0">' +
    '<div class="stat"><b>' + (s ? Math.round(100 * c / s) : 0) + '%</b><span>Accuracy</span></div>' +
    '<div class="stat"><b>' + tot + '/' + QB.length + '</b><span>Seen</span></div>' +
    '<div class="stat"><b>' + mast + '</b><span>Mastered</span></div></div>' +
    '<div class="small mute">Answers per day, last 14 days</div><div class="bars">';
  var mx = 1, days = [];
  for (var i = 13; i >= 0; i--) { var d = new Date(); d.setDate(d.getDate() - i); var n = (S.log[isoOf(d)] || { n: 0 }).n; days.push(n); if (n > mx) mx = n; }
  days.forEach(function (n) { h += '<i class="' + (n ? '' : 'z') + '" style="height:' + Math.max(4, Math.round(100 * n / mx)) + '%" title="' + n + '"></i>'; });
  h += '</div></div><div class="card"><h3>By chapter</h3>';
  for (var ch = 1; ch <= C.NCH; ch++) {
    var L = BYCH[ch] || [], ss = 0, cc = 0, sn = 0;
    L.forEach(function (q) { var k = S.cards[q.id]; if (k) { ss += k.s; cc += k.c; if (k.s) sn++; } });
    var p = ss ? Math.round(100 * cc / ss) : null;
    h += '<div class="lrow"><span class="nm">' + ch + '. ' + esc(C.CHAPTERS[ch]) + '</span><div class="bar ok"><i style="width:' + (p || 0) + '%"></i></div>' +
      '<span class="pct en' + (p !== null && p < 70 && ss >= 5 ? ' weak' : '') + '">' + (p === null ? '–' : p + '%') + '</span></div>';
  }
  return h + '</div>';
}
function hoursOpts(sel) { var h = ''; for (var i = 0; i < 24; i++) h += '<option value="' + i + '"' + (i === sel ? ' selected' : '') + '>' + pad(i) + ':00</option>'; return h; }
function vSettings() {
  var chOpts = ''; for (var c = 1; c <= C.NCH; c++) chOpts += '<option value="' + c + '"' + (c === todayCh() ? ' selected' : '') + '>Chapter ' + c + ' — ' + esc(C.CHAPTERS[c]) + '</option>';
  var perm = ('Notification' in window) ? Notification.permission : 'unsupported';
  var cfg = S.keys && S.sub ? JSON.stringify(makeConfig()) : '';
  var h = topbar() + '<div class="card"><h3>Study plan</h3>' +
    '<label>Today\'s chapter</label><select id="setCh" class="en">' + chOpts + '</select>' +
    '<div class="small mute">Moves to the next chapter each day (1 → ' + C.NCH + ', then repeats).</div>' +
    '<label>Start date</label><input type="date" id="setStart" value="' + S.start + '">' +
    '<div class="two"><div><label>First notification</label><select id="setFrom" class="en">' + hoursOpts(S.from) + '</select></div>' +
    '<div><label>Last notification</label><select id="setTo" class="en">' + hoursOpts(S.to) + '</select></div></div>' +
    '<button class="btn primary" data-act="saveset">Save</button></div>';
  h += '<div class="card"><h3>Hourly notifications</h3>' +
    '<div class="small mute">Permission: <b>' + perm + '</b> · Keys: <b>' + (S.keys ? 'ready' : 'none') + '</b> · Subscription: <b>' + (S.sub ? 'ready' : 'none') + '</b></div>' +
    '<ol class="steps"><li>Generate keys</li><li>Enable notifications (tap Allow)</li><li>Copy CONFIG and save it as a GitHub secret (see README)</li></ol>' +
    '<button class="btn" data-act="genkeys">1. Generate keys</button>' +
    '<button class="btn" data-act="subscribe"' + (S.keys ? '' : ' disabled') + '>2. Enable notifications</button>' +
    '<button class="btn" data-act="copycfg"' + (cfg ? '' : ' disabled') + '>3. Copy CONFIG</button>' +
    '<button class="btn ghost" data-act="testnotif">Send a test notification</button>' +
    (cfg ? '<label>CONFIG</label><textarea id="cfgBox" readonly>' + esc(cfg) + '</textarea>' : '') +
    '<div class="note">CONFIG contains a private key. Only paste it into a GitHub secret and don\'t share it.</div></div>';
  h += '<div class="card"><h3>Table images</h3><div class="small mute">' +
    (S.tables ? '<b>' + S.tables + ' tables</b> saved on this phone.' : 'Not imported yet. Import the <b>hemequiz-tables.json</b> file once to see the original table after each answer.') + '</div>' +
    '<input type="file" id="tblFile" accept=".json,application/json" hidden>' +
    '<button class="btn" data-act="importtbl">' + (S.tables ? 'Re-import tables file' : 'Import tables file') + '</button>' +
    (S.tables ? '<button class="btn ghost" data-act="cleartbl">Remove table images</button>' : '') + '</div>';
  h += '<div class="card"><h3>Data</h3><div class="small mute">Your progress is saved only on this phone.</div>' +
    '<button class="btn ghost" data-act="reset" style="color:var(--bad)">Reset all progress</button></div>';
  return h;
}
function nav() {
  var items = [['home', 'Home', ICON.home], ['stats', 'Stats', ICON.stats], ['settings', 'Settings', ICON.set]];
  return '<nav class="tabs"><div class="in">' + items.map(function (it) { return '<button class="' + (view === it[0] ? 'on' : '') + '" data-act="tab" data-v="' + it[0] + '">' + it[2] + '<span>' + it[1] + '</span></button>'; }).join('') + '</div></nav>';
}
function render() {
  var h;
  if (view === 'quiz') h = vQuiz(); else if (view === 'done') h = vDone();
  else if (view === 'stats') h = vStats(); else if (view === 'settings') h = vSettings(); else h = vHome();
  $('#app').innerHTML = '<div class="wrap">' + h + '</div>' + ((view === 'quiz' || view === 'done') ? '' : nav());
}

/* ---------- notifications ---------- */
function b64u(buf) { var s = ''; new Uint8Array(buf).forEach(function (b) { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function fromB64u(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; var r = atob(s), a = new Uint8Array(r.length); for (var i = 0; i < r.length; i++) a[i] = r.charCodeAt(i); return a; }
function makeConfig() {
  return { sub: S.sub, pub: S.keys.pub, priv: S.keys.priv, start: S.start, from: S.from, to: S.to, tz: -new Date().getTimezoneOffset(), origin: location.origin + location.pathname.replace(/[^/]*$/, '') };
}
async function genKeys() {
  var kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  var pub = await crypto.subtle.exportKey('raw', kp.publicKey);
  var jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
  try { var reg = await navigator.serviceWorker.getRegistration(); var old = reg && await reg.pushManager.getSubscription(); if (old) await old.unsubscribe(); } catch (e) {}
  S.keys = { pub: b64u(pub), priv: jwk.d }; S.sub = null; save();
}
async function subscribe() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) { toast('This browser does not support push'); return; }
  var p = await Notification.requestPermission();
  if (p !== 'granted') { toast('Permission was not granted'); render(); return; }
  var reg = await navigator.serviceWorker.ready;
  var sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromB64u(S.keys.pub) });
  S.sub = sub.toJSON(); save(); toast('Notifications enabled ✓'); render();
}
async function testNotif() {
  if (!('Notification' in window) || Notification.permission !== 'granted') { toast('Allow notifications first'); return; }
  var q = C.pickForSlot(QB, S.start, today(), new Date().getHours(), S.from);
  var reg = await navigator.serviceWorker.ready;
  reg.showNotification('Hematology quiz · CH ' + q.ch, { body: q.q, icon: 'icon-192.png', badge: 'badge-96.png', tag: 'hq', data: { id: q.id } });
}

/* ---------- table images (IndexedDB, stay on this device) ---------- */
var TDB = null;
function tdb() {
  return TDB || (TDB = new Promise(function (res, rej) {
    var r = indexedDB.open('hq-tables', 1);
    r.onupgradeneeded = function () { r.result.createObjectStore('img'); };
    r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); };
  }));
}
function tget(id) {
  return tdb().then(function (db) { return new Promise(function (res, rej) {
    var q = db.transaction('img').objectStore('img').get(id); q.onsuccess = function () { res(q.result); }; q.onerror = function () { rej(q.error); };
  }); });
}
function twrite(map) { // map: id -> Blob, or null to clear
  return tdb().then(function (db) { return new Promise(function (res, rej) {
    var tx = db.transaction('img', 'readwrite'), st = tx.objectStore('img'); st.clear();
    if (map) Object.keys(map).forEach(function (k) { st.put(map[k], k); });
    tx.oncomplete = function () { res(); }; tx.onerror = function () { rej(tx.error); };
  }); });
}
async function importTables(file) {
  toast('Importing tables…');
  var data = JSON.parse(await file.text());
  if (!data || data.format !== 'hemequiz-tables' || !data.tables) throw new Error('This is not the tables file');
  var map = {}, ids = Object.keys(data.tables);
  for (var i = 0; i < ids.length; i++) map[ids[i]] = await (await fetch(data.tables[ids[i]])).blob();
  await twrite(map);
  S.tables = ids.length; save(); render(); toast(ids.length + ' tables imported ✓');
}
var modalUrl = null;
function closeModal(fromPop) {
  var m = $('.modal'); if (!m) return;
  m.remove(); if (modalUrl) { URL.revokeObjectURL(modalUrl); modalUrl = null; }
  document.body.style.overflow = '';
  if (!fromPop && history.state && history.state.hqModal) history.back();
}
function showTable(id) {
  tget(id).catch(function () { return null; }).then(function (blob) {
    var body;
    if (blob) { modalUrl = URL.createObjectURL(blob); body = '<img src="' + modalUrl + '" alt="Table ' + esc(id) + '">'; }
    else body = '<div class="mempty">Table images are not on this phone yet.<br><br>Go to <b>Settings → Table images → Import tables file</b> and choose <b>hemequiz-tables.json</b>.</div>';
    var m = document.createElement('div'); m.className = 'modal';
    m.innerHTML = '<div class="mbar"><b>Table ' + esc(id) + '</b><span>' + (blob ? '<button data-act="zoom">Zoom</button>' : '') + '<button data-act="closetbl" aria-label="Close">✕</button></span></div><div class="mbody">' + body + '</div>';
    document.body.appendChild(m); document.body.style.overflow = 'hidden';
    try { history.pushState({ hqModal: 1 }, ''); } catch (e) {}
  });
}
window.addEventListener('popstate', function () { closeModal(true); });
document.addEventListener('change', function (e) {
  if (e.target.id === 'tblFile' && e.target.files[0]) importTables(e.target.files[0]).catch(function (err) { toast('Import failed: ' + err.message); });
});

/* ---------- events ---------- */
document.addEventListener('click', function (e) {
  var t = e.target.closest('[data-act]'); if (!t) return;
  var a = t.dataset.act;
  if (a === 'tab') { view = t.dataset.v; render(); window.scrollTo(0, 0); }
  else if (a === 'home') { view = 'home'; render(); }
  else if (a === 'session') resumeOrStart(todayKey(), makerFor(todayKey()), 'Today\'s quiz');
  else if (a === 'newsession') startQuiz(buildSession(SESSION_N), 'Today\'s quiz', false, todayKey());
  else if (a === 'restart') { if (!confirm('Start this session again from question 1?')) return; startQuiz(makerFor(quiz.key)(), quiz.title, false, quiz.key); toast('Restarted'); }
  else if (a === 'due') startQuiz(C.shuffle(dueIds(), Math.random).slice(0, 20), 'Review');
  else if (a === 'chall') { var ch = +t.dataset.ch; resumeOrStart('ch:' + ch, makerFor('ch:' + ch), 'Chapter ' + ch); }
  else if (a === 'opt') onAnswer(+t.dataset.i);
  else if (a === 'rate') onRate(t.dataset.k);
  else if (a === 'next') onNext();
  else if (a === 'quit') { if (quiz && !quiz.key && quiz.i > 0 && !confirm('Quit this quiz?')) return; if (quiz && quiz.key) persist(); view = 'home'; render(); }
  else if (a === 'saveset') {
    var chosen = +$('#setCh').value, st = $('#setStart').value || today();
    if (chosen !== todayCh()) { var d = new Date(); d.setDate(d.getDate() - (chosen - 1)); st = isoOf(d); }
    S.start = st; S.from = +$('#setFrom').value; S.to = +$('#setTo').value; if (S.to < S.from) S.to = S.from;
    save(); toast('Saved ✓'); render();
  }
  else if (a === 'genkeys') { genKeys().then(function () { toast('Keys generated ✓'); render(); }).catch(function () { toast('Could not generate keys'); }); }
  else if (a === 'subscribe') { subscribe().catch(function (err) { toast('Error: ' + err.message); }); }
  else if (a === 'copycfg') {
    var txt = JSON.stringify(makeConfig());
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () { toast('Copied ✓'); }, function () { var b = $('#cfgBox'); if (b) { b.select(); document.execCommand('copy'); toast('Copied ✓'); } });
  }
  else if (a === 'testnotif') testNotif();
  else if (a === 'table') showTable(t.dataset.t);
  else if (a === 'closetbl') closeModal(false);
  else if (a === 'zoom') { var mb = $('.mbody'); mb.classList.toggle('z'); t.textContent = mb.classList.contains('z') ? 'Fit' : 'Zoom'; }
  else if (a === 'importtbl') $('#tblFile').click();
  else if (a === 'cleartbl') { if (confirm('Remove table images from this phone?')) twrite(null).then(function () { S.tables = 0; save(); render(); toast('Removed'); }); }
  else if (a === 'reset') { if (confirm('All progress will be erased. Are you sure?')) { S.cards = {}; S.log = {}; save(); render(); toast('Progress reset'); } }
});

/* ---------- boot ---------- */
function openId(id) { if (BYID[id]) startQuiz([id], 'Notification question', true); }
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(function () {});
  navigator.serviceWorker.addEventListener('message', function (e) { if (e.data && e.data.type === 'open-q') openId(e.data.id); });
}
render();
var qp = new URLSearchParams(location.search).get('q');
if (qp) { openId(qp); try { history.replaceState(null, '', location.pathname); } catch (e) {} }
window.__hq = { QB: QB, S: function () { return S; } };
})();
