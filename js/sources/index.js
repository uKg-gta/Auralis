import {state,byId} from '../core.js';
import {put,remove} from '../storage.js';
import {searchAudiusTracks,loadAudiusShelf,streamTrackUrl,saveStreamTrack} from '../features/catalog.js';
import * as youtube from './youtube.js';
import * as jamendo from './jamendo.js';
import * as musicbrainz from './musicbrainz.js';

const audius={id:'audius',name:'Audius',search:async(query,opts={})=>({tracks:await searchAudiusTracks(query,opts.signal),nextPageToken:''}),browse:loadAudiusShelf,getPlayable:track=>track?.source==='audius'?{kind:'audio',url:streamTrackUrl(track)}:null,capabilities:Object.freeze({backgroundPlayback:true,mediaSession:true,offline:false}),license:Object.freeze({name:'Audius / artist rights',url:'https://audius.co/documents/TermsOfUse.pdf',description:'Track availability and rights remain with each artist.'}),hydrate:async()=>[]};
export const sourceRegistry=Object.freeze({audius,youtube,jamendo,musicbrainz});
export function getSource(name){return sourceRegistry[name]||null}
function rememberCatalogTracks(tracks){
 const known=new Map(state.catalogTracks.map(track=>[track.id,track]));for(const track of tracks||[])if(track?.id&&!state.tracks.some(saved=>saved.id===track.id))known.set(track.id,track);
 const retained=Array.from(known.values()),pinned=new Set([state.currentTrackId,...state.queueIds]);while(retained.length>300){const index=retained.findIndex(track=>!pinned.has(track.id));if(index<0)break;retained.splice(index,1)}state.catalogTracks=retained;return tracks
}
export async function searchSource(name,query,opts={}){const source=getSource(name);if(!source?.search)throw new Error('This source cannot be searched.');const result=await source.search(query,opts);rememberCatalogTracks(Array.isArray(result)?result:result?.tracks);return result}
export async function browseSource(name,mode){const source=getSource(name);if(!source?.browse)throw new Error('This source cannot be browsed.');const result=await source.browse(mode);rememberCatalogTracks(Array.isArray(result)?result:result?.tracks);return result}
export function playableTrack(track){return getSource(track?.source)?.getPlayable?.(track)||null}
export async function saveSourceTrack(trackId){
 const track=byId(trackId);if(!track)return null;
 if(track.source==='audius')return saveStreamTrack(trackId);
 if(track.source!=='youtube'&&track.source!=='jamendo')return track;
 if(track.source==='youtube'&&!youtube.isYouTubeEnabled())throw new Error('Enable YouTube in Settings before saving YouTube videos.');
 const existing=state.tracks.find(item=>item.id===trackId);if(existing)return track;
 const providerId=String(track.providerId||'');
 if(track.source==='youtube'&&!/^[A-Za-z0-9_-]{11}$/.test(providerId))throw new Error('This YouTube video is no longer available.');
 if(track.source==='jamendo'&&!providerId)throw new Error('This Jamendo track is no longer available.');
 const added=Date.now(),reference={id:track.id,source:track.source,providerId,sourceUrl:track.source==='youtube'?'https://www.youtube.com/watch?v='+encodeURIComponent(providerId):String(track.sourceUrl||track.providerUrl||''),added,categories:[],liked:false,...(track.source==='youtube'?{youtubeDataCheckedAt:added}:{})};
 await put('tracks',reference);state.tracks.push(reference);state.tracks.sort((a,b)=>(a.added||0)-(b.added||0));return track
}
export async function hydrateSavedSources(){
 const youtubeRefs=state.tracks.filter(track=>track.source==='youtube'&&track.providerId),jamendoRefs=state.tracks.filter(track=>track.source==='jamendo'&&track.providerId);
 await Promise.allSettled([
  youtubeRefs.length&&youtube.isYouTubeEnabled()&&String(state.prefs.youtubeApiKey||'').trim()?hydrateInBatches(youtubeRefs,youtube.hydrate,'youtube'):Promise.resolve(),
  jamendoRefs.length?hydrateInBatches(jamendoRefs,jamendo.hydrate,'jamendo'):Promise.resolve()
 ])
}
export async function revalidateSavedYoutubeReferences(){
 const now=Date.now(),maxAge=30*24*60*60*1000,refreshAge=29*24*60*60*1000;
 const references=state.tracks.filter(track=>track.source==='youtube'&&track.providerId&&(!Number(track.youtubeDataCheckedAt)||now-Number(track.youtubeDataCheckedAt)>=refreshAge));
 const expiredMetadata=new Set([...state.catalogTracks,...(state.homeCatalog.youtube||[])].filter(track=>track.source==='youtube'&&(!Number(track.apiFetchedAt)||now-Number(track.apiFetchedAt)>=maxAge)).map(track=>track.id));
 state.catalogTracks=state.catalogTracks.filter(track=>!expiredMetadata.has(track.id));state.homeCatalog.youtube=(state.homeCatalog.youtube||[]).filter(track=>!expiredMetadata.has(track.id));
 if(references.length&&youtube.isYouTubeEnabled()&&String(state.prefs.youtubeApiKey||'').trim()&&navigator.onLine){try{await hydrateInBatches(references,youtube.hydrate,'youtube')}catch(error){}}
 return false
}
async function hydrateInBatches(references,hydrate,source){for(let offset=0;offset<references.length;offset+=50){const group=references.slice(offset,offset+50),tracks=await hydrate(group.map(track=>track.providerId));if(source==='youtube'){const checkedAt=Date.now();for(const reference of group){reference.youtubeDataCheckedAt=checkedAt;await put('tracks',reference)}}for(const track of tracks)mergeReference(track,references)}}
function mergeReference(track,references){const saved=references.find(item=>item.providerId===track.providerId);if(!saved)return;track.id=saved.id;track.added=saved.added||0;track.liked=!!saved.liked;track.categories=Array.isArray(saved.categories)?saved.categories:[];state.catalogTracks=state.catalogTracks.filter(item=>item.id!==track.id);state.catalogTracks.push(track)}
export async function saveSourceCredentials({youtubeApiKey,youtubeConsent,jamendoClientId}){
 const previousYoutubeKey=String(state.prefs.youtubeApiKey||''),previousConsent=state.prefs.youtubeConsent===true;
 if(youtubeApiKey!==undefined)state.prefs.youtubeApiKey=String(youtubeApiKey).trim();
 if(youtubeConsent!==undefined)state.prefs.youtubeConsent=!!youtubeConsent;
 if(jamendoClientId!==undefined)state.prefs.jamendoClientId=String(jamendoClientId).trim();
 await put('settings',{key:'preferences',value:state.prefs});
 if(previousYoutubeKey!==state.prefs.youtubeApiKey||previousConsent!==state.prefs.youtubeConsent){youtube.clearYouTubeMemory();state.catalogTracks=state.catalogTracks.filter(track=>track.source!=='youtube');state.homeCatalog.youtube=[];delete state.homeSourceErrors.youtube}
 state.refreshAll();
}
export async function loadHomeSources(){
 const tasks=[];
 if(youtube.isYouTubeEnabled()&&String(state.prefs.youtubeApiKey||'').trim())tasks.push(searchSource('youtube','Bollywood official music video').then(result=>({id:'homeYoutube',tracks:result.tracks})).catch(error=>({id:'homeYoutube',error})));
 if(String(state.prefs.jamendoClientId||'').trim())tasks.push(browseSource('jamendo','popular').then(tracks=>({id:'homeJamendo',tracks})).catch(error=>({id:'homeJamendo',error})));
 const results=await Promise.allSettled(tasks);return results.map(result=>result.status==='fulfilled'?result.value:{error:result.reason})
}
export const providerSources=Object.freeze(['audius','youtube','jamendo']);
