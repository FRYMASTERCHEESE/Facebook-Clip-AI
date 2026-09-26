const CACHE='facebook-clip-ai-free-director-v4';
const FILES=[
  './styles.css?v=4',
  './app.js?v=4',
  './ffmpeg-worker.js',
  './privacy.html',
  './terms.html',
  './data-deletion.html'
];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(c=>c.addAll(FILES))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  const u=new URL(event.request.url);
  if(u.origin!==location.origin) return;

  const freshFirst =
    event.request.mode==='navigate' ||
    u.pathname.endsWith('/app.js') ||
    u.pathname.endsWith('/index.html') ||
    u.pathname.endsWith('/ffmpeg-worker.js');

  if(freshFirst){
    event.respondWith(
      fetch(event.request)
        .then(res=>{
          const copy=res.clone();
          caches.open(CACHE).then(c=>c.put(event.request,copy));
          return res;
        })
        .catch(()=>caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(hit=>hit||fetch(event.request).then(res=>{
      const copy=res.clone();
      caches.open(CACHE).then(c=>c.put(event.request,copy));
      return res;
    }))
  );
});
