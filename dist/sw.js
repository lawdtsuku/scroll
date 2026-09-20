const CACHE='scroll-consolidated-v13';
const ASSETS=['./','./index.html','./style.css','./app.js','./boot.js','./core.js','./db.js','./updates.js','./progress.js','./operation-policy.js','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png','./scroll-dm-template-kit.zip','./roster.js','./roster-view.js','./snapshot.js','./snapshot-store.js','./snapshot-app.js','./snapshot.html'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>/^scroll-(?:m[12]-|consolidated-)/.test(k)&&k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin)return;event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request).catch(()=>event.request.mode==='navigate'?caches.match('./index.html'):Response.error())));});



