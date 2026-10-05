const CACHE='scroll-consolidated-v21';
const ASSETS=['./','./index.html','./style.css','./palette.css','./version.js','./update-ready.js','./app.js','./boot.js','./core.js','./db.js','./updates.js','./progress.js','./operation-policy.js','./review-policy.js','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png','./scroll-dm-template-kit.zip','./attributes.js','./roster-guide.js','./roster.js','./roster-view.js','./snapshot.js','./snapshot-store.js','./snapshot-app.js','./snapshot.html'];
ASSETS.push('./exchange.js','./character-display.js','./attention.js');
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>/^scroll-(?:m[12]-|consolidated-)/.test(k)&&k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin)return;event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request).catch(()=>event.request.mode==='navigate'?caches.match('./index.html'):Response.error())));});




// Explicit activation only; other windows must be closed. Never claim clients.
self.addEventListener('message',event=>{if(event.data?.type!=='SCROLL_ACTIVATE'||!event.ports[0])return;event.waitUntil((async()=>{const port=event.ports[0],source=event.source;const windows=(await self.clients.matchAll({type:'window',includeUncontrolled:true})).filter(c=>c.url.startsWith(self.registration.scope));if(!source?.id||windows.length!==1||windows[0].id!==source.id){port.postMessage({type:'SCROLL_ACTIVATE_DENIED',reason:windows.length>1?'other-windows':'unknown-client'});return;}await self.skipWaiting();})());});
