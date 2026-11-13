import {state} from '../core.js';

const API='https://www.googleapis.com/youtube/v3';
const CACHE_MS=3*60*1000;
const memoryCache=new Map();
let playerPromise=null,player=null,playerElement=null,autoRequested=false,playerReady=false,visibilityObserver=null,fallbackVisibilityCheck=null,readinessTimer=null,callbacks={},visibleRatio=0;

function configuredKey(){return String(state.prefs.youtubeApiKey||'').trim()}
export function isYouTubeEnabled(){return state.prefs.youtubeConsent===true}
function validVideoId(value){return /^[A-Za-z0-9_-]{11}$/.test(String(value||''))}
function videoUrl(videoId){return 'https://www.youtube.com/watch?v='+encodeURIComponent(videoId)}
function apiError(payload,response){
 const reason=payload?.error?.errors?.[0]?.reason||payload?.error?.status||'';
 if(['quotaExceeded','dailyLimitExceeded','rateLimitExceeded'].includes(reason))return new Error('The YouTube Data API quota is exhausted. Google’s default allocation includes 100 search requests per day. Try again after the quota resets, or review usage in Google Cloud.');
 if(response?.status===403)return new Error('YouTube denied this API key. Check its website referrer restriction and YouTube Data API v3 access.');
 if(response?.status===429)return new Error('YouTube is receiving too many requests. Wait a moment, then try again.');
 if(response?.status===400)return new Error('YouTube could not understand this search. Try a shorter query.');
 return new Error(payload?.error?.message||'YouTube search is unavailable right now.');
}
async function request(endpoint,params={},opts={}){
 if(typeof navigator!=='undefined'&&!navigator.onLine)throw new Error('You are offline. Connect to the internet to search YouTube.');
 if(!isYouTubeEnabled())throw new Error('Enable YouTube in Settings and agree to the privacy policy and YouTube Terms before searching or playing videos.');
 const key=configuredKey();if(!key)throw new Error('Add a YouTube Data API key in Settings to search YouTube.');
 const url=new URL(API+'/'+endpoint);Object.entries(params).forEach(([name,value])=>{if(value!==undefined&&value!==null&&value!=='')url.searchParams.set(name,String(value))});
 let response;
 try{response=await fetch(url,{headers:{Accept:'application/json','X-Goog-Api-Key':key},cache:'no-store',signal:opts.signal})}
 catch(error){if(error?.name==='AbortError')throw error;throw new Error(typeof navigator!=='undefined'&&!navigator.onLine?'You are offline. Connect to the internet to search YouTube.':'Could not reach YouTube. Check your connection and try again.')}
 let payload={};try{payload=await response.json()}catch(error){}
 if(!response.ok||payload.error)throw apiError(payload,response);return payload
}
function durationSeconds(value){const match=String(value||'').match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);return match?(Number(match[1]||0)*3600+Number(match[2]||0)*60+Number(match[3]||0)):0}
function normalize(item){
 const snippet=item.snippet||{},id=String(item.id?.videoId||item.id||'');if(!validVideoId(id))return null;
 const thumb=snippet.thumbnails?.high?.url||snippet.thumbnails?.medium?.url||snippet.thumbnails?.default?.url||'';
 return {id:'youtube:'+id,source:'youtube',providerId:id,sourceUrl:videoUrl(id),providerUrl:videoUrl(id),title:String(snippet.title||'YouTube video'),artist:String(snippet.channelTitle||'YouTube creator'),artistId:String(snippet.channelId||''),artistUrl:snippet.channelId?'https://www.youtube.com/channel/'+encodeURIComponent(snippet.channelId):'',album:'',artworkUrl:thumb,artworkType:'image/jpeg',duration:durationSeconds(item.contentDetails?.duration),license:'YouTube',licenseUrl:'https://www.youtube.com/t/terms',genre:'',madeForKids:item.status?.madeForKids===true,apiFetchedAt:Date.now(),added:0,categories:[],liked:false,lyrics:''}
}
function cached(key){const entry=memoryCache.get(key);if(!entry)return null;if(Date.now()-entry.time>CACHE_MS){memoryCache.delete(key);return null}return entry.value}
function remember(key,value){memoryCache.set(key,{time:Date.now(),value});while(memoryCache.size>12)memoryCache.delete(memoryCache.keys().next().value);return value}
export function clearYouTubeMemory(){memoryCache.clear();stopYouTubePlayback()}
export async function search(query,opts={}){
 const clean=String(query||'').trim();if(!clean)return {tracks:[],nextPageToken:''};
 const pageToken=opts.pageToken||'',cacheKey=clean.toLowerCase()+'|'+pageToken,existing=cached(cacheKey);if(existing)return existing;
 const searchResult=await request('search',{part:'snippet',type:'video',videoCategoryId:'10',videoEmbeddable:'true',maxResults:20,q:clean,pageToken},opts);
 const ids=(searchResult.items||[]).map(item=>item.id?.videoId).filter(validVideoId);if(!ids.length)return remember(cacheKey,{tracks:[],nextPageToken:searchResult.nextPageToken||''});
 const details=await request('videos',{part:'snippet,contentDetails,status',id:ids.join(',')},opts);
 const byVideo=new Map((details.items||[]).filter(item=>item.status?.embeddable!==false).map(item=>[item.id,item]));
 const tracks=(searchResult.items||[]).map(item=>{const id=item.id?.videoId,detail=byVideo.get(id);return detail?normalize(detail):null}).filter(Boolean);
 return remember(cacheKey,{tracks,nextPageToken:searchResult.nextPageToken||''})
}
export function browse(mode='bollywood'){
 const queries={bollywood:'Bollywood official music video',hollywood:'official pop music video',trending:'official music video'};
 return search(queries[mode]||String(mode||'Bollywood official music video'))
}
export function getPlayable(track){if(track?.source!=='youtube'||!validVideoId(track.providerId))return null;return {kind:'youtube',videoId:String(track.providerId),url:videoUrl(track.providerId)}}
export async function hydrate(ids=[]){
 const unique=Array.from(new Set(ids.map(String).filter(validVideoId)));if(!unique.length)return [];
 const result=await request('videos',{part:'snippet,contentDetails,status',id:unique.slice(0,50).join(',')});
 const allowed=new Map((result.items||[]).filter(item=>item.status?.embeddable!==false).map(item=>[item.id,item]));
 return unique.map(id=>{const item=allowed.get(id);return item?normalize(item):null}).filter(Boolean)
}
export const capabilities=Object.freeze({backgroundPlayback:false,mediaSession:false,offline:false});
export const license=Object.freeze({name:'YouTube',url:'https://www.youtube.com/t/terms',description:'Playback stays in the official visible YouTube player.'});

