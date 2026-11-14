const CACHE_NAME='auralis-shell-v26';
const APP_SHELL=[
 './','./index.html','./sources.html','./privacy.html','./terms.html','./manifest.json','./assets/icon.svg','./assets/favicon.png','./assets/apple-touch-icon.png','./assets/icon-192.png','./assets/icon-512.png','./assets/icon-maskable-512.png','./js/theme-init.js',
 './css/base.css','./css/buttons.css','./css/app.css','./css/player.css','./css/responsive.css','./css/home-profile.css',
 './js/app.js','./js/core.js','./js/storage.js','./js/sources/index.js','./js/sources/youtube.js','./js/sources/jamendo.js','./js/sources/musicbrainz.js',
 './js/features/actions.js','./js/features/backup.js','./js/features/catalog.js','./js/features/discovery.js','./js/features/library.js','./js/features/player.js','./js/features/playlists.js','./js/features/profile.js','./js/features/search.js','./js/features/settings.js',
 './js/providers/audius.js','./js/providers/provider-registry.js'
];
self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
  const cache=await caches.open(CACHE_NAME);
  await Promise.allSettled(APP_SHELL.map(async path=>{
   try{
    const response=await fetch(new Request(path,{cache:'no-store'}));
    if(response.ok)await cache.put(path,response);
   }catch(_){}
  }));
  await self.skipWaiting();
 })());
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(key=>key.startsWith('auralis-shell-')&&key!==CACHE_NAME).map(key=>caches.delete(key)));
  await self.clients.claim();
 })());
});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin)return;
 event.respondWith((async()=>{
  const isNavigation=request.mode==='navigate';
  const cacheKey=isNavigation?'./index.html':request;
  try{
   // Bypass the browser HTTP cache so HTML and ES modules cannot be mixed across releases.
   const freshRequest=new Request(request,{cache:'no-store'});
   const response=await fetch(freshRequest);
   if(response.ok){
    const cache=await caches.open(CACHE_NAME);
    await cache.put(cacheKey,response.clone());
   }
   return response;
  }catch(error){
   const cached=await caches.match(cacheKey);
   if(cached)return cached;
   if(isNavigation){
    const shell=await caches.match('./index.html');
    if(shell)return shell;
   }
   return new Response('Auralis is offline and this file is not cached.',{status:503,statusText:'Offline'});
  }
 })());
});
