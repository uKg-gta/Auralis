import {state,$,status,toast,uniqueRecent,playlistTrackIds,esc,icon,formatDuration} from './core.js';
import {loadLibraryState} from './storage.js';
import {applyPreferences,setTheme,setAccent,setLargeText,refreshStorageInfo,requestPersistentStorage} from './features/settings.js';
import {renderHome,renderHomeStats,renderHomeHistory,renderLibrary,renderYourMusic,renderLibraryArtists,renderLibraryAlbums,createCategory,showLiked,showRecent,showArtists,setLibraryFilter,setLibrarySource,setLibrarySection,openArtist as openArtistView,openAlbum as openAlbumView,setLibrarySort} from './features/library.js';
import {renderPlaylists,createPlaylist,newPlaylist,openPlaylist,closePlaylistDetail,playSelectedPlaylist,renameSelectedPlaylist,deleteSelectedPlaylist,confirmDeleteSelectedPlaylist,moveInPlaylist,removeFromPlaylist} from './features/playlists.js';
import {renderSearch,setSearchFilter,setSearchScope,initSearch,setSearchQuery} from './features/search.js';
import {renderProfile,renderProfileStats,initProfile} from './features/profile.js';
import {initDiscovery,loadDiscovery,renderDiscovery} from './features/discovery.js';
import {initPlayer,syncVolume,renderCurrent,renderQueue,playTrack,play,toggle,previousTrack,nextTrack,toggleShuffle,toggleRepeat,playCollection,playNext,addToQueue,openQueue,closeQueue,openSleepTimer,toggleLyrics,selectSleepTimer,moveQueue,moveQueueTo,removeFromQueue,clearQueue,stopCurrent} from './features/player.js';
import {initActions,showDialog,openAddMenu,openCurrentMenu,toggleCurrentLike,trackMenu,toggleLike,entityMenu,closeAction} from './features/actions.js';
import {importLibraryBackup} from './features/backup.js';
import {initCatalog,loadBrowse} from './features/catalog.js';
import {hydrateSavedSources,revalidateSavedYoutubeReferences,saveSourceCredentials,browseSource,loadHomeSources} from './sources/index.js';
import {pauseYouTubePlayback} from './sources/youtube.js';
import {artistReleasesByName} from './sources/musicbrainz.js';