function loadApi(){
 if(window.YT?.Player)return Promise.resolve(window.YT);
 if(playerPromise)return playerPromise;
 playerPromise=new Promise((resolve,reject)=>{
  let settled=false;const finish=(error)=>{if(settled)return;settled=true;clearTimeout(timeout);if(error){playerPromise=null;reject(error)}else resolve(window.YT)};
  const previous=window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady=()=>{try{if(typeof previous==='function')previous()}catch(error){}finally{finish(window.YT?.Player?null:new Error('The YouTube player could not load. Check your connection and try again.'))}};
  let script=document.querySelector('script[data-auralis-youtube-api]');
  if(!script){script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';script.async=true;script.dataset.auralisYoutubeApi='true';document.head.appendChild(script)}
  script.addEventListener('error',()=>finish(new Error('The YouTube player could not load. Check your connection and try again.')),{once:true});
  const timeout=window.setTimeout(()=>finish(new Error('The YouTube player took too long to load. Check your connection and try again.')),12000);
 })
 return playerPromise
}
function visibleAreaRatio(element){
 if(!element?.isConnected||document.visibilityState!=='visible')return 0;
 const rect=element.getBoundingClientRect(),width=Math.max(0,Math.min(rect.right,window.innerWidth)-Math.max(rect.left,0)),height=Math.max(0,Math.min(rect.bottom,window.innerHeight)-Math.max(rect.top,0)),area=Math.max(1,rect.width*rect.height);
 return width*height/area
}
export function isYouTubePlayerVisible(){return !!playerElement&&visibleRatio>.5&&visibleAreaRatio(playerElement)>.5}
function clearVisibilityWatch(){if(visibilityObserver){visibilityObserver.disconnect();visibilityObserver=null}if(fallbackVisibilityCheck){window.removeEventListener('scroll',fallbackVisibilityCheck,true);window.removeEventListener('resize',fallbackVisibilityCheck);document.removeEventListener('visibilitychange',fallbackVisibilityCheck);fallbackVisibilityCheck=null}visibleRatio=0}
function onVisibility(ratio){
 visibleRatio=ratio;
 const visible=ratio>.5&&document.visibilityState==='visible'&&isYouTubePlayerVisible();
 if(visible&&autoRequested&&player&&playerReady){autoRequested=false;player.playVideo()}
 else if(!visible&&player&&playerReady&&player.getPlayerState?.()===1)player.pauseVideo()
}
function watchVisibility(){
 clearVisibilityWatch();
 if(!playerElement)return;
 if(typeof IntersectionObserver==='function'){
  visibilityObserver=new IntersectionObserver(entries=>{const entry=entries.find(item=>item.target===playerElement);onVisibility(entry?.intersectionRatio||0)},{threshold:[0,.5,1]});visibilityObserver.observe(playerElement);
 }else{
  fallbackVisibilityCheck=()=>onVisibility(visibleAreaRatio(playerElement));window.addEventListener('scroll',fallbackVisibilityCheck,true);window.addEventListener('resize',fallbackVisibilityCheck);document.addEventListener('visibilitychange',fallbackVisibilityCheck)
 }
}
function notifyState(event){
 const stateCode=event.data;
 if(stateCode===2)autoRequested=false;
 if(stateCode===1&&!isYouTubePlayerVisible())player?.pauseVideo();
 try{callbacks.onStateChange?.(stateCode)}catch(error){}
}
function notifyError(event){autoRequested=false;clearTimeout(readinessTimer);readinessTimer=null;try{callbacks.onError?.(event.data)}catch(error){}}
function ready(event){
 clearTimeout(readinessTimer);readinessTimer=null;playerReady=true;player=event.target||player;const iframe=player?.getIframe?.();
 if(iframe){iframe.title='YouTube video player';iframe.setAttribute('referrerpolicy','strict-origin-when-cross-origin')}
 try{callbacks.onReady?.()}catch(error){}watchVisibility()
}
export async function loadYouTubePlayer(videoId,container,options={}){
 if(!validVideoId(videoId))throw new Error('This YouTube video link is invalid.');
 if(!isYouTubeEnabled())throw new Error('Enable YouTube in Settings and agree to the privacy policy and YouTube Terms before playback.');
 autoRequested=!!options.autoplay;callbacks=options;playerElement=container;
 const YT=await loadApi();
 if(player){try{player.destroy()}catch(error){}player=null}playerReady=false;
 const iframe=document.createElement('iframe'),embed=new URL('https://www.youtube-nocookie.com/embed/'+encodeURIComponent(videoId));
 embed.searchParams.set('enablejsapi','1');embed.searchParams.set('origin',location.origin);embed.searchParams.set('autoplay','0');embed.searchParams.set('controls','1');embed.searchParams.set('playsinline','1');
 iframe.src=embed.href;iframe.title='YouTube video player';iframe.width='560';iframe.height='315';iframe.allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';iframe.allowFullscreen=true;iframe.referrerPolicy='strict-origin-when-cross-origin';container.replaceChildren(iframe);
 try{player=new YT.Player(iframe,{events:{onReady:ready,onStateChange:notifyState,onError:notifyError}});readinessTimer=window.setTimeout(()=>{if(!playerReady)notifyError({data:0})},15000);watchVisibility();return player}catch(error){clearTimeout(readinessTimer);readinessTimer=null;stopYouTubePlayback();throw new Error('The YouTube player could not start. Check your connection and try again.')}
}
export function pauseYouTubePlayback(){autoRequested=false;if(player){try{player.pauseVideo()}catch(error){}}}
export function stopYouTubePlayback(){pauseYouTubePlayback();clearTimeout(readinessTimer);readinessTimer=null;clearVisibilityWatch();if(player){try{player.destroy()}catch(error){}player=null}playerReady=false;playerElement=null;callbacks={}}
export function playYouTubePlayback(){if(!player||!isYouTubePlayerVisible())return false;autoRequested=false;try{player.playVideo();return true}catch(error){return false}}
export function isYouTubePlaying(){try{return !!player&&player.getPlayerState()===1}catch(error){return false}}
export function getYouTubeTime(){try{return {currentTime:Number(player?.getCurrentTime?.())||0,duration:Number(player?.getDuration?.())||0}}catch(error){return {currentTime:0,duration:0}}}
export function updateYouTubeVisibility(){if(document.visibilityState!=='visible'){visibleRatio=0;pauseYouTubePlayback()}else if(playerElement)watchVisibility()}
