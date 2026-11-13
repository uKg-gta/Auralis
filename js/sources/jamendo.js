import {state} from '../core.js';

const API='https://api.jamendo.com/v3.0';
const CACHE_MS=2*60*1000;
const memoryCache=new Map();
function clientId(){return String(state.prefs.jamendoClientId||'').trim()}
function licenseInfo(value){
 const url=String(value||'').replace(/^http:/i,'https:');const slug=url.match(/creativecommons\.org\/licenses\/([^/]+)\/([^/]+)/i);
 if(!slug)return {label:'Creative Commons',url,flags:[]};
 const code=slug[1].toUpperCase().split('-'),flags=code.filter(part=>['NC','ND','SA'].includes(part));
 return {label:'CC '+code.join('-')+' '+slug[2],url,flags}
}
function normalize(raw){
 const lic=licenseInfo(raw.license_ccurl||raw.licenses?.ccurl||''),id=String(raw.id||'');if(!id)return null;
 const url=raw.shareurl||raw.shorturl||('https://www.jamendo.com/track/'+encodeURIComponent(id));
 return {id:'jamendo:'+id,source:'jamendo',providerId:id,sourceUrl:url,providerUrl:url,artistUrl:raw.artist_id?'https://www.jamendo.com/artist/'+encodeURIComponent(raw.artist_id):'',title:String(raw.name||'Untitled track'),artist:String(raw.artist_name||'Unknown artist'),album:String(raw.album_name||''),artworkUrl:raw.image||raw.album_image||'',artworkType:'image/jpeg',duration:Number(raw.duration)||0,audioUrl:String(raw.audio||''),license:lic.label,licenseUrl:lic.url,licenseFlags:lic.flags,genre:String(raw.musicinfo?.tags?.genres?.[0]||''),added:0,categories:[],liked:false,lyrics:''}
}
async function request(params={},signal){
 if(!navigator.onLine)throw new Error('You are offline. Connect to the internet to browse Jamendo.');
 const id=clientId();if(!id)throw new Error('Add a free Jamendo client_id in Settings to browse Jamendo.');
 const url=new URL(API+'/tracks/');url.searchParams.set('client_id',id);url.searchParams.set('format','json');url.searchParams.set('limit','20');url.searchParams.set('include','licenses musicinfo');url.searchParams.set('audioformat','mp32');url.searchParams.set('type','single albumtrack');
 Object.entries(params).forEach(([key,value])=>{if(value!==undefined&&value!==null&&value!=='')url.searchParams.set(key,String(value))});
 const response=await fetch(url,{headers:{Accept:'application/json'},cache:'no-store',signal});let payload={};try{payload=await response.json()}catch(error){}
 if(!response.ok||payload.headers?.status==='error')throw new Error(payload.headers?.error_message||('Jamendo returned '+response.status));
 return payload
}
function cacheGet(key){const item=memoryCache.get(key);if(!item)return null;if(Date.now()-item.time>CACHE_MS){memoryCache.delete(key);return null}return item.value}
function cacheSet(key,value){memoryCache.set(key,{time:Date.now(),value});while(memoryCache.size>20)memoryCache.delete(memoryCache.keys().next().value);return value}
export async function search(query,opts={}){
 const clean=String(query||'').trim();if(!clean)return {tracks:[],nextOffset:0,hasMore:false};const offset=Math.max(0,Number(opts.offset)||0),cacheKey=clean.toLowerCase()+'|'+offset,cached=cacheGet(cacheKey);if(cached)return cached;
 const payload=await request({search:clean,offset},opts.signal);const tracks=(payload.results||[]).map(normalize).filter(track=>track?.audioUrl);
 return cacheSet(cacheKey,{tracks,nextOffset:offset+tracks.length,hasMore:tracks.length===20,total:Number(payload.headers?.results_fullcount)||null})
}
export async function browse(mode='popular'){
 const params=mode==='new'?{order:'releasedate_desc'}:mode==='search'?{search:'independent music'}:{order:'popularity_month'};
 const payload=await request(params);return (payload.results||[]).map(normalize).filter(track=>track?.audioUrl)
}
export async function hydrate(ids=[]){
 const unique=Array.from(new Set(ids.map(String).filter(Boolean))).slice(0,50);if(!unique.length)return [];
 const payload=await request({id:unique.join(',')});return (payload.results||[]).map(normalize).filter(track=>track?.audioUrl)
}
export function getPlayable(track){return track?.source==='jamendo'&&track.audioUrl?{kind:'audio',url:track.audioUrl}:null}
export const capabilities=Object.freeze({backgroundPlayback:true,mediaSession:true,offline:false});
export const license=Object.freeze({name:'Creative Commons',url:'https://creativecommons.org/licenses/',description:'Each Jamendo track has its own license; display attribution and license details.'});
