const API='https://musicbrainz.org/ws/2';
const memoryCache=new Map();
let lastRequestAt=0,requestQueue=Promise.resolve();

function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
async function rateLimitedFetch(url){
 const run=async()=>{const wait=Math.max(0,1000-(Date.now()-lastRequestAt));if(wait)await sleep(wait);lastRequestAt=Date.now();
  if(!navigator.onLine)throw new Error('You are offline. Connect to the internet to look up MusicBrainz.');
  const response=await fetch(url,{headers:{Accept:'application/json'},cache:'no-store'});if(response.status===503)throw new Error('MusicBrainz is busy. Wait a moment and retry.');if(!response.ok)throw new Error('MusicBrainz returned '+response.status+'. Try again later.');return response.json()};
 const task=requestQueue.then(run,run);requestQueue=task.then(()=>undefined,()=>undefined);return task
}
async function cachedFetch(key,url){if(memoryCache.has(key))return memoryCache.get(key);const promise=rateLimitedFetch(url);memoryCache.set(key,promise);while(memoryCache.size>80)memoryCache.delete(memoryCache.keys().next().value);try{const value=await promise;memoryCache.set(key,value);return value}catch(error){memoryCache.delete(key);throw error}}
function endpoint(path,query){const url=new URL(API+'/'+path);Object.entries(query).forEach(([key,value])=>url.searchParams.set(key,String(value)));return url}
function normalizeArtist(credit){return (credit||[]).map(item=>item.name||item.artist?.name||'').filter(Boolean).join(', ')}
function normalizeRecording(item){return {id:item.id,title:item.title||'Unknown recording',artist:normalizeArtist(item['artist-credit']),releases:(item.releases||[]).map(release=>({id:release.id,title:release.title||'Unknown release',date:release.date||'',url:'https://musicbrainz.org/release/'+encodeURIComponent(release.id)}))}}
export async function searchRecordings(query,opts={}){
 const text=String(query||'').trim();if(!text)return [];
 const url=endpoint('recording/',{query:text,fmt:'json',limit:Math.min(20,Math.max(1,Number(opts.limit)||10)),inc:'artist-credits'}),key='recording|'+url.searchParams.toString();const value=await cachedFetch(key,url);
 return (value.recordings||[]).map(normalizeRecording)
}
export async function getRecordingDetails(recordingId){
 const id=String(recordingId||'').trim();if(!/^[0-9a-f-]{36}$/i.test(id))throw new Error('This MusicBrainz recording ID is invalid.');
 const url=endpoint('recording/'+encodeURIComponent(id),{fmt:'json',inc:'artists+releases'}),value=await cachedFetch('recording-detail|'+id,url);
 return normalizeRecording(value)
}
export async function searchArtists(query,opts={}){
 const text=String(query||'').trim();if(!text)return [];
 const url=endpoint('artist/',{query:text,fmt:'json',limit:Math.min(20,Math.max(1,Number(opts.limit)||10))}),key='artist|'+url.searchParams.toString();const value=await cachedFetch(key,url);
 return (value.artists||[]).map(item=>({id:item.id,name:item.name||'Unknown artist',country:item.country||'',type:item.type||'',score:Number(item.score)||0,url:'https://musicbrainz.org/artist/'+encodeURIComponent(item.id)}))
}
export async function getArtistReleases(artistId,opts={}){
 const id=String(artistId||'').trim();if(!id)return [];
 const url=endpoint('release/',{artist:id,fmt:'json',limit:Math.min(100,Math.max(1,Number(opts.limit)||25)),inc:'artist-credits'}),key='releases|'+url.searchParams.toString();const value=await cachedFetch(key,url);
 return (value.releases||[]).map(item=>({id:item.id,title:item.title||'Unknown release',date:item.date||'',status:item.status||'',url:'https://musicbrainz.org/release/'+encodeURIComponent(item.id)}))
}
export async function artistReleasesByName(name){const artists=await searchArtists(name,{limit:5});if(!artists.length)return {artist:null,releases:[]};const exact=artists.find(item=>item.name.toLowerCase()===String(name).toLowerCase())||artists[0];return {artist:exact,releases:await getArtistReleases(exact.id)}}
export async function search(query,opts={}){return searchRecordings(query,opts)}
export async function browse(mode='artists'){
 if(mode==='artists')return [];
 return searchRecordings(String(mode||''),{limit:10})
}
export const capabilities=Object.freeze({backgroundPlayback:false,mediaSession:false,offline:false});
export const license=Object.freeze({name:'CC0 core / CC BY-NC-SA supplementary',url:'https://musicbrainz.org/doc/About/Data_License',description:'MusicBrainz metadata has multiple data-license components; this app displays factual lookups and links to the provider.'});
