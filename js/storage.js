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
 state.tracks=(values[0]||[]).sort((a,b)=>(a.added||0)-(b.added||0));
 state.playlists=(values[1]||[]).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
 state.categories=values[2]||[];state.history=(values[4]||[]).sort((a,b)=>(b.startedAt||0)-(a.startedAt||0));
 const streamHistory=new Map();state.history.forEach(item=>{const track=item.trackSnapshot;if(track?.source==='stream'&&track.providerId&&!state.tracks.some(saved=>saved.id===track.id))streamHistory.set(track.id,track)});state.catalogTracks=Array.from(streamHistory.values());
 const preference=(values[3]||[]).find(item=>item.key==='preferences');if(preference&&preference.value)state.prefs=Object.assign(state.prefs,preference.value);
}


