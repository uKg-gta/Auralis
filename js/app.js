import {state,$,status,uniqueRecent,playlistTrackIds} from './core.js';
import {loadLibraryState} from './storage.js';
import {applyPreferences,setTheme,setAccent,setLargeText,refreshStorageInfo,requestPersistentStorage} from './features/settings.js';
import {renderHome,renderLibrary,renderYourMusic,createCategory,importAudioFiles,showLiked,showRecent,showArtists,setLibraryFilter,setLibrarySource,setLibrarySection,openArtist,openAlbum,setLibrarySort} from './features/library.js';
import {renderPlaylists,createPlaylist,newPlaylist,openPlaylist,closePlaylistDetail,playSelectedPlaylist,renameSelectedPlaylist,deleteSelectedPlaylist,moveInPlaylist,removeFromPlaylist} from './features/playlists.js';
import {renderSearch,setSearchFilter,setSearchScope,initSearch,setSearchQuery} from './features/search.js';
import {renderProfile} from './features/profile.js';
import {initPlayer,syncVolume,renderCurrent,renderQueue,playTrack,playLocal,play,toggle,previousTrack,nextTrack,toggleShuffle,toggleRepeat,playCollection,playNext,addToQueue,openQueue,closeQueue,openSleepTimer,toggleLyrics,selectSleepTimer,moveQueue,moveQueueTo,removeFromQueue,clearQueue} from './features/player.js';
import {initActions,showDialog,openImportDialog,openAddMenu,openCurrentMenu,toggleCurrentLike,trackMenu,toggleLike,entityMenu,closeAction} from './features/actions.js';
import {importLibraryBackup} from './features/backup.js';
import {initCatalog,loadBrowse} from './features/catalog.js';
import {initDiscovery,loadDiscovery,hideRecommendation,moreLikeRecommendation,resetTasteProfile} from './features/discovery.js';

