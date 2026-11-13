import {state,status} from './core.js';
const DB_NAME='auralis-local-library-v1';
const DB_VERSION=2;
export function openDatabase(){
 return new Promise((resolve,reject)=>{
  if(!window.indexedDB){reject(new Error('This browser does not support local music storage.'));return}
  const request=indexedDB.open(DB_NAME,DB_VERSION);
  request.onupgradeneeded=()=>{const database=request.result;if(!database.objectStoreNames.contains('tracks'))database.createObjectStore('tracks',{keyPath:'id'});if(!database.objectStoreNames.contains('playlists'))database.createObjectStore('playlists',{keyPath:'id'});if(!database.objectStoreNames.contains('categories'))database.createObjectStore('categories',{keyPath:'id'});if(!database.objectStoreNames.contains('settings'))database.createObjectStore('settings',{keyPath:'key'});if(!database.objectStoreNames.contains('history'))database.createObjectStore('history',{keyPath:'id',autoIncrement:true})};
  request.onsuccess=()=>{state.db=request.result;state.db.onversionchange=()=>{state.db.close();status('The music library was updated in another tab. Reload Auralis to continue.')};resolve(state.db)};
  request.onblocked=()=>{const message='Close any other Auralis tabs to finish opening your music library.';status(message);window.__auralisShowStartupError?.(message)};request.onerror=()=>reject(request.error||new Error('Could not open the local music library.'))
 })
}
export function request(storeName,mode,action){
 return new Promise((resolve,reject)=>{
  if(!state.db){reject(new Error('The local library is not ready.'));return}
  let tx,result,req;try{tx=state.db.transaction(storeName,mode);req=action(tx.objectStore(storeName))}catch(error){reject(error);return}
  if(req){req.onsuccess=()=>{result=req.result};req.onerror=()=>reject(req.error||tx.error)}
  tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error||new Error('The library could not save this change.'));tx.onabort=()=>reject(tx.error||new Error('The library change was cancelled.'))
 })
}
export function getAll(name){return request(name,'readonly',store=>store.getAll())}
export function put(name,value){return request(name,'readwrite',store=>store.put(value))}
export function add(name,value){return request(name,'readwrite',store=>store.add(value))}
export function remove(name,key){return request(name,'readwrite',store=>store.delete(key))}
export async function loadLibraryState(){
 await openDatabase();const values=await Promise.all([getAll('tracks'),getAll('playlists'),getAll('categories'),getAll('settings'),getAll('history')]);
 const preference=(values[3]||[]).find(item=>item.key==='preferences');if(preference&&preference.value)state.prefs=Object.assign(state.prefs,preference.value);
 const maxYoutubeAge=30*24*60*60*1000,now=Date.now(),expiredYoutubeIds=new Set(),loadedTracks=[];
 for(const track of values[0]||[]){
  if(track.source==='stream'&&(!track.provider||track.provider==='audius')){track.source='audius';track.provider='audius';put('tracks',track).catch(()=>{})}
  if(track.source==='youtube'||track.source==='jamendo'){
   const providerId=String(track.providerId||track.id?.replace(/^(youtube|jamendo):/, '')||'');
   if(track.source==='youtube'&&!/^[A-Za-z0-9_-]{11}$/.test(providerId)){expiredYoutubeIds.add(track.id);await remove('tracks',track.id).catch(()=>{});continue}
   const checkedAt=Number(track.youtubeDataCheckedAt)||Number(track.added)||0;
   if(track.source==='youtube'&&(!checkedAt||checkedAt>now||now-checkedAt>=maxYoutubeAge)){expiredYoutubeIds.add(track.id);await remove('tracks',track.id).catch(()=>{});continue}
   const sourceUrl=track.source==='youtube'?'https://www.youtube.com/watch?v='+encodeURIComponent(providerId):String(track.sourceUrl||track.providerUrl||'https://www.jamendo.com/track/'+encodeURIComponent(providerId));
   const clean={id:track.id,source:track.source,providerId,sourceUrl,added:Number(track.added)||0,categories:Array.isArray(track.categories)?track.categories:[],liked:!!track.liked,...(track.source==='youtube'?{youtubeDataCheckedAt:checkedAt}:{})};
   const allowed=new Set(Object.keys(clean));if(Object.keys(track).some(key=>!allowed.has(key))||Object.keys(clean).some(key=>track[key]!==clean[key]))put('tracks',clean).catch(()=>{});
   loadedTracks.push(clean);continue
  }
  loadedTracks.push(track)
 }
 state.tracks=loadedTracks.sort((a,b)=>(a.added||0)-(b.added||0));
 state.playlists=(values[1]||[]).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
 if(expiredYoutubeIds.size){for(const playlist of state.playlists){const ids=Array.isArray(playlist.trackIds)?playlist.trackIds:[],next=ids.filter(id=>!expiredYoutubeIds.has(id));if(next.length!==ids.length){playlist.trackIds=next;put('playlists',playlist).catch(()=>{})}}}
 state.categories=values[2]||[];const history=[];
 for(const item of values[4]||[]){
  const source=item.trackSnapshot?.source,trackId=String(item.trackId||''),youtubeHistory=source==='youtube'||trackId.startsWith('youtube:');
  if(youtubeHistory){await remove('history',item.id).catch(()=>{});continue}
  const remote=source==='jamendo'||trackId.startsWith('jamendo:');
  if(!remote){history.push(item);continue}
  const clean={...item};for(const key of ['title','artist','album','trackSnapshot','provider','providerId','sourceUrl'])delete clean[key];put('history',clean).catch(()=>{});history.push(clean)
 }
 state.history=history.sort((a,b)=>(b.startedAt||0)-(a.startedAt||0));
 const streamHistory=new Map();state.history.forEach(item=>{const track=item.trackSnapshot;if(track?.source==='stream'&&track.providerId){track.source='audius';track.provider='audius';item.trackSnapshot=track;put('history',item).catch(()=>{})}if(track?.source==='audius'&&track.providerId&&!state.tracks.some(saved=>saved.id===track.id))streamHistory.set(track.id,track)});state.catalogTracks=Array.from(streamHistory.values());
}

