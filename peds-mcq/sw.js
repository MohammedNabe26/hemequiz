const C='pedsmcq-v2';const F=['./','index.html','manifest.json','icon-192.png','apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(F)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))));self.clients.claim()});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(fetch(e.request).then(r=>{const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp));return r}).catch(()=>caches.match(e.request,{ignoreSearch:true})))});
self.addEventListener('push',e=>{let d={};try{d=e.data.json()}catch(_){d={body:e.data?e.data.text():''}}
e.waitUntil(self.registration.showNotification(d.title||'Peds MCQ',{body:d.body||'Time for a question',icon:'icon-192.png',tag:'peds',renotify:true,data:{q:d.q}}))});
self.addEventListener('notificationclick',e=>{e.notification.close();const q=e.notification.data&&e.notification.data.q;
e.waitUntil((async()=>{const all=await clients.matchAll({type:'window',includeUncontrolled:true});
for(const c of all){if(c.url.startsWith(self.registration.scope)){await c.focus();if(q)c.postMessage({type:'open-q',q});return}}
await clients.openWindow(self.registration.scope+(q?'?q='+q:''))})())});
