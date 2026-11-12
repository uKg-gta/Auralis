export const state={
 db:null,tracks:[],playlists:[],categories:[],history:[],
 currentTrackId:null,queueIds:[],queueIndex:-1,shuffle:false,repeatMode:'off',
 libraryFilter:'all',searchFilter:'all',selectedPlaylistId:null,dialogTrackId:null,
 prefs:{theme:'dark',accent:'#f4d447',volume:0.8,lastVolume:0.8},objectUrl:null,sleepTimer:null,
 sessionId:null,sessionRecord:null,lastPosition:0,pendingSeconds:0,lastPersist:0,
 audio:document.getElementById('localAudio'),refreshAll:function(){},renderSearch:function(){},renderCurrent:function(){}
};
export const $=id=>document.getElementById(id);
export function makeId(){return globalThis.crypto&&crypto.randomUUID?crypto.randomUUID():String(Date.now())+'-'+Math.random().toString(36).slice(2)}
export function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
export function formatDuration(seconds){seconds=Math.max(0,Math.floor(Number(seconds)||0));const hours=Math.floor(seconds/3600),mins=Math.floor((seconds%3600)/60),secs=seconds%60;return hours?hours+'h '+String(mins).padStart(2,'0')+'m':mins?mins+'m '+String(secs).padStart(2,'0')+'s':seconds+'s'}
export function formatClock(seconds){seconds=Math.max(0,Math.floor(Number(seconds)||0));return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0')}
export function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(window.__auralisToast);window.__auralisToast=setTimeout(()=>el.classList.remove('show'),2200)}
export function status(message){const el=$('playerStatus');if(el)el.textContent=message}
export function byId(trackId){return state.tracks.find(track=>track.id===trackId)||null}
export function sortTracks(list){return list.slice().sort((a,b)=>(a.added||0)-(b.added||0))}
export function uniqueRecent(){const seen=new Set(),result=[];state.history.slice().sort((a,b)=>(b.startedAt||0)-(a.startedAt||0)).forEach(item=>{if(seen.has(item.trackId))return;const track=byId(item.trackId);if(track){seen.add(item.trackId);result.push(track)}});return result}
export function artworkClass(track){let hash=0;const title=String(track&&track.title||'');for(let i=0;i<title.length;i++)hash=(hash+title.charCodeAt(i))%5;return ['a1','a2','a3','a4','a5'][hash]}
export function playlistTrackIds(playlist){return (playlist.trackIds||[]).filter(trackId=>!!byId(trackId))}
export function trackRow(track,options={}){const art=artworkClass(track),liked=!!track.liked;let extra='';if(options.playlist){const positioned=Number.isInteger(options.playlistIndex)&&Number.isInteger(options.playlistCount),atStart=positioned&&options.playlistIndex===0,atEnd=positioned&&options.playlistIndex===options.playlistCount-1;extra='<button data-move-playlist="'+esc(track.id)+'" data-dir="-1" aria-label="Move track up"'+(atStart?' disabled':'')+'>↑</button><button data-move-playlist="'+esc(track.id)+'" data-dir="1" aria-label="Move track down"'+(atEnd?' disabled':'')+'>↓</button><button data-remove-playlist="'+esc(track.id)+'" aria-label="Remove from playlist">×</button>'}return '<div class="track-item"><div class="thumb art '+art+'"></div><div class="meta"><b>'+esc(track.title||track.name||'Unknown track')+'</b><span>'+esc(track.artist||'Unknown artist')+'</span></div><div class="track-buttons"><button class="track-play" data-play-track="'+esc(track.id)+'" aria-label="Play '+esc(track.title||track.name)+'">▶</button><button class="'+(liked?'liked':'')+'" data-toggle-like="'+esc(track.id)+'" aria-pressed="'+(liked?'true':'false')+'" aria-label="'+(liked?'Unlike':'Like')+' track">'+(liked?'♥':'♡')+'</button><button data-track-menu="'+esc(track.id)+'" aria-label="Track actions">•••</button>'+extra+'</div></div>'}
