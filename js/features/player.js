import {state,$,esc,toast,status,formatClock,byId,artworkClass,artworkUrl,icon} from '../core.js';
import {add,put} from '../storage.js';
import {playableTrack} from '../sources/index.js';
import {loadYouTubePlayer,pauseYouTubePlayback,stopYouTubePlayback,playYouTubePlayback,isYouTubePlaying,isYouTubePlayerVisible,updateYouTubeVisibility,getYouTubeTime} from '../sources/youtube.js';
let volumeSaveTimer=null;
let queueTrigger=null;
function playbackMessage(){const source=byId(state.currentTrackId)?.source;return source==='youtube'?'Playing in the visible YouTube player':source==='jamendo'?'Streaming from Jamendo':source==='audius'?'Streaming from Audius':'Playing from your device'}
function mediaSession(){return typeof navigator!=='undefined'&&navigator.mediaSession?navigator.mediaSession:null}
function historyTrackSnapshot(track){
 if(track?.source!=='audius')return undefined;
 return {id:track.id,source:'audius',provider:'audius',providerId:track.providerId||'',title:track.title||track.name||'Untitled track',artist:track.artist||'Unknown artist',album:track.album||'',genre:track.genre||'',duration:Number(track.duration)||0,artworkUrl:track.artworkUrl||'',artworkType:track.artworkType||'image/jpeg',providerUrl:track.providerUrl||'',sourceUrl:track.sourceUrl||track.providerUrl||'',artistUrl:track.artistUrl||'',artistId:track.artistId||'',added:0,categories:[],liked:false,lyrics:''}
}
function updateMediaPosition(){
 const session=mediaSession(),duration=state.audio.duration;if(!session||typeof session.setPositionState!=='function'||!Number.isFinite(duration)||duration<=0)return;
 try{session.setPositionState({duration,playbackRate:state.audio.playbackRate||1,position:Math.max(0,Math.min(duration,state.audio.currentTime||0))})}catch(error){}
}
function updateMediaSession(){
 const session=mediaSession();if(!session)return;const track=byId(state.currentTrackId);
 try{
  if(!track||track.source==='youtube'){session.metadata=null;session.playbackState='none';for(const action of ['play','pause','previoustrack','nexttrack','seekbackward','seekforward','seekto','stop']){try{session.setActionHandler(action,null)}catch(error){}}return}
  installMediaSession();
  const artwork=artworkUrl(track),metadata={title:track.title||track.name||'Unknown track',artist:track.artist||'Unknown artist',album:track.album||'Auralis'};
  if(artwork)metadata.artwork=[{src:artwork,sizes:'512x512',type:track.artworkType||'image/jpeg'}];
  if(typeof MediaMetadata==='function')session.metadata=new MediaMetadata(metadata);
  session.playbackState=state.audio.src&&!state.audio.paused?'playing':'paused';updateMediaPosition()
 }catch(error){}
}
function seekMedia(seconds){const duration=state.audio.duration;if(!Number.isFinite(duration)||duration<=0)return;state.audio.currentTime=Math.max(0,Math.min(duration,state.audio.currentTime+seconds))}
function installMediaSession(){
 const session=mediaSession();if(!session||typeof session.setActionHandler!=='function')return;
 const handlers={
  play:()=>{if(!state.currentTrackId)return;if(!state.audio.src){playTrack(state.currentTrackId,state.queueIds);return}state.audio.play().catch(()=>status('Playback could not start; try another track'))},
  pause:()=>{state.audio.pause();flushSession()},previoustrack:previousTrack,nexttrack:nextTrack,
  seekbackward:details=>seekMedia(-(Number(details&&details.seekOffset)||10)),seekforward:details=>seekMedia(Number(details&&details.seekOffset)||10),
  seekto:details=>{const duration=state.audio.duration,time=Number(details&&details.seekTime);if(Number.isFinite(duration)&&duration>0&&Number.isFinite(time))state.audio.currentTime=Math.max(0,Math.min(duration,time))},
  stop:()=>{state.audio.pause();if(Number.isFinite(state.audio.duration))state.audio.currentTime=0;flushSession();updateControls()}
 };
 Object.keys(handlers).forEach(action=>{try{session.setActionHandler(action,handlers[action])}catch(error){}})
}
function setCover(elementId,track){
 const element=$(elementId);if(!element)return;const image=element.querySelector('img'),url=artworkUrl(track);element.className=elementId==='nowArt'?'bigart art '+artworkClass(track):'minicover art '+artworkClass(track);
 if(elementId==='nowArt')$('now').style.setProperty('--player-art',url?'url("'+url+'")':'linear-gradient(140deg,#633640,#292431 58%,#111116)');
 if(image){image.hidden=!url;if(url)image.src=url}else if(url){const img=document.createElement('img');img.alt='';img.className='cover-image';img.src=url;element.appendChild(img)}
}
export function updateControls(){
 const current=byId(state.currentTrackId),hasTrack=!!current,playing=hasTrack&&(current.source==='youtube'?isYouTubePlaying():!!state.audio.src&&!state.audio.paused),playLabel=playing?'Pause':'Play';
 $('mp').innerHTML=icon(playing?'pause':'play');$('mp').setAttribute('aria-label',playLabel);$('nowPlayButton').innerHTML=icon(playing?'pause':'play');$('nowPlayButton').setAttribute('aria-label',playLabel);
 $('shuffleButton').classList.toggle('active',state.shuffle);$('shuffleButton').setAttribute('aria-pressed',String(state.shuffle));$('shuffleButton').setAttribute('aria-label','Shuffle '+(state.shuffle?'on':'off'));
 $('repeatButton').classList.toggle('active',state.repeatMode!=='off');$('repeatButton').setAttribute('aria-pressed',String(state.repeatMode!=='off'));$('repeatButton').setAttribute('aria-label','Repeat '+state.repeatMode+'. Change repeat mode');
 ['previousButton','nextButton','seekBar','nowLikeButton','nowMoreButton','lyricsButton','sleepTimerButton'].forEach(id=>{const control=$(id);if(control)control.disabled=!hasTrack});
 const timer=$('sleepTimerButton');if(timer){timer.classList.toggle('active',state.sleepTimer!==null);timer.setAttribute('aria-pressed',String(state.sleepTimer!==null))}
 $('now').classList.toggle('paused',!playing);updateMediaSession()
}
export function syncVolume(){
 const stored=Number(state.prefs.volume),volume=Number.isFinite(stored)?Math.max(0,Math.min(1,stored)):.8,last=Number(state.prefs.lastVolume);
 state.prefs.volume=volume;state.prefs.lastVolume=Number.isFinite(last)&&last>0?Math.min(1,last):.8;state.audio.volume=volume;$('volumeSlider').value=String(Math.round(volume*100));
 const mute=$('muteButton'),muted=volume===0;mute.innerHTML=icon(muted?'mute':'volume');mute.setAttribute('aria-pressed',String(muted));mute.setAttribute('aria-label',muted?'Unmute playback':'Mute playback');$('volumeValue').textContent=Math.round(volume*100)+'%'
}
function persistVolume(immediate=false){clearTimeout(volumeSaveTimer);const save=()=>put('settings',{key:'preferences',value:state.prefs}).catch(()=>toast('Could not save playback volume'));if(immediate)save();else volumeSaveTimer=setTimeout(save,250)}
function setVolume(value){const volume=Math.max(0,Math.min(1,Number(value)/100));state.audio.volume=volume;state.prefs.volume=volume;if(volume>0)state.prefs.lastVolume=volume;syncVolume()}
function toggleMute(){if(state.audio.volume>0){state.prefs.lastVolume=state.audio.volume;setVolume(0)}else setVolume(state.prefs.lastVolume*100);persistVolume(true)}
export function renderCurrent(){
 const track=byId(state.currentTrackId);$('mini').hidden=!track;document.body.classList.toggle('has-active-mini',!!track);
 if(!track){updateMediaSession();updateControls();return}
 $('nowTitle').textContent=track.title||track.name||'Unknown track';$('nowArtist').textContent=track.artist||'Unknown artist';$('nowAlbum').textContent=track.album||'';
 const isYouTube=track.source==='youtube';$('miniTitle').textContent=track.title||track.name||'Unknown track';$('miniArtist').textContent=isYouTube?'YouTube video · Open to watch':(track.artist||'Unknown artist');$('miniOpen').setAttribute('aria-label',(isYouTube?'Open YouTube video player for ':'Open now playing for ')+(track.title||track.name||'track'));$('miniCover').hidden=isYouTube;$('mp').hidden=isYouTube;$('miniNext').hidden=isYouTube;
 $('now').classList.toggle('youtube-active',isYouTube);$('youtubePanel').hidden=!isYouTube;$('youtubePlayerError').hidden=true;
 setCover('nowArt',track);setCover('miniCover',track);$('nowArt').setAttribute('aria-label',(track.album||track.title||'Song')+' artwork');
 const liked=!!track.liked;$('nowLikeButton').innerHTML=icon(liked?'heart-filled':'heart');$('nowLikeButton').classList.toggle('liked',liked);$('nowLikeButton').setAttribute('aria-pressed',String(liked));$('nowLikeButton').setAttribute('aria-label',liked?'Remove from Liked Songs':'Add to Liked Songs');
 const info=$('nowSourceInfo');if(info){const sourceLabel=track.source==='local'?'Uploaded':track.source==='audius'?'Audius':track.source==='youtube'?'YouTube video':track.source==='jamendo'?'Jamendo · '+(track.license||'Creative Commons'):'';const url=track.sourceUrl||track.providerUrl;const safeUrl=/^https:\/\//i.test(url||'')?url:'';info.innerHTML=sourceLabel+(track.source==='jamendo'&&track.artist?'<span> · '+esc(track.artist)+'</span>':'')+(safeUrl?' · <a href="'+esc(safeUrl)+'" target="_blank" rel="noopener noreferrer">Open '+(track.source==='youtube'?'on YouTube':track.source==='jamendo'?'on Jamendo':'source')+'</a>':'')+(track.source==='jamendo'&&track.licenseUrl?'<br><a href="'+esc(track.licenseUrl)+'" target="_blank" rel="noopener noreferrer">'+esc(track.license)+' license</a>':'')}
 $('nowPlayButton').hidden=isYouTube;$('nowLikeButton').hidden=false;$('nowMoreButton').hidden=false;
 $('lyricsTrackTitle').textContent=track.title||'Lyrics';$('lyricsTrackArtist').textContent=track.artist||'Unknown artist';renderLyrics();updateControls()
}
function renderQueueItem(trackId,index,current){
 const track=byId(trackId);if(!track)return '';const url=artworkUrl(track),cover='<span class="qthumb art '+artworkClass(track)+'">'+(url?'<img src="'+esc(url)+'" alt="">':'')+'</span>';
 return '<div class="queue-item '+(current?'current':'')+'" data-queue-row="'+esc(trackId)+'"><button class="queue-main" data-queue-play="'+esc(trackId)+'" aria-label="Play '+esc(track.title||'song')+'">'+cover+'<span class="qinfo"><b>'+esc(track.title||track.name||'Unknown song')+'</b><span>'+esc(track.artist||'Unknown artist')+'</span></span></button><button class="queue-drag-handle" data-queue-drag="'+esc(trackId)+'" draggable="true" aria-label="Drag to reorder '+esc(track.title||'song')+'">'+icon('grip')+'</button><button data-queue-move="'+esc(trackId)+'" data-dir="-1" aria-label="Move '+esc(track.title||'song')+' up"'+(current||index===0?' disabled':'')+'>'+icon('arrow-up')+'</button><button data-queue-move="'+esc(trackId)+'" data-dir="1" aria-label="Move '+esc(track.title||'song')+' down"'+(current||index===state.queueIds.length-1?' disabled':'')+'>'+icon('arrow-down')+'</button><button data-queue-remove="'+esc(trackId)+'" aria-label="Remove '+esc(track.title||'song')+' from queue"'+(current?' disabled':'')+'>'+icon('close')+'</button></div>'
}
export function renderQueue(){
 const currentIndex=state.queueIds.indexOf(state.currentTrackId),current=byId(state.currentTrackId);let html='';
 if(current)html+='<div class="queue-group-title">Now Playing</div>'+renderQueueItem(current.id,currentIndex,true);
 const upcoming=currentIndex>=0?state.queueIds.slice(currentIndex+1):state.queueIds.filter(id=>!!byId(id));
 if(upcoming.length){html+='<div class="queue-group-title">Playing Next</div>'+renderQueueItem(upcoming[0],currentIndex+1,false);if(upcoming.length>1)html+='<div class="queue-group-title">Up Next</div>'+upcoming.slice(1).map((id,index)=>renderQueueItem(id,currentIndex+2+index,false)).join('')}
 $('queueList').innerHTML=html||'<div class="queue-empty">Your queue is empty. Choose a song to start listening.</div>';state.queueIndex=currentIndex
}
function startSession(track){
 flushSession();state.sessionId=null;state.pendingSeconds=0;if(track.source!=='local'&&track.source!=='audius'){state.sessionRecord=null;return}const snapshot=historyTrackSnapshot(track);if(snapshot&&!state.catalogTracks.some(item=>item.id===snapshot.id))state.catalogTracks.push(snapshot);state.sessionRecord={trackId:track.id,title:track.title||track.name,artist:track.artist||'Unknown artist',startedAt:Date.now(),seconds:0,...(snapshot?{trackSnapshot:snapshot}:{})};state.lastPersist=Date.now();
 add('history',state.sessionRecord).then(key=>{state.sessionId=key;state.sessionRecord.id=key;state.history.unshift(state.sessionRecord);state.refreshAll()}).catch(()=>{})
}
export function flushSession(){
 if(!state.sessionRecord||state.sessionId==null)return;state.sessionRecord.seconds=(Number(state.sessionRecord.seconds)||0)+state.pendingSeconds;state.pendingSeconds=0;state.lastPersist=Date.now();const snapshot=Object.assign({},state.sessionRecord);
 put('history',snapshot).then(()=>{const index=state.history.findIndex(item=>item.id===snapshot.id);if(index>=0)state.history[index]=snapshot;state.refreshAll()}).catch(()=>{})
}
function updateLyrics(){
 const lines=$('lyricsText').querySelectorAll('[data-lyric-time]');if(!lines.length)return;const time=state.audio.currentTime;let active=-1;
 lines.forEach((line,index)=>{const start=Number(line.dataset.lyricTime),next=lines[index+1]?Number(lines[index+1].dataset.lyricTime):Infinity;const on=time>=start&&time<next;line.classList.toggle('active',on);if(on)active=index});
 if(active>=0&&$('lyricsPanel').offsetParent)$('lyricsText').children[active]?.scrollIntoView({block:'center',behavior:'smooth'})
}
function renderLyrics(){
 const track=byId(state.currentTrackId),box=$('lyricsText');if(!box)return;const raw=track?.lyrics||'';
 if(!raw.trim()){box.innerHTML='<div class="lyrics-empty">No lyrics saved for this song.</div>';return}
 const lines=raw.split(/\r?\n/).filter(line=>line.trim()),timed=[];
 lines.forEach(line=>{const marks=Array.from(line.matchAll(/\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g)),text=line.replace(/\[[0-9:.]+\]/g,'').trim();if(marks.length&&text)marks.forEach(match=>timed.push({time:Number(match[1])*60+Number(match[2])+Number((match[3]||'0').padEnd(3,'0'))/1000,text}));else if(text)timed.push({time:null,text})});
 box.innerHTML=timed.length?timed.map(line=>'<div class="lyric-line" '+(line.time===null?'':'data-lyric-time="'+line.time+'"')+'>'+esc(line.text)+'</div>').join(''):'<div class="lyrics-empty">No lyrics saved for this song.</div>';updateLyrics()
}
function onTimeUpdate(){
 const audio=state.audio,duration=audio.duration||0;$('seekBar').value=duration?Math.round(audio.currentTime/duration*1000):0;$('elapsedTime').textContent=formatClock(audio.currentTime);$('remainingTime').textContent='−'+formatClock(Math.max(0,duration-audio.currentTime));
 if(!audio.paused&&state.sessionId!=null){const position=audio.currentTime,delta=Math.max(0,Math.min(5,position-state.lastPosition));if(delta>0)state.pendingSeconds+=delta;state.lastPosition=position;if(state.pendingSeconds>=8||Date.now()-state.lastPersist>12000)flushSession()}
 updateMediaPosition();updateLyrics()
}
export async function playTrack(trackId,collection){
 const track=byId(trackId);if(!track){toast('That song is no longer in your library');return}
 if(track.source==='youtube'&&state.prefs.youtubeConsent!==true){toast('Enable YouTube in Settings before searching or playing videos');window.show('settings');return}
 if(track.source==='youtube'&&track.madeForKids===true){const id=String(track.providerId||'');if(/^[A-Za-z0-9_-]{11}$/.test(id))window.open('https://www.youtube.com/watch?v='+encodeURIComponent(id),'_blank','noopener,noreferrer');toast('This video is marked Made for Kids. Open it directly on YouTube.');return}
 const priorQueue=Array.isArray(collection)?collection:state.tracks.map(item=>item.id);state.queueIds=priorQueue.filter(item=>!!byId(item));state.queueIndex=state.queueIds.indexOf(trackId);if(state.queueIndex<0){state.queueIds.unshift(trackId);state.queueIndex=0}state.queueBaseIds=state.queueIds.slice();
 if(state.shuffle&&state.queueIds.length>2){const tail=state.queueIds.slice(state.queueIndex+1);for(let i=tail.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[tail[i],tail[j]]=[tail[j],tail[i]]}state.queueIds.splice(state.queueIndex+1,tail.length,...tail)}
 if(state.objectUrl){URL.revokeObjectURL(state.objectUrl);state.objectUrl=null}
 stopYouTubePlayback();state.audio.pause();state.audio.removeAttribute('src');state.audio.load();$('youtubePanel').hidden=true;$('youtubePlayerError').hidden=true;
 const playable=playableTrack(track);let source='';if(track.source==='local'&&track.blob instanceof Blob){state.objectUrl=URL.createObjectURL(track.blob);source=state.objectUrl}else if(playable?.kind==='audio')source=playable.url;
 if(track.source==='youtube'&&playable?.kind==='youtube'){
  state.currentTrackId=trackId;renderCurrent();window.show('now');startSession(track);state.lastPosition=0;renderQueue();
  const panel=$('youtubePanel'),host=$('youtubePlayerHost');panel.hidden=false;$('youtubePlayerError').hidden=true;host.replaceChildren();const mount=document.createElement('div');mount.className='youtube-iframe-mount';host.appendChild(mount);
  try{await loadYouTubePlayer(playable.videoId,mount,{autoplay:true,onReady:()=>{status('YouTube video ready · playback stays on screen');requestAnimationFrame(()=>panel.scrollIntoView({block:'center',behavior:'auto'}))},onStateChange:playerState=>{if(playerState===0){updateControls();if($('now').open&&document.visibilityState==='visible'&&isYouTubePlayerVisible())nextTrack()}else{updateControls();if(playerState===1)status('Playing in the visible YouTube player')}},onError:code=>showYouTubePlaybackError(track,code)})}catch(error){showYouTubePlaybackError(track,0)}
  try{if(!localStorage.getItem('auralis-youtube-notice-seen')){toast('YouTube plays only while the video is visible.');localStorage.setItem('auralis-youtube-notice-seen','1')}}catch(error){}
  updateControls();return
 }
 if(!source){toast(track.source==='audius'||track.source==='jamendo'?'This stream is no longer available':'The audio file is missing from this device');return}
 state.audio.src=source;state.currentTrackId=trackId;renderCurrent();window.show('now');startSession(track);state.lastPosition=0;renderQueue();
 try{await state.audio.play();status(playbackMessage())}catch(error){status(track.source==='audius'||track.source==='jamendo'?'Press play to start this stream':'Press play to start this song')}updateControls()
}
function showYouTubePlaybackError(track,code){
 pauseYouTubePlayback();const alert=$('youtubePlayerError'),message=$('youtubePlayerErrorMessage'),link=$('youtubeOpenLink');
 if(code===100||code===101||code===150){message.textContent='Not available to play here. Open on YouTube.'}else if(code===153){message.textContent='YouTube could not verify this site. Check the page’s referrer policy and try again, or open the video on YouTube.'}else message.textContent='The YouTube player could not start. Open the video on YouTube or skip.';
 const url=track.sourceUrl||track.providerUrl||('https://www.youtube.com/watch?v='+encodeURIComponent(track.providerId||''));link.href=url;alert.hidden=false;status(message.textContent);updateControls()
}
export function play(title,artist){const track=state.tracks.find(item=>item.title===title&&item.artist===artist);if(track)playTrack(track.id);else toast('Choose a song from Browse or Search to begin')}
export function toggle(){
 if(!state.currentTrackId){toast('Choose a song from Browse or Search to begin');window.show('browse');return}
 if(byId(state.currentTrackId)?.source==='youtube'){if(isYouTubePlaying())pauseYouTubePlayback();else playYouTubePlayback();updateControls();return}
 if(state.audio.paused){if(!state.audio.src){playTrack(state.currentTrackId,state.queueIds);return}state.audio.play().then(()=>status(playbackMessage())).catch(()=>status('Playback could not start; try another track'))}
 else{state.audio.pause();flushSession()}
 updateControls()
}
export function previousTrack(){
 if(!state.currentTrackId)return;if(state.audio.currentTime>3){state.audio.currentTime=0;return}
 if(state.queueIndex>0)state.queueIndex--;else if(state.repeatMode==='all'&&state.queueIds.length)state.queueIndex=state.queueIds.length-1;else{state.audio.currentTime=0;return}
 playTrack(state.queueIds[state.queueIndex],state.queueIds)
}
export function nextTrack(){
 if(state.repeatMode==='one'&&state.currentTrackId){if(byId(state.currentTrackId)?.source==='youtube'){playYouTubePlayback();return}state.audio.currentTime=0;state.audio.play().catch(()=>{});return}
 if(!state.queueIds.length){state.queueIds=state.tracks.map(track=>track.id);state.queueIndex=state.queueIds.indexOf(state.currentTrackId)}
 if(state.shuffle&&state.queueIds.length>1){let next=state.queueIndex+1;if(next>=state.queueIds.length){if(state.repeatMode==='all')next=0;else{state.audio.pause();status('End of queue');return}}state.queueIndex=next}
 else if(state.queueIndex<state.queueIds.length-1)state.queueIndex++;
 else if(state.repeatMode==='all')state.queueIndex=0;
 else{state.audio.pause();pauseYouTubePlayback();status('End of queue');return}
 playTrack(state.queueIds[state.queueIndex],state.queueIds)
}
export function toggleShuffle(){
 state.shuffle=!state.shuffle;
 if(state.shuffle){state.queueBaseIds=state.queueIds.slice();const tail=state.queueIds.slice(state.queueIndex+1);for(let i=tail.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[tail[i],tail[j]]=[tail[j],tail[i]]}state.queueIds.splice(state.queueIndex+1,tail.length,...tail)}
 else if(state.queueBaseIds.length){const current=state.currentTrackId,base=state.queueBaseIds.slice(),index=base.indexOf(current);if(index>=0){state.queueIds=base;state.queueIndex=index}}
 updateControls();renderQueue();toast(state.shuffle?'Shuffle on':'Shuffle off')
}
export function toggleRepeat(){state.repeatMode=state.repeatMode==='off'?'all':state.repeatMode==='all'?'one':'off';updateControls();toast('Repeat '+state.repeatMode)}
export function playCollection(ids){const valid=ids.filter(trackId=>!!byId(trackId));if(!valid.length){toast('No songs in this collection yet');return}playTrack(valid[0],valid)}
export function playNext(trackId){
 if(!byId(trackId))return;if(!state.queueIds.length)state.queueIds=state.tracks.map(track=>track.id);const currentIndex=state.queueIds.indexOf(state.currentTrackId),existing=state.queueIds.indexOf(trackId);
 if(existing>=0)state.queueIds.splice(existing,1);const place=Math.max(0,currentIndex+1);state.queueIds.splice(place,0,trackId);
 if(!state.currentTrackId){state.queueIndex=state.queueIds.indexOf(trackId);playTrack(trackId,state.queueIds)}else state.queueIndex=state.queueIds.indexOf(state.currentTrackId);
 state.queueBaseIds=state.queueIds.slice();renderQueue();toast('Added to Playing Next')
}
export function addToQueue(trackId){
 if(!byId(trackId))return;if(!state.currentTrackId){playTrack(trackId);toast('Playing the first song in your queue');return}if(!state.queueIds.length)state.queueIds=[state.currentTrackId];
 if(!state.queueIds.includes(trackId))state.queueIds.push(trackId);state.queueIndex=state.queueIds.indexOf(state.currentTrackId);state.queueBaseIds=state.queueIds.slice();renderQueue();toast('Added to Up Next')
}
export function moveQueue(trackId,direction){
 const index=state.queueIds.indexOf(trackId);if(index<0||trackId===state.currentTrackId)return;const target=Math.max(0,Math.min(state.queueIds.length-1,index+direction));if(target===index)return;const item=state.queueIds.splice(index,1)[0];state.queueIds.splice(target,0,item);state.queueIndex=state.queueIds.indexOf(state.currentTrackId);state.queueBaseIds=state.queueIds.slice();renderQueue();requestAnimationFrame(()=>Array.from($('queueList').querySelectorAll('[data-queue-move]')).find(button=>button.dataset.queueMove===trackId&&Number(button.dataset.dir)===direction)?.focus({preventScroll:true}))
}
export function moveQueueTo(trackId,targetIndex){
 const index=state.queueIds.indexOf(trackId);if(index<0||trackId===state.currentTrackId)return;const item=state.queueIds.splice(index,1)[0];const target=Math.max(0,Math.min(state.queueIds.length,targetIndex));state.queueIds.splice(target,0,item);state.queueIndex=state.queueIds.indexOf(state.currentTrackId);state.queueBaseIds=state.queueIds.slice();renderQueue()
}
export function removeFromQueue(trackId){if(trackId===state.currentTrackId){toast('The playing song stays in the queue');return}state.queueIds=state.queueIds.filter(item=>item!==trackId);state.queueIndex=state.queueIds.indexOf(state.currentTrackId);state.queueBaseIds=state.queueIds.slice();renderQueue()}
export function clearQueue(){const current=state.currentTrackId;state.queueIds=current?[current]:[];state.queueBaseIds=state.queueIds.slice();state.queueIndex=current?0:-1;renderQueue();toast('Queue cleared')}
export function openQueue(){renderQueue();const panel=$('queuePanel');if(!panel.open){if(byId(state.currentTrackId)?.source==='youtube')pauseYouTubePlayback();queueTrigger=document.activeElement;panel.showModal()}}
export function closeQueue(){const panel=$('queuePanel');if(panel.open)panel.close();const trigger=queueTrigger;queueTrigger=null;if(trigger?.isConnected)requestAnimationFrame(()=>trigger.focus({preventScroll:true}))}
export function openSleepTimer(){window.showDialog('Sleep timer','<div class="sleep-timer-intro">'+icon('timer')+' Stop playback after a set time</div><div class="dialog-options"><button data-timer="15">'+icon('timer')+' 15 minutes</button><button data-timer="30">'+icon('timer')+' 30 minutes</button><button data-timer="45">'+icon('timer')+' 45 minutes</button><button data-timer="60">'+icon('timer')+' 60 minutes</button><button data-timer="0">'+icon('close')+' Cancel sleep timer</button></div>')}
export function selectSleepTimer(minutes){
 clearTimeout(state.sleepTimer);state.sleepTimer=null;window.closeAction();if(!minutes){updateControls();toast('Sleep timer cancelled');return}
 state.sleepTimer=setTimeout(()=>{state.sleepTimer=null;if(byId(state.currentTrackId)?.source==='youtube')pauseYouTubePlayback();else state.audio.pause();flushSession();status('Sleep timer stopped playback');updateControls();toast('Sleep timer finished')},minutes*60000);updateControls();toast('Playback will stop in '+minutes+' minutes')
}
export function toggleLyrics(){const panel=$('lyricsPanel');panel.hidden=!panel.hidden;$('now').classList.toggle('lyrics-open',!panel.hidden);if(!panel.hidden){renderLyrics();$('lyricsClose').focus()}}
export function stopCurrent(trackId){
 if(state.currentTrackId!==trackId)return;pauseYouTubePlayback();stopYouTubePlayback();state.audio.pause();flushSession();state.audio.removeAttribute('src');state.audio.load();if(state.objectUrl)URL.revokeObjectURL(state.objectUrl);state.objectUrl=null;state.currentTrackId=null;state.sessionId=null;state.sessionRecord=null;state.queueIds=state.queueIds.filter(id=>id!==trackId);state.queueIndex=-1;renderCurrent();renderQueue()
}
export function initPlayer(){
 syncVolume();installMediaSession();updateMediaSession();
 $('volumeSlider').addEventListener('input',event=>{setVolume(event.target.value);persistVolume()});$('volumeSlider').addEventListener('change',()=>persistVolume(true));$('muteButton').addEventListener('click',toggleMute);
 state.audio.addEventListener('play',()=>{state.lastPosition=state.audio.currentTime;updateControls();status(playbackMessage())});state.audio.addEventListener('pause',()=>{flushSession();updateControls()});state.audio.addEventListener('timeupdate',onTimeUpdate);state.audio.addEventListener('loadedmetadata',updateMediaPosition);state.audio.addEventListener('ended',()=>{flushSession();nextTrack()});state.audio.addEventListener('error',()=>{const source=byId(state.currentTrackId)?.source;status(source==='audius'||source==='jamendo'?'This '+(source==='jamendo'?'Jamendo':'Audius')+' stream is unavailable. Try another track.':'This audio format could not be played by your browser')});
 $('seekBar').addEventListener('input',event=>{if(state.audio.duration)state.audio.currentTime=(Number(event.target.value)/1000)*state.audio.duration});
 $('miniOpen').addEventListener('click',()=>window.show('now'));$('mp').addEventListener('click',toggle);$('miniNext').addEventListener('click',nextTrack);
 $('nowPlayButton').addEventListener('click',toggle);$('previousButton').addEventListener('click',previousTrack);$('nextButton').addEventListener('click',nextTrack);$('shuffleButton').addEventListener('click',toggleShuffle);$('repeatButton').addEventListener('click',toggleRepeat);
 $('nowLikeButton').addEventListener('click',()=>{if(state.currentTrackId)window.toggleLike(state.currentTrackId)});$('nowMoreButton').addEventListener('click',()=>{if(state.currentTrackId)window.trackMenu(state.currentTrackId)});
 $('lyricsButton').addEventListener('click',toggleLyrics);$('queueButton').addEventListener('click',openQueue);$('sleepTimerButton').addEventListener('click',openSleepTimer);
 $('playerClose').addEventListener('click',()=>window.closePlayer());$('lyricsClose').addEventListener('click',()=>{$('lyricsPanel').hidden=true;$('now').classList.remove('lyrics-open');$('lyricsButton').focus()});
 $('queueClose').addEventListener('click',closeQueue);$('queueHeaderClose').addEventListener('click',closeQueue);$('queueClear').addEventListener('click',clearQueue);
 $('youtubeSkip').addEventListener('click',nextTrack);document.addEventListener('visibilitychange',updateYouTubeVisibility);
 $('now').addEventListener('cancel',event=>{event.preventDefault();window.closePlayer()});$('queuePanel').addEventListener('cancel',event=>{event.preventDefault();closeQueue()});
 $('queuePanel').addEventListener('click',event=>{if(event.target=== $('queuePanel'))closeQueue()});
 const queueList=$('queueList');let dragId=null,pointerDrag=null;
 function queueDropIndex(targetRow,clientY,draggedId){const targetIndex=state.queueIds.indexOf(targetRow.dataset.queueRow),sourceIndex=state.queueIds.indexOf(draggedId);if(targetIndex<0||sourceIndex<0)return -1;const rect=targetRow.getBoundingClientRect(),boundary=targetIndex+(clientY>rect.top+rect.height/2?1:0);return boundary-(sourceIndex<boundary?1:0)}
 queueList.addEventListener('dragstart',event=>{const handle=event.target.closest('[data-queue-drag]');if(!handle||handle.closest('.current')){event.preventDefault();return}dragId=handle.dataset.queueDrag;event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',dragId)});
 queueList.addEventListener('dragover',event=>{if(dragId&&event.target.closest('[data-queue-row]'))event.preventDefault()});
 queueList.addEventListener('drop',event=>{const row=event.target.closest('[data-queue-row]');if(!row||!dragId)return;event.preventDefault();const target=queueDropIndex(row,event.clientY,dragId);if(target>=0)moveQueueTo(dragId,target);dragId=null});
 queueList.addEventListener('dragend',()=>{dragId=null});
 queueList.addEventListener('pointerdown',event=>{const handle=event.target.closest('[data-queue-drag]'),row=handle?.closest('[data-queue-row]');if(!handle||!row||row.classList.contains('current')||event.pointerType==='mouse')return;pointerDrag={id:handle.dataset.queueDrag,pointerId:event.pointerId,startY:event.clientY,moved:false,target:row};row.classList.add('queue-dragging');handle.setPointerCapture?.(event.pointerId)});
 queueList.addEventListener('pointermove',event=>{if(!pointerDrag||event.pointerId!==pointerDrag.pointerId)return;if(Math.abs(event.clientY-pointerDrag.startY)<8&&!pointerDrag.moved)return;pointerDrag.moved=true;queueList.querySelectorAll('[data-drop-target]').forEach(row=>delete row.dataset.dropTarget);const row=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-queue-row]');if(row&&queueList.contains(row)){pointerDrag.target=row;row.dataset.dropTarget='true'}});
 function finishPointerDrag(event){if(!pointerDrag||event.pointerId!==pointerDrag.pointerId)return;const drag=pointerDrag;pointerDrag=null;queueList.querySelectorAll('[data-drop-target]').forEach(row=>delete row.dataset.dropTarget);queueList.querySelectorAll('.queue-dragging').forEach(row=>row.classList.remove('queue-dragging'));if(!drag.moved)return;const target=queueDropIndex(drag.target,event.clientY,drag.id);if(target>=0){moveQueueTo(drag.id,target);requestAnimationFrame(()=>Array.from(queueList.querySelectorAll('[data-queue-drag]')).find(handle=>handle.dataset.queueDrag===drag.id)?.focus({preventScroll:true}))}}
 queueList.addEventListener('pointerup',finishPointerDrag);queueList.addEventListener('pointercancel',()=>{if(pointerDrag){queueList.querySelectorAll('[data-drop-target]').forEach(row=>delete row.dataset.dropTarget);queueList.querySelectorAll('.queue-dragging').forEach(row=>row.classList.remove('queue-dragging'));pointerDrag=null}});
 window.addEventListener('beforeunload',()=>{flushSession();if(state.objectUrl)URL.revokeObjectURL(state.objectUrl);for(const url of state.artworkUrls.values())URL.revokeObjectURL(url)})
}

