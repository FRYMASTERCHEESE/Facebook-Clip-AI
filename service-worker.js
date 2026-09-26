const CACHE='facebook-clip-ai-preview-first-v9';
const FILES=[
  './index.html?v=9','./app.js?v=9','./styles.css?v=9','./privacy.html','./terms.html','./data-deletion.html'
];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const u=new URL(event.request.url);if(u.origin!==location.origin)return;
  const fresh=event.request.mode==='navigate'||u.pathname.endsWith('/app.js')||u.pathname.endsWith('/index.html');
  if(fresh){
    event.respondWith(fetch(event.request).then(res=>{const copy=res.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));return res;}).catch(()=>caches.match(event.request)));
    return;
  }
  event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request).then(res=>{const copy=res.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));return res;})));
});
