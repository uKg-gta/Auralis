import {state,status} from './core.js';
const DB_NAME='auralis-local-library-v1';
const DB_VERSION=4;
function ensureStores(database){for(const [name,options] of [['tracks',{keyPath:'id'}],['playlists',{keyPath:'id'}],['categories',{keyPath:'id'}],['settings',{keyPath:'key'}],['history',{keyPath:'id',autoIncrement:true}],['listeningSignals',{keyPath:'id',autoIncrement:true}]])if(!database.objectStoreNames.contains(name))database.createObjectStore(name,options)}
function migrateDatabase(event){const database=event.target.result,transaction=event.target.transaction,oldVersion=event.oldVersion;if(oldVersion<1)ensureStores(database);if(oldVersion>=1&&oldVersion<4){if(!database.objectStoreNames.contains('tracks'))database.createObjectStore('tracks',{keyPath:'id'});const cursor=transaction.objectStore('tracks').openCursor();cursor.onsuccess=()=>{const row=cursor.result;if(!row)return;const track=row.value;if(!track.source)track.source=track.blob instanceof Blob?'local':'stream';if(track.source==='stream'&&!track.provider)track.provider='audius';row.update(track);row.continue()}}if(oldVersion<4&&database.objectStoreNames.contains('settings'))transaction.objectStore('settings').put({key:'schemaVersion',value:4,updatedAt:Date.now()})}
export function openDatabase(){
 return new Promise((resolve,reject)=>{
  if(!window.indexedDB){reject(new Error('This browser does not support local music storage.'));return}
  const request=indexedDB.open(DB_NAME,DB_VERSION);
  request.onupgradeneeded=migrateDatabase;
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
 await openDatabase();const values=await Promise.all([getAll('tracks'),getAll('playlists'),getAll('categories'),getAll('settings'),getAll('history'),getAll('listeningSignals')]);
 state.tracks=(values[0]||[]).sort((a,b)=>(a.added||0)-(b.added||0));
 state.playlists=(values[1]||[]).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
 state.categories=values[2]||[];state.history=(values[4]||[]).sort((a,b)=>(b.startedAt||0)-(a.startedAt||0));state.listeningSignals=(values[5]||[]).sort((a,b)=>(a.timestamp||0)-(b.timestamp||0));
 const streamHistory=new Map();state.history.forEach(item=>{const track=item.trackSnapshot;if(track?.source==='stream'&&track.providerId&&!state.tracks.some(saved=>saved.id===track.id))streamHistory.set(track.id,track)});state.catalogTracks=Array.from(streamHistory.values());
 const preference=(values[3]||[]).find(item=>item.key==='preferences');if(preference&&preference.value)state.prefs=Object.assign(state.prefs,preference.value);const discovery=(values[3]||[]).find(item=>item.key==='discoveryPreferences');if(discovery?.value)state.discoveryPreferences=Object.assign(state.discoveryPreferences,discovery.value);const savedQueue=(values[3]||[]).find(item=>item.key==='queueState')?.value;if(savedQueue){const valid=(savedQueue.queueIds||[]).filter(id=>state.tracks.some(t=>t.id===id)||state.catalogTracks.some(t=>t.id===id));state.queueIds=valid;state.queueBaseIds=(savedQueue.queueBaseIds||valid).filter(id=>valid.includes(id));state.currentTrackId=valid.includes(savedQueue.currentTrackId)?savedQueue.currentTrackId:null;state.queueIndex=state.currentTrackId?valid.indexOf(state.currentTrackId):-1;state.shuffle=!!savedQueue.shuffle;state.repeatMode=['off','all','one'].includes(savedQueue.repeatMode)?savedQueue.repeatMode:'off'}
}


