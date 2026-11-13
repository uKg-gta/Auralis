const CACHE_NAME='auralis-shell-v15';
const APP_SHELL=['./','./index.html','./manifest.json','./assets/icon.svg','./css/base.css','./css/buttons.css','./css/app.css','./css/player.css','./css/responsive.css','./js/app.js','./js/core.js','./js/storage.js','./js/features/actions.js','./js/features/backup.js','./js/features/catalog.js','./js/features/discovery.js','./js/providers/provider-registry.js','./js/providers/audius.js','./js/features/library.js','./js/features/metadata.js','./js/features/player.js','./js/features/playlists.js','./js/features/profile.js','./js/features/search.js','./js/features/settings.js'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('auralis-shell-')&&key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
 const request=event.request;if(request.method!=='GET')return;const url=new URL(request.url);if(url.origin!==self.location.origin)return;
 if(request.mode==='navigate'){event.respondWith(fetch(request).then(response=>{if(response.ok)caches.open(CACHE_NAME).then(cache=>cache.put('./index.html',response.clone()));return response}).catch(()=>caches.match('./index.html')));return}
 event.respondWith(caches.match(request).then(cached=>fetch(request).then(response=>{if(response.ok)caches.open(CACHE_NAME).then(cache=>cache.put(request,response.clone()));return response}).catch(()=>cached||new Response('Auralis is offline and this file is not cached.',{status:503,statusText:'Offline'}))))
});


