import {state,$,byId,esc,trackRow} from '../core.js';
import {put} from '../storage.js';

const API_ROOT='https://api.audius.co/v1';
const APP_NAME='Auralis';
const REQUEST_TIMEOUT_MS=12000;
const modes={
 trending:{label:'Trending this week',path:'/tracks/trending',params:{time:'week'}},
 underground:{label:'Underground',path:'/tracks/trending/underground',params:{}},
 new:{label:'New releases',path:'/tracks/latest',params:{}}
};
const cache=new Map();
let mode='trending',timer=null,controller=null,requestId=0;

function allowedTrack(track){return !!track?.id&&!!(track.title||track.name)&&track.is_available!==false&&track.is_streamable!==false&&!track.is_unlisted&&!track.is_stream_gated}
function imageFromArtwork(artwork){
 if(typeof artwork==='string')return artwork;
 if(!artwork||typeof artwork!=='object')return '';
 return artwork['480x480']||artwork['150x150']||artwork['1000x1000']||artwork['200x200']||Object.values(artwork).find(value=>typeof value==='string')||''
}
function providerLink(value,fallback){
 if(typeof value==='string'&&/^https:\/\//i.test(value))return value;
 if(typeof value==='string'&&value.startsWith('/'))return 'https://audius.co'+value;
 return fallback||'https://audius.co'
}
function normalize(raw){
 const user=raw.user||raw.artist||{},artist=typeof user==='string'?user:(user.name||user.handle||raw.artist_name||'Unknown artist');
 const artistUrl=providerLink(user.permalink,user.handle?'https://audius.co/'+encodeURIComponent(user.handle):'https://audius.co');
 const providerUrl=providerLink(raw.permalink,artistUrl);
 return {
  id:'audius:'+String(raw.id),source:'stream',provider:'audius',providerId:String(raw.id),
  title:String(raw.title||raw.name||'Untitled track'),artist,album:String((typeof raw.album==='string'?raw.album:raw.album?.title)||raw.album_title||''),
  genre:String(raw.genre||''),duration:Number(raw.duration)||0,artworkUrl:imageFromArtwork(raw.artwork||raw.cover_art),artworkType:'image/jpeg',
  providerUrl,artistUrl,artistId:String(user.id||''),added:0,categories:[],liked:false,lyrics:'',
  isStreamGated:!!raw.is_stream_gated
 }
}
function keepCatalogTracks(tracks){
 const known=new Map(state.catalogTracks.map(track=>[track.id,track]));tracks.forEach(track=>{if(!state.tracks.some(saved=>saved.id===track.id))known.set(track.id,track)});
 const retained=Array.from(known.values()),pinned=new Set([state.currentTrackId,...state.queueIds]);
 while(retained.length>300){const index=retained.findIndex(track=>!pinned.has(track.id));if(index<0)break;retained.splice(index,1)}
 state.catalogTracks=retained;return tracks
}
function rememberTracks(rawTracks){
 const normalized=rawTracks.filter(allowedTrack).map(normalize);keepCatalogTracks(normalized);
 return normalized
}
function buildUrl(path,params={}){
 const url=new URL(API_ROOT+path);url.searchParams.set('app_name',APP_NAME);if(!path.endsWith('/stream'))url.searchParams.set('limit','30');
 Object.entries(params).forEach(([key,value])=>{if(value!==undefined&&value!==null&&value!=='')url.searchParams.set(key,String(value))});return url
}
async function fetchTracks(path,params,signal){
 const requestController=new AbortController();let timeoutId,abortRequest;
 const aborted=new Promise((resolve,reject)=>{
  abortRequest=()=>{clearTimeout(timeoutId);const error=new Error('Catalog request cancelled');error.name='AbortError';reject(error);requestController.abort()};
  signal.addEventListener('abort',abortRequest,{once:true});
  timeoutId=setTimeout(()=>{const error=new Error('Audius is taking too long to respond');error.name='TimeoutError';reject(error);requestController.abort()},REQUEST_TIMEOUT_MS)
 });
 try{
  const request=(async()=>{
   const response=await fetch(buildUrl(path,params),{headers:{Accept:'application/json'},signal:requestController.signal});
   if(!response.ok)throw new Error('Audius returned '+response.status);
   const payload=await response.json();if(payload.error)throw new Error(String(payload.error));
   return Array.isArray(payload.data)?payload.data:[]
  })();
  return await Promise.race([request,aborted])
 }finally{clearTimeout(timeoutId);signal.removeEventListener('abort',abortRequest)}
}
function setModeButtons(){
 document.querySelectorAll('[data-browse-mode]').forEach(button=>{const active=button.dataset.browseMode===mode;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active))})
}
function showMessage(message,failed=false){
 const status=$('browseStatus');status.hidden=false;status.innerHTML=failed?esc(message)+' <button id="browseRetry" class="text-button" type="button">Try again</button>':esc(message);
 $('browseResults').innerHTML='';
 $('browseRetry')?.addEventListener('click',()=>loadBrowse(true),{once:true})
}
function renderTracks(tracks,label){
 const status=$('browseStatus'),box=$('browseResults'),ids=tracks.map(track=>track.id);
 if(!tracks.length){showMessage($('browseSearchInput').value.trim()?'No matching tracks. Try another search.':'No tracks are available here right now.');return}
 status.hidden=true;
 const title=label||'Search results';
 box.innerHTML='<div class="section-heading"><h2>'+esc(title)+'</h2><button class="text-button" data-play-collection="'+esc(ids.join(','))+'">Play all</button></div>'+tracks.map(track=>trackRow(track,{collectionIds:ids})).join('')
}
function currentQuery(){return $('browseSearchInput').value.trim()}
export function loadBrowse(force=false){return loadBrowseImpl(force)}
async function loadBrowseImpl(force=false){
 if(controller)controller.abort();controller=new AbortController();const signal=controller.signal,id=++requestId,query=currentQuery(),key=query?'search:'+query.toLowerCase():'mode:'+mode;
 setModeButtons();
 if(!force&&cache.has(key)){const cached=keepCatalogTracks(cache.get(key));renderTracks(cached,query?'Search results':'Audius · '+modes[mode].label);return}
 $('browseStatus').hidden=false;$('browseStatus').textContent=query?'Searching Audius…':'Loading music…';$('browseResults').innerHTML='';
 try{
  const result=query?await fetchTracks('/tracks/search',{query},signal):await fetchTracks(modes[mode].path,modes[mode].params,signal);
  if(id!==requestId)return;const tracks=rememberTracks(result);cache.set(key,tracks);renderTracks(tracks,query?'Search results':'Audius · '+modes[mode].label)
 }catch(error){if(error.name==='AbortError'||id!==requestId)return;showMessage(error.name==='TimeoutError'?'Audius is taking too long to respond. Check your connection and retry.':'Could not load the Audius catalog. Check your connection and retry.',true)}
}
export function streamTrackUrl(track){
 if(!track||track.source!=='stream'||!track.providerId)return '';
 return buildUrl('/tracks/'+encodeURIComponent(track.providerId)+'/stream',{}).toString()
}
export async function saveStreamTrack(trackId){
 const existing=state.tracks.find(track=>track.id===trackId);if(existing)return existing;
 const track=byId(trackId);if(!track||track.source!=='stream')return null;
 const saved={...track,added:Date.now(),categories:Array.isArray(track.categories)?track.categories.slice():[],liked:!!track.liked};
 await put('tracks',saved);state.tracks.push(saved);state.tracks.sort((a,b)=>(a.added||0)-(b.added||0));return saved
}
export function initCatalog(){
 const input=$('browseSearchInput'),clear=$('browseClearSearch');
 const onSearchInput=()=>{clear.hidden=!input.value;clearTimeout(timer);timer=setTimeout(()=>loadBrowseImpl(),220)};
 input.addEventListener('input',onSearchInput);input.addEventListener('search',onSearchInput);
 clear.addEventListener('click',()=>{clearTimeout(timer);input.value='';clear.hidden=true;setModeButtons();loadBrowseImpl();input.focus()});
 document.querySelectorAll('[data-browse-mode]').forEach(button=>button.addEventListener('click',()=>{mode=button.dataset.browseMode||'trending';input.value='';clear.hidden=true;loadBrowseImpl()}))
}
