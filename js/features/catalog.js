import {state,$,byId,esc,artworkClass,artworkUrl} from '../core.js';
import {put} from '../storage.js';

const API_ROOT='https://api.audius.co/v1';
const APP_NAME='Auralis';
const REQUEST_TIMEOUT_MS=12000;
const modes={
 trending:{label:'Trending this week',path:'/tracks/trending',params:{time:'week'},status:'browseTrendingStatus',results:'browseTrendingResults'},
 underground:{label:'Underground',path:'/tracks/trending/underground',params:{},status:'browseUndergroundStatus',results:'browseUndergroundResults'},
 new:{label:'New releases',path:'/tracks/latest',params:{},status:'browseNewStatus',results:'browseNewResults'}
};
const cache=new Map();
let browseController=null,browseRequestId=0;

function allowedTrack(track){return !!track?.id&&!!(track.title||track.name)&&track.is_available!==false&&track.is_streamable!==false&&!track.is_unlisted&&!track.is_stream_gated}
function imageFromArtwork(artwork){if(typeof artwork==='string')return artwork;if(!artwork||typeof artwork!=='object')return '';return artwork['480x480']||artwork['150x150']||artwork['1000x1000']||artwork['200x200']||Object.values(artwork).find(value=>typeof value==='string')||''}
function providerLink(value,fallback){if(typeof value==='string'&&/^https:\/\//i.test(value))return value;if(typeof value==='string'&&value.startsWith('/'))return 'https://audius.co'+value;return fallback||'https://audius.co'}
function normalize(raw){
 const user=raw.user||raw.artist||{},artist=typeof user==='string'?user:(user.name||user.handle||raw.artist_name||'Unknown artist');
 const artistUrl=providerLink(user.permalink,user.handle?'https://audius.co/'+encodeURIComponent(user.handle):'https://audius.co'),providerUrl=providerLink(raw.permalink,artistUrl);
 return {id:'audius:'+String(raw.id),source:'stream',provider:'audius',providerId:String(raw.id),title:String(raw.title||raw.name||'Untitled track'),artist,album:String((typeof raw.album==='string'?raw.album:raw.album?.title)||raw.album_title||''),genre:String(raw.genre||''),duration:Number(raw.duration)||0,artworkUrl:imageFromArtwork(raw.artwork||raw.cover_art),artworkType:'image/jpeg',providerUrl,artistUrl,artistId:String(user.id||''),added:0,categories:[],liked:false,lyrics:'',isStreamGated:!!raw.is_stream_gated}
}
function keepCatalogTracks(tracks){
 const known=new Map(state.catalogTracks.map(track=>[track.id,track]));tracks.forEach(track=>{if(!state.tracks.some(saved=>saved.id===track.id))known.set(track.id,track)});
 const retained=Array.from(known.values()),pinned=new Set([state.currentTrackId,...state.queueIds]);while(retained.length>300){const index=retained.findIndex(track=>!pinned.has(track.id));if(index<0)break;retained.splice(index,1)}state.catalogTracks=retained;return tracks
}
function rememberTracks(rawTracks){const normalized=rawTracks.filter(allowedTrack).map(normalize);keepCatalogTracks(normalized);return normalized}
function buildUrl(path,params={}){const url=new URL(API_ROOT+path);url.searchParams.set('app_name',APP_NAME);if(!path.endsWith('/stream'))url.searchParams.set('limit','30');Object.entries(params).forEach(([key,value])=>{if(value!==undefined&&value!==null&&value!=='')url.searchParams.set(key,String(value))});return url}
async function fetchTracks(path,params,signal){
 const requestController=new AbortController();let timeoutId,abortRequest;
 const aborted=new Promise((resolve,reject)=>{
  abortRequest=()=>{clearTimeout(timeoutId);const error=new Error('Catalog request cancelled');error.name='AbortError';reject(error);requestController.abort()};
  if(signal){if(signal.aborted){abortRequest();return}signal.addEventListener('abort',abortRequest,{once:true})}
  timeoutId=setTimeout(()=>{const error=new Error('Audius is taking too long to respond');error.name='TimeoutError';reject(error);requestController.abort()},REQUEST_TIMEOUT_MS)
 });
 try{
  const request=(async()=>{const response=await fetch(buildUrl(path,params),{headers:{Accept:'application/json'},signal:requestController.signal});if(!response.ok)throw new Error('Audius returned '+response.status);const payload=await response.json();if(payload.error)throw new Error(String(payload.error));return Array.isArray(payload.data)?payload.data:[]})();
  return await Promise.race([request,aborted])
 }finally{clearTimeout(timeoutId);if(signal&&abortRequest)signal.removeEventListener('abort',abortRequest)}
}
export async function searchAudiusTracks(query,signal){const raw=await fetchTracks('/tracks/search',{query:String(query||'').trim()},signal);return rememberTracks(raw)}
function browseCard(track,ids){
 const url=artworkUrl(track),art='<span class="card-art art '+artworkClass(track)+'">'+(url?'<img src="'+esc(url)+'" alt="">':'')+'<span class="card-play">'+iconPlay()+'</span></span>';
 return '<button class="music-card" data-play-track="'+esc(track.id)+'" data-play-collection="'+esc(ids.join(','))+'" aria-label="Play '+esc(track.title)+' by '+esc(track.artist)+'">'+art+'<span class="card-title">'+esc(track.title)+'</span><span class="card-subtitle">'+esc(track.artist)+'</span></button>'
}
function iconPlay(){return '<svg class="icon" aria-hidden="true" focusable="false"><use href="#icon-play"></use></svg>'}
function renderBrowseShelf(key,tracks,id){
 const section=modes[key],status=$(section.status),box=$(section.results),playAll=document.querySelector('[data-browse-play-all="'+key+'"]');
 if(!tracks.length){status.hidden=false;status.textContent='No tracks are available here right now.';box.innerHTML='';playAll.hidden=true;return}
 const visible=tracks.slice(0,10),ids=visible.map(track=>track.id);status.hidden=true;box.innerHTML=visible.map(track=>browseCard(track,ids)).join('');playAll.dataset.playCollection=ids.join(',');playAll.hidden=false
}
function renderBrowseError(key,id){const section=modes[key],status=$(section.status),box=$(section.results),playAll=document.querySelector('[data-browse-play-all="'+key+'"]');status.hidden=false;status.innerHTML='Could not load this shelf. <button class="text-button" data-browse-retry="'+key+'" type="button">Try again</button>';box.innerHTML='';playAll.hidden=true}
export async function loadBrowse(force=false){
 if(browseController)browseController.abort();browseController=new AbortController();const signal=browseController.signal,id=++browseRequestId;
 await Promise.all(Object.entries(modes).map(async([key,section])=>{
  const shelfCache=cache.get(key),status=$(section.status);
  if(!force&&shelfCache){renderBrowseShelf(key,keepCatalogTracks(shelfCache),id);return}
  status.hidden=false;status.textContent='Loading music…';$(section.results).innerHTML='';
  try{const tracks=rememberTracks(await fetchTracks(section.path,section.params,signal));if(id!==browseRequestId)return;cache.set(key,tracks);renderBrowseShelf(key,tracks,id)}
  catch(error){if(error.name==='AbortError'||id!==browseRequestId)return;renderBrowseError(key,id)}
 }))
}
export function streamTrackUrl(track){if(!track||track.source!=='stream'||!track.providerId)return '';return buildUrl('/tracks/'+encodeURIComponent(track.providerId)+'/stream',{}).toString()}
export async function saveStreamTrack(trackId){const existing=state.tracks.find(track=>track.id===trackId);if(existing)return existing;const track=byId(trackId);if(!track||track.source!=='stream')return null;const saved={...track,added:Date.now(),categories:Array.isArray(track.categories)?track.categories.slice():[],liked:!!track.liked};await put('tracks',saved);state.tracks.push(saved);state.tracks.sort((a,b)=>(a.added||0)-(b.added||0));return saved}
export function initCatalog(){}


// Provider-facing discovery adapter. Consumers receive normalized tracks, not raw Audius payloads.
export async function getAudiusDiscoveryCandidates(){
 const groups=await Promise.allSettled([
  fetchTracks('/tracks/trending',{time:'week'}),
  fetchTracks('/tracks/trending/underground',{}),
  fetchTracks('/tracks/latest',{})
 ]);
 const raw=[],successful=groups.filter(result=>result.status==='fulfilled').length;groups.forEach(result=>{if(result.status==='fulfilled')raw.push(...result.value)});if(!successful)throw new Error('Audius discovery is currently unavailable');
 const unique=new Map();rememberTracks(raw).forEach(track=>{if(!unique.has(track.id))unique.set(track.id,track)});
 return Array.from(unique.values());
}