let returnScreen='home',currentScreen='home',playerTrigger=null;
function setPlayerOpenState(open){
 const body=document.body;body.classList.toggle('player-open',open);
 const mobile=!!(navigator.maxTouchPoints>0||window.matchMedia('(max-width: 899px)').matches);
 body.classList.toggle('mobile-player-open',open&&mobile);
}
function titleFor(screen){return ({home:'Listen Now',search:'Search',browse:'Browse',library:'Library',settings:'Settings',profile:'Listening Stats'})[screen]||'Auralis'}
function show(screenId){
 if(screenId==='now'){
  returnScreen=currentScreen;playerTrigger=document.activeElement;const dialog=$('now');if(!dialog.open)dialog.showModal();setPlayerOpenState(true);return
 }
 if(screenId!=='settings'&&screenId!=='profile')returnScreen=screenId;
 const dialog=$('now');if(dialog.open)dialog.close();setPlayerOpenState(false);
 currentScreen=screenId;document.querySelectorAll('.screen').forEach(section=>section.classList.toggle('active',section.id===screenId));
 const navMap={home:'navhome',search:'navsearch',browse:'navbrowse',library:'navlibrary'},activeId=navMap[screenId];
 document.querySelectorAll('.nav button').forEach(button=>{const active=button.id===activeId;button.classList.toggle('active',active);if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current')});
 $('globalAddButton').hidden=screenId!=='home'&&screenId!=='library';
 $('compactTitle').textContent=titleFor(screenId);document.body.classList.remove('is-scrolled');window.scrollTo({top:0,behavior:'auto'});
 if(screenId==='settings')refreshStorageInfo();if(screenId==='profile')renderProfile();if(screenId==='browse')loadBrowse();if(screenId==='home')loadDiscovery()
}
function closePlayer(){const dialog=$('now');if(dialog.open)dialog.close();document.body.classList.remove('player-open');show(returnScreen==='now'?'home':returnScreen);const trigger=playerTrigger;playerTrigger=null;if(trigger?.isConnected)requestAnimationFrame(()=>trigger.focus({preventScroll:true}))}
function renderAll(){renderHome();renderLibrary();renderPlaylists();renderProfile();renderSearch();renderCurrent();renderQueue()}
state.refreshAll=renderAll;state.renderSearch=renderSearch;state.renderCurrent=renderCurrent;
function handleClick(event){
 const target=event.target.closest('[data-search-filter],[data-search-scope],[data-library-filter],[data-library-source],[data-library-section],[data-play-track],[data-track-menu],[data-toggle-like],[data-open-playlist],[data-play-playlist],[data-smart],[data-play-collection],[data-move-playlist],[data-remove-playlist],[data-queue-play],[data-queue-move],[data-queue-remove],[data-timer],[data-open-artist],[data-open-album],[data-album-menu],[data-playlist-menu],[data-home-source],[data-open-library],[data-browse-play-all],[data-browse-retry]');
 if(!target)return;
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
 if(target.dataset.browseRetry!=null){loadBrowse(true);return}
 if(target.dataset.browsePlayAll){if(target.dataset.playCollection)playCollection(target.dataset.playCollection.split(','));return}
 if(target.dataset.movePlaylist){moveInPlaylist(target.dataset.movePlaylist,Number(target.dataset.dir));return}
 if(target.dataset.removePlaylist){removeFromPlaylist(target.dataset.removePlaylist);return}
 if(target.dataset.queuePlay){playTrack(target.dataset.queuePlay,state.queueIds);return}
 if(target.dataset.queueMove){moveQueue(target.dataset.queueMove,Number(target.dataset.dir));return}
 if(target.dataset.queueRemove){removeFromQueue(target.dataset.queueRemove);return}
 if(target.dataset.timer!=null){selectSleepTimer(Number(target.dataset.timer));return}
 if(target.dataset.openArtist){openArtist(target.dataset.openArtist);return}
 if(target.dataset.openAlbum){openAlbum(target.dataset.openAlbum);return}
 if(target.dataset.albumMenu){entityMenu('album',target.dataset.albumMenu);return}
 if(target.dataset.playlistMenu){entityMenu('playlist',target.dataset.playlistMenu);return}
 if(target.dataset.homeSource){state.homeSource=target.dataset.homeSource;renderHome();return}
 if(target.dataset.openLibrary){const source=target.dataset.openLibrary==='uploads'?'local':target.dataset.openLibrary==='streamed'?'stream':'all';setLibrarySource(source);setLibraryFilter('all');setLibrarySection(source==='all'?'recent':'songs');show('library')}
}
function setupImportInputs(){
 $('audioImport').addEventListener('change',event=>importAudioFiles(event.target.files));$('folderImport').addEventListener('change',event=>importAudioFiles(event.target.files));
 $('backupImport').addEventListener('change',event=>window.importLibraryBackup(event.target.files?.[0]))
}
function setupDropImport(){
 const overlay=$('importDropTarget');if(!overlay)return;let dragDepth=0;
 document.addEventListener('dragenter',event=>{if(!Array.from(event.dataTransfer?.types||[]).includes('Files'))return;event.preventDefault();dragDepth++;overlay.hidden=false});
 document.addEventListener('dragover',event=>{if(Array.from(event.dataTransfer?.types||[]).includes('Files'))event.preventDefault()});
 document.addEventListener('dragleave',event=>{if(!Array.from(event.dataTransfer?.types||[]).includes('Files'))return;dragDepth=Math.max(0,dragDepth-1);if(!dragDepth)overlay.hidden=true});
 document.addEventListener('drop',event=>{if(!Array.from(event.dataTransfer?.types||[]).includes('Files'))return;event.preventDefault();dragDepth=0;overlay.hidden=true;importAudioFiles(event.dataTransfer.files)})
}
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
 $('largeText').addEventListener('change',event=>setLargeText(event.target.checked));
 $('defaultLibrarySort').addEventListener('change',event=>setLibrarySort(event.target.value));
 $('librarySort').addEventListener('change',event=>setLibrarySort(event.target.value));
 $('persistentStorageButton').addEventListener('click',requestPersistentStorage);
}
function setupScrollTitle(){let queued=false;window.addEventListener('scroll',()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{document.body.classList.toggle('is-scrolled',window.scrollY>90);queued=false})},{passive:true})}
function boot(){
 initPlayer();initActions();initSearch();initCatalog();initDiscovery();setupImportInputs();setupDropImport();setupRowGestures();setupPreferences();setupScrollTitle();setupSheetDrag($('now'),closePlayer);setupSheetDrag($('queuePanel'),closeQueue);setupSheetDrag($('actionDialog'),closeAction);
 Object.assign(window,{show,closePlayer,showDialog,openImportDialog,openAddMenu,loadDiscovery,hideRecommendation,moreLikeRecommendation,resetTasteProfile,setTheme,setAccent,setLargeText,createCategory,importAudioFiles,showLiked,showRecent,showArtists,setLibraryFilter,setLibrarySource,setLibrarySection,openArtist,openAlbum,setLibrarySort,setSearchFilter,setSearchScope,doSearch:renderSearch,setSearchQuery,createPlaylist,newPlaylist,openPlaylist,closePlaylistDetail,playSelectedPlaylist,renameSelectedPlaylist,deleteSelectedPlaylist,playLocal,play,toggle,previousTrack,nextTrack,toggleShuffle,toggleRepeat,playCollection,playNext,addToQueue,openQueue,closeQueue,openSleepTimer,toggleLyrics,openCurrentMenu,toggleCurrentLike,trackMenu,toggleLike,entityMenu,closeAction,moveInPlaylist,removeFromPlaylist,moveQueue,moveQueueTo,removeFromQueue,clearQueue,importLibraryBackup});
 document.addEventListener('click',handleClick);document.getElementById('libraryBack').addEventListener('click',()=>{state.librarySection='overview';state.selectedArtistName=null;state.selectedAlbumName=null;renderLibrary();window.scrollTo({top:0,behavior:'smooth'})});
 document.getElementById('artistBack').addEventListener('click',()=>{state.selectedArtistName=null;renderLibraryArtists()});document.getElementById('albumBack').addEventListener('click',()=>{state.selectedAlbumName=null;renderLibraryAlbums()});
 loadLibraryState().then(()=>{applyPreferences();syncVolume();renderAll();requestPersistentStorage(true);loadDiscovery();window.__auralisSetReady?.()}).catch(error=>{status(error.message);try{renderAll()}catch(renderError){window.__auralisShowStartupError?.('Auralis could not render your library. Reload the app and try again.')}window.__auralisSetReady?.();toast(error.message)})
}
boot();


