export const state={
 db:null,tracks:[],catalogTracks:[],playlists:[],categories:[],history:[],
 currentTrackId:null,queueIds:[],queueBaseIds:[],queueIndex:-1,shuffle:false,repeatMode:'off',
 libraryFilter:'all',librarySource:'all',librarySection:'overview',searchFilter:'all',searchScope:'library',selectedPlaylistId:null,selectedArtistName:null,selectedAlbumName:null,dialogTrackId:null,
 prefs:{theme:'dark',accent:'#fa2d48',volume:.8,lastVolume:.8,librarySort:'recent',largeText:false,recentSearches:[]},
 objectUrl:null,artworkUrls:new Map(),sleepTimer:null,sessionId:null,sessionRecord:null,lastPosition:0,pendingSeconds:0,lastPersist:0,
 homeSource:'all',audio:document.getElementById('localAudio'),refreshAll:function(){},renderSearch:function(){},renderCurrent:function(){}
};
export const $=id=>document.getElementById(id);
export function makeId(){return globalThis.crypto&&crypto.randomUUID?crypto.randomUUID():String(Date.now())+'-'+Math.random().toString(36).slice(2)}
export function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
export function icon(name,className=''){return '<svg class="icon'+(className?' '+esc(className):'')+'" aria-hidden="true" focusable="false"><use href="#icon-'+esc(name)+'"></use></svg>'}
export function formatDuration(seconds){seconds=Math.max(0,Math.floor(Number(seconds)||0));const hours=Math.floor(seconds/3600),mins=Math.floor((seconds%3600)/60),secs=seconds%60;return hours?hours+'h '+String(mins).padStart(2,'0')+'m':mins?mins+'m '+String(secs).padStart(2,'0')+'s':seconds+'s'}
export function formatClock(seconds){seconds=Math.max(0,Math.floor(Number(seconds)||0));return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0')}
export function toast(message){const el=$('toast');if(!el)return;el.textContent=message;el.classList.add('show');clearTimeout(window.__auralisToast);window.__auralisToast=setTimeout(()=>el.classList.remove('show'),2500)}
export function status(message){const el=$('playerStatus');if(el)el.textContent=message}
export function byId(trackId){return state.tracks.find(track=>track.id===trackId)||state.catalogTracks.find(track=>track.id===trackId)||null}
export function sortTracks(list,mode='recent'){const result=list.slice();if(mode==='az')return result.sort((a,b)=>(a.title||a.name||'').localeCompare(b.title||b.name||'',undefined,{sensitivity:'base'}));if(mode==='artist')return result.sort((a,b)=>(a.artist||'').localeCompare(b.artist||'',undefined,{sensitivity:'base'})||(a.title||a.name||'').localeCompare(b.title||b.name||''));return result.sort((a,b)=>(b.added||0)-(a.added||0))}
export function uniqueRecent(){const seen=new Set(),result=[];state.history.slice().sort((a,b)=>(b.startedAt||0)-(a.startedAt||0)).forEach(item=>{if(seen.has(item.trackId))return;const track=byId(item.trackId);if(track){seen.add(item.trackId);result.push(track)}});return result}
export function artworkClass(track){let hash=0;const title=String(track&&(track.album||track.title)||'');for(let i=0;i<title.length;i++)hash=(hash+title.charCodeAt(i))%5;return ['a1','a2','a3','a4','a5'][hash]}
export function artworkUrl(track){if(!track)return '';if(track.artworkUrl)return track.artworkUrl;if(!(track.artwork instanceof Blob))return '';if(!state.artworkUrls.has(track.id))state.artworkUrls.set(track.id,URL.createObjectURL(track.artwork));return state.artworkUrls.get(track.id)}
export function releaseArtwork(trackId){const url=state.artworkUrls.get(trackId);if(url){URL.revokeObjectURL(url);state.artworkUrls.delete(trackId)}}
export function playlistTrackIds(playlist){return (playlist.trackIds||[]).filter(trackId=>!!byId(trackId))}
export function highlight(value,query){const safe=esc(value||'');if(!query)return safe;const escaped=String(query).replace(/[.*+?^$()|[\]\\]/g,'\\$&');try{return safe.replace(new RegExp('('+escaped+')','ig'),'<mark>$1</mark>')}catch(error){return safe}}
export function artMarkup(track,className='thumb'){const url=artworkUrl(track),cls=esc(className+' art '+artworkClass(track));return '<span class="'+cls+'" aria-hidden="true">'+(url?'<img class="cover-image" src="'+esc(url)+'" alt="">':'')+'</span>'}
export function trackRow(track,options={}){
 const title=track.title||track.name||'Unknown track',artist=track.artist||'Unknown artist',query=options.query||'';
 const collection=Array.isArray(options.collectionIds)&&options.collectionIds.length?' data-play-collection="'+esc(options.collectionIds.join(','))+'"':'';
 let extra='';
 if(options.playlist){const positioned=Number.isInteger(options.playlistIndex)&&Number.isInteger(options.playlistCount),atStart=positioned&&options.playlistIndex===0,atEnd=positioned&&options.playlistIndex===options.playlistCount-1;extra='<button class="track-extra" data-move-playlist="'+esc(track.id)+'" data-dir="-1" aria-label="Move '+esc(title)+' up"'+(atStart?' disabled':'')+'>'+icon('arrow-up')+'</button><button class="track-extra" data-move-playlist="'+esc(track.id)+'" data-dir="1" aria-label="Move '+esc(title)+' down"'+(atEnd?' disabled':'')+'>'+icon('arrow-down')+'</button><button class="track-extra" data-remove-playlist="'+esc(track.id)+'" aria-label="Remove '+esc(title)+' from playlist">'+icon('close')+'</button>'}
 return '<article class="track-item" data-track-row data-track-id="'+esc(track.id)+'"><button class="track-main" data-play-track="'+esc(track.id)+'"'+collection+' aria-label="Play '+esc(title)+' by '+esc(artist)+'">'+artMarkup(track,'thumb')+'<span class="meta"><b>'+highlight(title,query)+'</b><span>'+highlight(artist,query)+(track.album?' · '+esc(track.album):'')+'</span></span></button><button class="track-more" data-track-menu="'+esc(track.id)+'" aria-label="More actions for '+esc(title)+'" aria-haspopup="dialog">'+icon('more')+'</button>'+extra+'</article>'
}


