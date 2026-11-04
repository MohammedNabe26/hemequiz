/* Shared logic: used by the app (browser) and by push/send.js (Node). */
(function (root) {
  'use strict';
  var NCH = 19;
  var CHAPTERS = {
    1: 'Haemopoiesis & growth factors',
    2: 'Blood cells, anaemia & bone marrow',
    3: 'Iron metabolism & hypochromic anaemia',
    4: 'Iron overload & chelation',
    5: 'Megaloblastic anaemia (B12 / folate)',
    6: 'Haemolytic anaemias',
    7: 'Haemoglobinopathies & thalassaemia',
    8: 'White cells (non-malignant)',
    9: 'Lymphocytes & immunity',
    10: 'Spleen',
    11: 'Genetics of haematological neoplasms',
    12: 'Treatment principles & drugs',
    13: 'Acute myeloid leukaemia',
    14: 'Chronic myeloid leukaemia',
    15: 'Myeloproliferative neoplasms',
    16: 'Myelodysplastic syndromes',
    17: 'Acute lymphoblastic leukaemia',
    18: 'Chronic lymphoid leukaemias',
    19: 'Hodgkin lymphoma'
  };

  // Turn the compact array rows into objects with stable ids "chapter.n"
  function expand(rows) {
    var count = {};
    return rows.map(function (r) {
      var ch = r[0];
      count[ch] = (count[ch] || 0) + 1;
      return { id: ch + '.' + count[ch], ch: ch, tbl: r[1], q: r[2], a: r[3], w: [r[4], r[5], r[6]], e: r[7] };
    });
  }

  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rand) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // dates are 'YYYY-MM-DD' strings in the user's local time
  function dayNumber(iso) {
    var p = iso.split('-');
    return Math.floor(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000);
  }
  function dayIndex(startISO, todayISO) { return Math.max(0, dayNumber(todayISO) - dayNumber(startISO)); }
  function chapterFor(startISO, todayISO) { return (dayIndex(startISO, todayISO) % NCH) + 1; }
  function cycleFor(startISO, todayISO) { return Math.floor(dayIndex(startISO, todayISO) / NCH); }

  // Which question is sent for a given local date + hour (deterministic, same in app and server)
  function pickForSlot(QB, startISO, todayISO, hour, fromHour) {
    var ch = chapterFor(startISO, todayISO);
    var cyc = cycleFor(startISO, todayISO);
    var r = rng(hash(todayISO + ':' + hour + ':' + startISO));
    var useToday = r() < 0.7 || (ch === 1 && cyc === 0);
    var pool, k;
    if (useToday) {
      pool = QB.filter(function (q) { return q.ch === ch; });
      pool = shuffle(pool, rng(hash('ch' + ch + ':c' + cyc)));
      k = Math.max(0, hour - fromHour);
      return pool[k % pool.length];
    }
    var chs = [];
    for (var c = 1; c <= NCH; c++) if (c !== ch && (cyc > 0 || c < ch)) chs.push(c);
    var rc = chs[Math.floor(r() * chs.length)];
    pool = QB.filter(function (q) { return q.ch === rc; });
    return pool[Math.floor(r() * pool.length)];
  }

  var api = {
    NCH: NCH, CHAPTERS: CHAPTERS, expand: expand, hash: hash, rng: rng, shuffle: shuffle,
    dayIndex: dayIndex, chapterFor: chapterFor, cycleFor: cycleFor, pickForSlot: pickForSlot
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HQCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