let returnScreen='home',currentScreen='home',playerTrigger=null,browseSelectedSource='audius',browseRequest=0,libraryLoaded=false,youtubeMaintenanceBusy=false;
function titleFor(screen){return ({home:'Listen Now',search:'Search',browse:'Browse',library:'Library',settings:'Settings',profile:'Your Profile'})[screen]||'Auralis'}
function show(screenId,options={}){
 if(screenId==='now'){
  const dialog=$('now');if(!dialog.open){returnScreen=currentScreen;playerTrigger=document.activeElement;dialog.showModal();if(options.push!==false)history.pushState({auralisScreen:currentScreen,playerOpen:true},'','#now-playing')}
  document.body.classList.add('player-open','mobile-player-open');return
 }
 const detail=screenId==='library'?(state.selectedPlaylistId?{type:'playlist',id:state.selectedPlaylistId}:state.selectedArtistName?{type:'artist',value:state.selectedArtistName}:state.selectedAlbumName?{type:'album',value:state.selectedAlbumName}:null):null;
 if(options.push!==false&&screenId!==currentScreen){history.pushState({auralisScreen:screenId,auralisDetail:detail},'','#'+screenId)}
 else if(options.push!==false&&detail&&JSON.stringify(history.state?.auralisDetail||null)!==JSON.stringify(detail)){history.pushState({auralisScreen:screenId,auralisDetail:detail},'','#library/'+detail.type)}
 if(screenId!=='settings'&&screenId!=='profile')returnScreen=screenId;
 const dialog=$('now');if(dialog.open){dialog.close();pauseYouTubePlayback()}
 document.body.classList.remove('player-open','mobile-player-open');
 currentScreen=screenId;document.querySelectorAll('.screen').forEach(section=>section.classList.toggle('active',section.id===screenId));
 const navMap={home:'navhome',search:'navsearch',browse:'navbrowse',library:'navlibrary'},activeId=navMap[screenId];
 document.querySelectorAll('.nav button').forEach(button=>{const active=button.id===activeId;button.classList.toggle('active',active);if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current')});
 $('globalAddButton').hidden=screenId!=='home'&&screenId!=='library';$('compactTitle').textContent=titleFor(screenId);document.body.classList.remove('is-scrolled');window.scrollTo({top:0,behavior:'auto'});
 if(screenId==='home'){renderHome();renderDiscovery()}
 if(screenId==='search')renderSearch();
 if(screenId==='library'){renderLibrary();renderPlaylists()}
 if(screenId==='profile')renderProfile();
 if(screenId==='settings')refreshStorageInfo();if(screenId==='browse')showBrowseSource(browseSelectedSource)
}
function closePlayer(){
 const dialog=$('now');if(!dialog.open)return;
 if(byId(state.currentTrackId)?.source==='youtube'){status('YouTube video paused because the player was closed. Reopen the player to continue.');toast('YouTube video paused. Reopen Now Playing to continue.')}
 const shouldReturnInHistory=history.state?.playerOpen===true;
 const destination=returnScreen==='now'?'home':returnScreen;
 dialog.close();document.body.classList.remove('player-open','mobile-player-open');pauseYouTubePlayback();show(destination,{push:false});
 const trigger=playerTrigger;playerTrigger=null;if(trigger?.isConnected)requestAnimationFrame(()=>trigger.focus({preventScroll:true}));
 if(shouldReturnInHistory)history.back()
}
function renderAll(){
 if(currentScreen==='home'){renderHome();renderDiscovery()}
 else if(currentScreen==='search')renderSearch();
 else if(currentScreen==='library'){renderLibrary();renderPlaylists()}
 else if(currentScreen==='profile')renderProfile();
 renderCurrent()
}
state.refreshAll=renderAll;state.refreshHistoryViews=()=>{renderHomeHistory();renderProfileStats()};state.refreshHistoryProgress=()=>{renderHomeStats();renderProfileStats()};state.renderSearch=renderSearch;state.renderCurrent=renderCurrent;
function handleClick(event){
 const target=event.target.closest('[data-discovery-retry],[data-shelf-scroll],[data-search-filter],[data-show-screen],[data-open-add-menu],[data-create-category],[data-create-playlist],[data-close-playlist-detail],[data-play-selected-playlist],[data-rename-selected-playlist],[data-delete-selected-playlist],[data-set-theme],[data-set-accent],[data-search-scope],[data-library-filter],[data-library-source],[data-library-section],[data-play-track],[data-track-menu],[data-toggle-like],[data-open-playlist],[data-play-playlist],[data-smart],[data-play-collection],[data-move-playlist],[data-remove-playlist],[data-queue-play],[data-queue-move],[data-queue-remove],[data-timer],[data-open-artist],[data-open-album],[data-album-menu],[data-playlist-menu],[data-home-source],[data-open-library],[data-open-browse-source],[data-browse-source],[data-browse-play-all],[data-browse-retry],[data-open-youtube-settings]');
 if(!target)return;
 if(target.dataset.showScreen){event.preventDefault();show(target.dataset.showScreen);return}
 if(target.hasAttribute('data-open-add-menu')){openAddMenu();return}
 if(target.hasAttribute('data-create-category')){createCategory();return}
 if(target.hasAttribute('data-create-playlist')){createPlaylist();return}
 if(target.hasAttribute('data-close-playlist-detail')){if(history.state?.auralisDetail)history.back();else closePlaylistDetail();return}
 if(target.hasAttribute('data-play-selected-playlist')){playSelectedPlaylist();return}
 if(target.hasAttribute('data-rename-selected-playlist')){renameSelectedPlaylist();return}
 if(target.hasAttribute('data-delete-selected-playlist')){deleteSelectedPlaylist();return}
 if(target.dataset.setTheme){setTheme(target.dataset.setTheme);return}
 if(target.dataset.setAccent){setAccent(target.dataset.setAccent);return}
 if(target.dataset.shelfScroll){const shelf=document.getElementById(target.dataset.shelfTarget);shelf?.scrollBy({left:Number(target.dataset.shelfScroll)*Math.max(240,shelf.clientWidth*.8),behavior:'smooth'});return}
 if(target.hasAttribute('data-discovery-retry')){loadDiscovery(true);return}
 if(target.dataset.searchScope){setSearchScope(target.dataset.searchScope);return}
 if(target.dataset.searchFilter){setSearchFilter(target.dataset.searchFilter);return}
 if(target.dataset.librarySection){setLibrarySection(target.dataset.librarySection);show('library');if(!target.dataset.libraryFilter)return}
 if(target.dataset.librarySource){setLibrarySource(target.dataset.librarySource);return}
 if(target.dataset.libraryFilter){setLibraryFilter(target.dataset.libraryFilter);return}
 if(target.dataset.playTrack){playTrack(target.dataset.playTrack,target.dataset.playCollection?target.dataset.playCollection.split(','):undefined);return}
 if(target.dataset.trackMenu){trackMenu(target.dataset.trackMenu);return}
 if(target.dataset.toggleLike){toggleLike(target.dataset.toggleLike);return}
 if(target.dataset.playPlaylist){const playlist=state.playlists.find(item=>item.id===target.dataset.playPlaylist);if(playlist)playCollection(playlistTrackIds(playlist));return}
 if(target.dataset.openPlaylist){openPlaylist(target.dataset.openPlaylist);return}
 if(target.dataset.smart){const kind=target.dataset.smart,ids=kind==='liked'?state.tracks.filter(track=>track.liked).map(track=>track.id):kind==='recent'?uniqueRecent().map(track=>track.id):state.tracks.map(track=>track.id);playCollection(ids);return}
 if(target.dataset.playCollection){playCollection(target.dataset.playCollection.split(','));return}
 if(target.dataset.browseRetry!=null){showBrowseSource(target.dataset.browseRetry,true);return}
 if(target.dataset.openYoutubeSettings!=null){show('settings');return}
 if(target.dataset.browsePlayAll){if(target.dataset.playCollection)playCollection(target.dataset.playCollection.split(','));return}
 if(target.dataset.movePlaylist){moveInPlaylist(target.dataset.movePlaylist,Number(target.dataset.dir));return}
 if(target.dataset.removePlaylist){removeFromPlaylist(target.dataset.removePlaylist);return}
 if(target.dataset.queuePlay){playTrack(target.dataset.queuePlay,state.queueIds);return}
 if(target.dataset.queueMove){moveQueue(target.dataset.queueMove,Number(target.dataset.dir));return}
 if(target.dataset.queueRemove){removeFromQueue(target.dataset.queueRemove);return}
 if(target.dataset.timer!=null){selectSleepTimer(Number(target.dataset.timer));return}
 if(target.dataset.openArtist){openArtistRoute(target.dataset.openArtist);loadMusicBrainzArtist(target.dataset.openArtist);return}
 if(target.dataset.openAlbum){openAlbumRoute(target.dataset.openAlbum);return}
 if(target.dataset.albumMenu){entityMenu('album',target.dataset.albumMenu);return}
 if(target.dataset.playlistMenu){entityMenu('playlist',target.dataset.playlistMenu);return}
 if(target.dataset.homeSource){state.homeSource=target.dataset.homeSource;renderHome();return}
 if(target.dataset.openLibrary){const source=target.dataset.openLibrary==='uploads'?'local':target.dataset.openLibrary==='streamed'?'audius':'all';setLibrarySource(source);setLibraryFilter('all');setLibrarySection(source==='all'?'recent':'songs');show('library');return}
 if(target.dataset.browseSource){showBrowseSource(target.dataset.browseSource);return}
 if(target.dataset.openBrowseSource){show('browse');showBrowseSource(target.dataset.openBrowseSource);return}
}
function pushLibraryDetail(type,value){
 const detail={type,value};history.pushState({auralisScreen:'library',auralisDetail:detail},'','#library/'+type);show('library',{push:false})
}
function openArtistRoute(name){openArtistView(name);pushLibraryDetail('artist',name)}
function openAlbumRoute(name){openAlbumView(name);pushLibraryDetail('album',name)}
function handlePopState(event){
 const target=event.state?.auralisScreen||'home';
 if($('now').open&&!event.state?.playerOpen){$('now').close();pauseYouTubePlayback();document.body.classList.remove('player-open','mobile-player-open');const trigger=playerTrigger;playerTrigger=null;if(trigger?.isConnected)requestAnimationFrame(()=>trigger.focus({preventScroll:true}))}
 if(target==='library'){
  const detail=event.state?.auralisDetail;
  state.selectedPlaylistId=detail?.type==='playlist'?detail.id:null;state.selectedArtistName=detail?.type==='artist'?detail.value:null;state.selectedAlbumName=detail?.type==='album'?detail.value:null;
  if(!detail)state.librarySection='overview';renderLibrary();renderPlaylists()
 }
 show(target,{push:false})
}
function setupBackupInput(){$('backupImport')?.addEventListener('change',event=>window.importLibraryBackup(event.target.files?.[0]))}
function setupRowGestures(){
 let pointer=null,longPress=null,consumedLongPress=false;
 document.addEventListener('click',event=>{if(!consumedLongPress)return;const row=event.target.closest('[data-track-row]');if(!row)return;event.preventDefault();event.stopImmediatePropagation();consumedLongPress=false},true);
 document.addEventListener('pointerdown',event=>{
  const row=event.target.closest('[data-track-row]');if(!row||event.target.closest('button.track-more,button.track-extra'))return;
  pointer={row,id:row.dataset.trackId,x:event.clientX,y:event.clientY};consumedLongPress=false;
  longPress=setTimeout(()=>{if(pointer){consumedLongPress=true;window.trackMenu(pointer.id)}},560)
 });
 document.addEventListener('pointermove',event=>{if(!pointer)return;const dx=event.clientX-pointer.x,dy=event.clientY-pointer.y;if(Math.abs(dx)>12||Math.abs(dy)>12)clearTimeout(longPress);if(Math.abs(dx)>12&&Math.abs(dx)>Math.abs(dy))pointer.row.dataset.swiping=dx>0?'right':'left'});
 document.addEventListener('pointerup',event=>{
  if(!pointer)return;clearTimeout(longPress);const dx=event.clientX-pointer.x,dy=event.clientY-pointer.y,row=pointer.row,id=pointer.id;delete row.dataset.swiping;
  if(!consumedLongPress&&Math.abs(dx)>58&&Math.abs(dy)<45){event.preventDefault();if(dx>0)playNext(id);else trackMenu(id)}
  pointer=null
 });
 document.addEventListener('pointercancel',()=>{clearTimeout(longPress);if(pointer)delete pointer.row.dataset.swiping;pointer=null})
}
function setupSheetDrag(dialog,close){
 const handle=dialog.querySelector('.sheet-handle-wrap');if(!handle)return;let startY=null;
 handle.addEventListener('pointerdown',event=>{startY=event.clientY;handle.setPointerCapture?.(event.pointerId)});
 handle.addEventListener('pointerup',event=>{if(startY===null)return;const delta=event.clientY-startY;startY=null;dialog.style.translate='';if(delta>90)close();else dialog.style.translate='0 0'});
 handle.addEventListener('pointermove',event=>{if(startY===null)return;const delta=Math.max(0,event.clientY-startY);if(delta>5)dialog.style.translate='0 '+delta+'px'});
 handle.addEventListener('pointercancel',()=>{startY=null;dialog.style.translate=''})
}
function setupPreferences(){
 $('resetTasteButton')?.addEventListener('click',()=>showDialog('Reset discovery learning?','<p>This clears listening-based discovery signals. Your listening history and liked songs stay in your library.</p><div class="dialog-footer"><button class="button button-quiet" data-close-action>Cancel</button><button class="button button-destructive" data-action="reset-taste">Reset learning</button></div>'));
 $('largeText').addEventListener('change',event=>setLargeText(event.target.checked));
 $('customAccent').addEventListener('change',event=>setAccent(event.target.value));
 $('defaultLibrarySort').addEventListener('change',event=>setLibrarySort(event.target.value));
 $('librarySort').addEventListener('change',event=>setLibrarySort(event.target.value));
 $('persistentStorageButton').addEventListener('click',requestPersistentStorage);
}
function sourceCard(track,collectionIds=[]){
 const source=track.source||'',label=source==='youtube'?'YouTube':source==='jamendo'?'Jamendo':'Audius',image=track.artworkUrl?'<img src="'+esc(track.artworkUrl)+'" alt="">':'',license=source==='jamendo'&&track.license?'<span class="license-badge">'+esc(track.license)+'</span>':'',duration=source==='youtube'&&Number(track.duration)>0?' · '+formatDuration(track.duration):'';
 return '<button class="music-card" data-play-track="'+esc(track.id)+'"'+(collectionIds.length?' data-play-collection="'+esc(collectionIds.join(','))+'"':'')+' aria-label="Play '+esc(track.title||'track')+' by '+esc(track.artist||'Unknown artist')+'"><span class="card-art art a1">'+image+'<span class="card-play">'+icon('play')+'</span></span><span class="card-title">'+esc(track.title||'Untitled track')+'</span><span class="card-subtitle">'+esc(track.artist||'Unknown artist')+esc(duration)+'</span><span class="track-badges"><span class="source-badge source-'+esc(source)+'">'+label+'</span>'+license+'</span></button>'
}
async function showBrowseSource(source,force=false){
 const allowed=['audius','youtube','jamendo'].includes(source)?source:'audius';browseSelectedSource=allowed;
 document.querySelectorAll('[data-browse-source]').forEach(button=>{const active=button.dataset.browseSource===allowed;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active))});
 $('browseAudiusContent').hidden=allowed!=='audius';$('browseYouTubeContent').hidden=allowed!=='youtube';$('browseJamendoContent').hidden=allowed!=='jamendo';const request=++browseRequest;
 if(allowed==='audius'){loadBrowse(force);return}
 const statusBox=$(allowed==='youtube'?'browseYoutubeStatus':'browseJamendoStatus'),results=$(allowed==='youtube'?'browseYoutubeResults':'browseJamendoResults');statusBox.hidden=false;statusBox.textContent='Loading music…';results.innerHTML='<div class="source-loading" role="status" aria-label="Loading music"><i class="skeleton"></i><i class="skeleton"></i><i class="skeleton"></i></div>';
 try{const data=await browseSource(allowed,allowed==='youtube'?'bollywood':'popular');if(request!==browseRequest)return;const tracks=Array.isArray(data)?data:(data?.tracks||[]);if(!tracks.length){statusBox.hidden=false;statusBox.textContent='No music is available from this source right now.';results.innerHTML='';return}statusBox.hidden=true;const ids=tracks.map(track=>track.id);results.innerHTML=tracks.slice(0,24).map(track=>sourceCard(track,ids)).join('')}
 catch(error){if(request!==browseRequest)return;statusBox.hidden=false;statusBox.textContent='';statusBox.insertAdjacentHTML('afterbegin',esc(error.message||'This source is unavailable right now.')+' ');if(allowed==='youtube'){const settings=document.createElement('button');settings.className='text-button';settings.type='button';settings.dataset.openYoutubeSettings='';settings.textContent='Open Settings';statusBox.appendChild(settings)}const retry=document.createElement('button');retry.className='text-button';retry.type='button';retry.dataset.browseRetry=allowed;retry.textContent='Try again';statusBox.appendChild(retry);results.innerHTML=''}
}
async function loadHomeSourceShelves(){
 const entries=await loadHomeSources();for(const entry of entries){if(!entry?.id)continue;const source=entry.id==='homeYoutube'?'youtube':'jamendo';if(entry.error)state.homeSourceErrors[source]=entry.error.message||'Could not load this shelf. Open Browse to retry.';else{state.homeCatalog[source]=entry.tracks||[];delete state.homeSourceErrors[source]}}renderHome()
}
async function maintainYoutubeData(rehydrate=false){
 if(!libraryLoaded||youtubeMaintenanceBusy)return;youtubeMaintenanceBusy=true;
 try{if(rehydrate)await hydrateSavedSources();const expired=await revalidateSavedYoutubeReferences();state.refreshAll();if(expired&&currentScreen==='browse'&&browseSelectedSource==='youtube')showBrowseSource('youtube')}catch(error){}finally{youtubeMaintenanceBusy=false}
}
function setupYoutubeDataMaintenance(){
 window.addEventListener('online',()=>maintainYoutubeData(true));document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')maintainYoutubeData()});window.setInterval(()=>maintainYoutubeData(),12*60*60*1000)
}
async function loadMusicBrainzArtist(name){
 const box=$('musicBrainzArtistReleases');if(!box)return;box.textContent='Looking up artist releases…';
 try{const result=await artistReleasesByName(name);if(!result.releases.length){box.textContent=result.artist?'No releases were found in MusicBrainz.':'No matching artist was found in MusicBrainz.';return}box.innerHTML=result.releases.map(release=>'<a class="artist-result mb-release" href="'+esc(release.url)+'" target="_blank" rel="noopener noreferrer"><span class="listinfo"><b>'+esc(release.title)+'</b><small>'+esc(release.date||'Release date not listed')+'</small></span>'+icon('chevron-right')+'</a>').join('')}
 catch(error){box.textContent=error.message||'MusicBrainz is unavailable. Use the Load button to retry.'}
}
function setupSourceSettings(){
 const save=$('saveSourceCredentials');if(save)save.addEventListener('click',async()=>{try{const previousKey=String(state.prefs.youtubeApiKey||''),previousConsent=state.prefs.youtubeConsent===true,nextKey=$('youtubeApiKey').value.trim(),nextConsent=$('youtubeConsent').checked,current=state.tracks.concat(state.catalogTracks).find(track=>track.id===state.currentTrackId),stopCurrentYoutube=current?.source==='youtube'&&((previousConsent&&!nextConsent)||previousKey!==nextKey);await saveSourceCredentials({youtubeApiKey:nextKey,youtubeConsent:nextConsent,jamendoClientId:$('jamendoClientId').value});if(stopCurrentYoutube)stopCurrent(state.currentTrackId);toast('Music source settings saved on this device');state.homeCatalog={youtube:[],jamendo:[]};state.homeSourceErrors={};await hydrateSavedSources();state.refreshAll();loadHomeSourceShelves().catch(()=>{})}catch(error){toast('Could not save source settings')}});
 $('browseYoutubeRetry').addEventListener('click',()=>showBrowseSource('youtube',true));$('browseJamendoRetry').addEventListener('click',()=>showBrowseSource('jamendo',true));
 $('musicBrainzArtistRetry').addEventListener('click',()=>{const name=$('artistDetailTitle').textContent;if(name)loadMusicBrainzArtist(name)})
}
function setupShelfArrows(){
 document.querySelectorAll('.home-content .shelf .section-heading').forEach((heading,index)=>{
  const shelf=heading.parentElement.querySelector('.card-shelf');if(!shelf||heading.querySelector('.shelf-arrows'))return;
  if(!shelf.id)shelf.id='shelf-'+index;
  const arrows=document.createElement('span');arrows.className='shelf-arrows';
  arrows.innerHTML='<button class="shelf-arrow" type="button" data-shelf-scroll="-1" data-shelf-target="'+shelf.id+'" aria-label="Scroll shelf left">'+icon('chevron-left')+'</button><button class="shelf-arrow" type="button" data-shelf-scroll="1" data-shelf-target="'+shelf.id+'" aria-label="Scroll shelf right">'+icon('chevron-right')+'</button>';
  heading.appendChild(arrows)
 })
}
function setupScrollTitle(){let queued=false;window.addEventListener('scroll',()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{document.body.classList.toggle('is-scrolled',window.scrollY>90);queued=false})},{passive:true})}
function boot(){
 const stage=name=>{window.__auralisBootStage=name};
 stage('player setup');initPlayer();
 stage('actions setup');initActions();
 stage('search setup');initSearch();
 stage('catalog setup');initCatalog();
 stage('profile setup');initProfile();
 stage('discovery setup');initDiscovery();
 stage('interface setup');setupBackupInput();setupRowGestures();setupPreferences();setupSourceSettings();setupYoutubeDataMaintenance();setupScrollTitle();setupShelfArrows();setupSheetDrag($('now'),closePlayer);setupSheetDrag($('queuePanel'),closeQueue);setupSheetDrag($('actionDialog'),closeAction);
 Object.assign(window,{show,closePlayer,showDialog,openAddMenu,setTheme,setAccent,setLargeText,createCategory,showLiked,showRecent,showArtists,setLibraryFilter,setLibrarySource,setLibrarySection,openArtist:openArtistRoute,openAlbum:openAlbumRoute,confirmDeleteSelectedPlaylist,setLibrarySort,setSearchFilter,setSearchScope,doSearch:renderSearch,setSearchQuery,createPlaylist,newPlaylist,openPlaylist,closePlaylistDetail,playSelectedPlaylist,renameSelectedPlaylist,deleteSelectedPlaylist,play,toggle,previousTrack,nextTrack,toggleShuffle,toggleRepeat,playCollection,playNext,addToQueue,openQueue,closeQueue,openSleepTimer,toggleLyrics,openCurrentMenu,toggleCurrentLike,trackMenu,toggleLike,entityMenu,closeAction,moveInPlaylist,removeFromPlaylist,moveQueue,moveQueueTo,removeFromQueue,clearQueue,stopCurrent,importLibraryBackup});
 const playerDialog=$('now');playerDialog.addEventListener('close',()=>{document.body.classList.remove('player-open','mobile-player-open');pauseYouTubePlayback()});playerDialog.addEventListener('toggle',()=>{document.body.classList.toggle('player-open',playerDialog.open);document.body.classList.toggle('mobile-player-open',playerDialog.open&&matchMedia('(hover:none) and (pointer:coarse)').matches)});
 $('actionDialog').addEventListener('cancel',event=>{event.preventDefault();closeAction()});$('actionDialog').addEventListener('click',event=>{if(event.target===$('actionDialog'))closeAction()});
 history.replaceState({auralisScreen:'home'},'',location.href);window.addEventListener('popstate',handlePopState);document.addEventListener('click',handleClick);document.addEventListener('error',event=>{if(event.target instanceof HTMLImageElement){event.target.hidden=true;event.target.removeAttribute('src');event.target.closest('.art')?.classList.add('art-load-failed')}},true);document.getElementById('artistBack').addEventListener('click',()=>{if(history.state?.auralisDetail)history.back();else{state.selectedArtistName=null;renderLibraryArtists()}});document.getElementById('albumBack').addEventListener('click',()=>{if(history.state?.auralisDetail)history.back();else{state.selectedAlbumName=null;renderLibraryAlbums()}});document.getElementById('libraryBack').addEventListener('click',()=>{if(history.state?.auralisDetail)history.back();else{state.librarySection='overview';state.selectedArtistName=null;state.selectedAlbumName=null;state.selectedPlaylistId=null;renderLibrary();window.scrollTo({top:0,behavior:'smooth'})}});
 loadLibraryState().then(()=>{libraryLoaded=true;applyPreferences();syncVolume();renderAll();window.__auralisSetReady?.();loadDiscovery().catch(()=>{});hydrateSavedSources().then(async()=>{await revalidateSavedYoutubeReferences();state.refreshAll()}).catch(()=>{});loadHomeSourceShelves().catch(()=>{})}).catch(error=>{status(error.message);try{renderAll()}catch(renderError){window.__auralisShowStartupError?.('Auralis could not render your library. Reload the app and try again.')}window.__auralisSetReady?.();toast(error.message)})
}
boot();

