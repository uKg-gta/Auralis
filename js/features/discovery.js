import {state,$,esc,toast,byId,artworkClass,artworkUrl,icon} from '../core.js';
import {add,put} from '../storage.js';
import {discoverFromProviders} from '../providers/provider-registry.js';

const FAMILIAR_SHARE=.60,FEED_SIZE=10;
let candidates=[],loading=null,loaded=false,activeTrackId=null,lastPosition=0,sessionSeconds=0,totalSessionSeconds=0,lastSignalAt=0;

function snapshot(track){return {id:track.id,provider:track.provider||'local',source:track.source||'local',title:track.title||track.name||'Unknown track',artist:track.artist||'Unknown artist',genre:track.genre||'',album:track.album||'',providerId:track.providerId||''}}
export async function recordDiscoverySignal(type,track,extra={}){
 if(!track)return;
 const event={type,trackId:track.id,provider:track.provider||'local',track:snapshot(track),timestamp:Date.now(),...extra};
 try{event.id=await add('listeningSignals',event);state.listeningSignals.push(event)}catch(error){}
}
function flushPlaybackSignal(){
 if(!activeTrackId||sessionSeconds<1)return;
 const track=byId(activeTrackId)||candidates.find(item=>item.id===activeTrackId);
 if(track)recordDiscoverySignal('play_progress',track,{playedSeconds:Math.round(sessionSeconds),sessionPlayedSeconds:Math.round(totalSessionSeconds)});
 sessionSeconds=0;lastSignalAt=Date.now();
}
function trackChanged(track){
 if(activeTrackId&&activeTrackId!==track?.id)flushPlaybackSignal();
 activeTrackId=track?.id||null;sessionSeconds=0;totalSessionSeconds=0;lastPosition=0;
 if(track)recordDiscoverySignal('play_started',track);
}
function buildProfile(){
 const profile={artists:Object.create(null),genres:Object.create(null),searchTerms:[],hasTaste:false};
 const addScore=(track,score)=>{if(!track)return;const artist=(track.artist||'').trim().toLowerCase(),genre=(track.genre||'').trim().toLowerCase();if(artist)profile.artists[artist]=(profile.artists[artist]||0)+score;if(genre)profile.genres[genre]=(profile.genres[genre]||0)+score};
 state.tracks.filter(track=>track.liked).forEach(track=>addScore(track,4));
 state.listeningSignals.forEach(event=>{
  if(event.type==='search_performed'&&event.query)profile.searchTerms.push(String(event.query).toLowerCase());
  const track=event.track||byId(event.trackId);if(!track)return;
  if(event.type==='play_started')addScore(track,.5);
  else if(event.type==='play_progress')addScore(track,Math.min(3,(Number(event.playedSeconds)||0)/90));
  else if(event.type==='play_completed')addScore(track,3);
  else if(event.type==='track_replayed')addScore(track,2);
  else if(event.type==='track_skipped')addScore(track,-1.5);
  else if(event.type==='more_like_this')addScore(track,4);
  else if(event.type==='track_liked')addScore(track,4);
  else if(event.type==='playlist_added')addScore(track,2);
 });
 profile.hasTaste=profile.searchTerms.length>0||Object.values(profile.artists).some(value=>value>1)||Object.values(profile.genres).some(value=>value>1);
 return profile;
}
function isExcluded(track){
 const prefs=state.discoveryPreferences||{};
 return (prefs.hiddenTrackIds||[]).includes(track.id)||(prefs.excludedArtists||[]).some(value=>value.toLowerCase()===(track.artist||'').toLowerCase())||(prefs.excludedGenres||[]).some(value=>value.toLowerCase()===(track.genre||'').toLowerCase());
}
function uniqueEligible(list){const seen=new Set();return list.filter(track=>{if(!track||!track.id||isExcluded(track))return false;const provider=track.provider||(track.source==='local'?'local':'audius'),supported=track.source!=='youtube'&&provider!=='youtube'&&(track.source!=='stream'||['audius','jamendo'].includes(provider));if(!supported||seen.has(track.id))return false;seen.add(track.id);return true})}
function score(profile,track){const text=[track.title,track.artist,track.genre,track.album].join(' ').toLowerCase(),searchBoost=profile.searchTerms.slice(-30).reduce((sum,term)=>sum+(term.length>2&&text.includes(term)?0.8:0),0);return (profile.artists[(track.artist||'').toLowerCase()]||0)*1.25+(profile.genres[(track.genre||'').toLowerCase()]||0)*1.8+searchBoost}
function compose(){
 const profile=buildProfile(),pool=uniqueEligible([...state.tracks,...candidates,...state.catalogTracks]);
 if(!profile.hasTaste)return {made:pool.slice(0,FEED_SIZE),familiar:[],fresh:pool.slice(FEED_SIZE,FEED_SIZE+8),profile};
 const ranked=pool.map(track=>({track,value:score(profile,track)})).sort((a,b)=>b.value-a.value);
 const familiar=ranked.filter(item=>item.value>0).map(item=>item.track),explore=ranked.filter(item=>item.value<=0).map(item=>item.track);
 const familiarCount=Math.min(Math.round(FEED_SIZE*FAMILIAR_SHARE),familiar.length),exploreCount=Math.min(FEED_SIZE-familiarCount,explore.length);
 const made=[...familiar.slice(0,familiarCount),...explore.slice(0,exploreCount)];
 if(made.length<FEED_SIZE){const used=new Set(made.map(track=>track.id));made.push(...ranked.map(item=>item.track).filter(track=>!used.has(track.id)).slice(0,FEED_SIZE-made.length))}
 return {made,familiar:familiar.slice(0,8),fresh:explore.slice(0,8),profile};
}
function card(track){
 const url=artworkUrl(track),art='<span class="card-art art '+artworkClass(track)+'">'+(url?'<img src="'+esc(url)+'" alt="">':'')+'<span class="card-play">'+icon('play')+'</span></span>';
 return '<article class="discovery-card"><button class="music-card" data-play-track="'+esc(track.id)+'" aria-label="Play '+esc(track.title)+' by '+esc(track.artist)+'">'+art+'<span class="card-title">'+esc(track.title)+'</span><span class="card-subtitle">'+esc(track.artist)+'</span></button></article>';
}
function renderShelf(id,tracks,message){
 const section=$(id),box=section?.querySelector('.card-shelf');if(!section||!box)return;
 section.hidden=!tracks.length;box.innerHTML=tracks.map(card).join('');
 const empty=section.querySelector('.discovery-status');if(empty){empty.hidden=!!tracks.length;empty.textContent=message}
}
export function renderDiscovery(){
 const result=compose();
 renderShelf('homeMadeForYouSection',result.made,'Recommendations from your library and streaming catalogues will appear here.');
 renderShelf('homeBecauseSection',result.familiar,'Listen to a few songs to build your personalised picks.');
 renderShelf('homeFreshSection',result.fresh,'New tracks will appear here.');
 const note=$('discoveryMixNote');if(note)note.textContent=result.profile.hasTaste?'A balanced mix: 60% familiar sounds and 40% new discoveries.':'Starting with Audius trending, underground and new releases.';
}
export async function loadDiscovery(force=false){
 if(loaded&&!force)return;
 if(loading&&!force)return loading;
 loading=(async()=>{
  const statusBox=$('discoveryStatus');if(statusBox){statusBox.hidden=false;statusBox.textContent='Finding music on Audius…'}
  let timeoutId;
  try{
   const timeout=new Promise((resolve,reject)=>{timeoutId=setTimeout(()=>reject(new Error('Discovery timed out')),16000)});
   candidates=await Promise.race([discoverFromProviders(['audius']),timeout]);
   loaded=true;renderDiscovery();
   if(statusBox){statusBox.hidden=!!candidates.length;if(!candidates.length)statusBox.textContent='Audius did not return any playable tracks. Try again in a moment.'}
  }catch(error){
   loaded=false;
   if(statusBox){statusBox.hidden=false;statusBox.innerHTML='Audius discovery is taking too long or is unavailable. <button type="button" class="text-button" data-discovery-retry>Try again</button>'}
  }finally{clearTimeout(timeoutId);loading=null}
 })();return loading;
}
async function savePreferences(){try{await put('settings',{key:'discoveryPreferences',value:state.discoveryPreferences})}catch(error){toast('Could not save discovery preferences')}}
export async function hideRecommendation(id){
 if(!id)return;const hidden=state.discoveryPreferences.hiddenTrackIds||[];if(!hidden.includes(id))state.discoveryPreferences.hiddenTrackIds=hidden.concat(id);
 await savePreferences();renderDiscovery();toast('Recommendation hidden');
}
export async function moreLikeRecommendation(id){
 const track=byId(id)||candidates.find(item=>item.id===id);if(!track)return;
 await recordDiscoverySignal('more_like_this',track);renderDiscovery();toast('We’ll recommend more like this');
}
export async function resetTasteProfile(){
 if(!confirm('Reset listening-based discovery learning? Your listening history and liked songs will be kept, and liked songs will still influence recommendations.'))return;
 state.listeningSignals=[];try{await new Promise((resolve,reject)=>{const tx=state.db.transaction('listeningSignals','readwrite');tx.objectStore('listeningSignals').clear();tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}catch(error){toast('Could not reset the taste profile');return}
 renderDiscovery();toast('Listening-based discovery learning reset. Likes are still used.');
}
export function initDiscovery(){
 state.audio.addEventListener('play',()=>{const track=byId(state.currentTrackId);if(track&&track.id!==activeTrackId)trackChanged(track)});
 state.audio.addEventListener('timeupdate',()=>{
  const track=byId(state.currentTrackId);if(!track)return;
  if(track.id!==activeTrackId)trackChanged(track);
  const position=Number(state.audio.currentTime)||0,delta=Math.max(0,Math.min(4,position-lastPosition));
  if(!state.audio.paused&&delta>0){sessionSeconds+=delta;totalSessionSeconds+=delta}
  lastPosition=position;if(sessionSeconds>=30&&Date.now()-lastSignalAt>25000)flushPlaybackSignal();
 });
 state.audio.addEventListener('pause',flushPlaybackSignal);
 state.audio.addEventListener('ended',()=>{
  const track=byId(activeTrackId);if(track)recordDiscoverySignal('play_completed',track,{playedSeconds:Math.round(totalSessionSeconds)});
  sessionSeconds=0;totalSessionSeconds=0;activeTrackId=null;
 });
 document.addEventListener('click',event=>{
  const retry=event.target.closest('[data-discovery-retry]');
  if(retry){loadDiscovery(true);return}
 });
 const search=$('searchInput');let searchTimer=null;
 search?.addEventListener('input',()=>{clearTimeout(searchTimer);const query=search.value.trim();if(query.length<3)return;searchTimer=setTimeout(()=>{const event={type:'search_performed',query:query.slice(0,80),timestamp:Date.now()};add('listeningSignals',event).then(id=>state.listeningSignals.push({...event,id})).catch(()=>{})},900)});
 renderDiscovery();
}
