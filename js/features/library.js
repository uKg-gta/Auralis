import {state,$,makeId,esc,toast,status,formatDuration,byId,uniqueRecent,artworkClass,artworkUrl,trackRow,sortTracks,icon} from '../core.js';
import {put} from '../storage.js';
import {weeklySeconds} from './profile.js';
import {parseAudioMetadata} from './metadata.js';
import {renderDiscovery} from './discovery.js';

function displayName(track){return track.title||track.name||'Unknown track'}
function artistNames(){return Array.from(new Set(state.tracks.map(track=>track.artist||'Unknown artist'))).sort((a,b)=>a.localeCompare(b))}
function albumNames(){return Array.from(new Set(state.tracks.map(track=>track.album).filter(Boolean))).sort((a,b)=>a.localeCompare(b))}
function makeCard(track,subtitle){
 const url=artworkUrl(track),art='<span class="card-art art '+artworkClass(track)+'">'+(url?'<img src="'+esc(url)+'" alt="">':'')+'<span class="card-play">'+icon('play')+'</span></span>';
 return '<button class="music-card" data-play-track="'+esc(track.id)+'" aria-label="Play '+esc(displayName(track))+' by '+esc(track.artist||'Unknown artist')+'">'+art+'<span class="card-title">'+esc(displayName(track))+'</span><span class="card-subtitle">'+esc(subtitle||track.artist||'Unknown artist')+'</span></button>'
}
function renderShelfTracks(id,tracks,limit=12,subtitle){$(id).innerHTML=tracks.slice(0,limit).map(track=>makeCard(track,subtitle)).join('')}
export function renderHome(){
 const matchesSource=track=>state.homeSource==='all'||(state.homeSource==='local'?track.source!=='stream':track.source==='stream');
 const recent=uniqueRecent().filter(matchesSource),sourceTracks=state.tracks.filter(matchesSource),uploads=sourceTracks.filter(track=>track.source!=='stream'),streamed=sourceTracks.filter(track=>track.source==='stream'),latest=sortTracks(sourceTracks,'recent');
 const current=state.currentTrackId?byId(state.currentTrackId):null,heroTrack=current&&matchesSource(current)?current:recent[0]||latest[0]||null;
 $('homeLoading').hidden=true;$('homeContent').hidden=false;$('homeImportCard').hidden=!!state.tracks.length;
 $('homeSourceSection').hidden=!state.tracks.length;
 renderDiscovery();
 const streamedSource=document.querySelector('[data-home-source="stream"]');if(streamedSource)streamedSource.hidden=!state.tracks.some(track=>track.source==='stream');
 document.querySelectorAll('[data-home-source]').forEach(button=>{const active=button.dataset.homeSource===state.homeSource;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active))});
 const hero=$('homeHeroSection');hero.hidden=!heroTrack;
 if(heroTrack){$('homeHero').dataset.playTrack=heroTrack.id;$('homeHeroTitle').textContent=displayName(heroTrack);$('homeHeroArtist').textContent=heroTrack.artist||'Unknown artist';const art=$('homeHeroArt'),url=artworkUrl(heroTrack);art.className='hero-art art '+artworkClass(heroTrack);art.innerHTML=url?'<img src="'+esc(url)+'" alt="">':''}
 const jump=recent.slice(0,8);$('homeJumpSection').hidden=!jump.length;renderShelfTracks('homeJumpCards',jump,10);
 const later=recent.slice(1);$('homeRecentSection').hidden=!later.length;renderShelfTracks('homeRecent',later,12);
 $('homeUploadsSection').hidden=!uploads.length;renderShelfTracks('homeUploads',sortTracks(uploads,'recent'),12,'On this device');
 $('homeStreamedSection').hidden=!streamed.length;renderShelfTracks('homeStreamed',sortTracks(streamed,'recent'),12,'Streamed from Audius');
 const week=weeklySeconds(),hasListening=state.history.length>0||!!state.sessionRecord;$('homeStatsSection').hidden=!hasListening;$('homeListeningTime').textContent=formatDuration(week.total);$('homeWeekBars').innerHTML=week.days.map(day=>'<span class="week-bar"><i style="height:'+day.height+'px"></i>'+esc(day.label)+'</span>').join('');
}
function renderOverview(){
 const artists=artistNames(),albums=albumNames();
 $('playlistCount').textContent=String(state.playlists.length);$('artistCount').textContent=String(artists.length);$('albumCount').textContent=String(albums.length);
 $('trackCount').textContent=String(state.tracks.length);$('likedCount').textContent=String(state.tracks.filter(track=>track.liked).length);
 $('unorganizedCount').textContent=String(state.tracks.filter(track=>!(track.categories||[]).length).length);$('librarySummary').textContent=state.tracks.length+' '+(state.tracks.length===1?'song':'songs')+' · '+state.playlists.length+' playlists';
 $('libraryEmpty').hidden=!!state.tracks.length;
 $('libraryTagsSection').hidden=!state.categories.length;
 $('categoryList').innerHTML=state.categories.map(category=>'<button class="chip tag-chip" data-library-filter="category:'+esc(category.id)+'" data-library-section="songs">'+icon('tag')+esc(category.name)+'</button>').join('');
 const recently=sortTracks(state.tracks,'recent').slice(0,8);$('recentlyAddedSection').hidden=!recently.length;$('recentlyAddedGrid').innerHTML=recently.map(track=>makeCard(track)).join('');
}
function filteredTracks(){
 let list=state.tracks;
 if(state.libraryFilter==='recent')list=uniqueRecent();
 else if(state.libraryFilter.indexOf('category:')===0){const categoryId=state.libraryFilter.slice(9);list=state.tracks.filter(track=>(track.categories||[]).includes(categoryId))}
 else if(state.libraryFilter==='liked')list=state.tracks.filter(track=>!!track.liked);
 if(state.librarySource==='local')list=list.filter(track=>track.source!=='stream');
 else if(state.librarySource==='stream')list=list.filter(track=>track.source==='stream');
 return sortTracks(list,state.prefs.librarySort||'recent')
}
function renderTrackList(id,list,empty,options={}){
 const container=$(id);if(!container)return;
 container.innerHTML=list.length?list.map((track,index)=>trackRow(track,options.playlist?{playlist:true,playlistIndex:index,playlistCount:list.length}:{query:options.query})).join(''):'<div class="search-empty">'+esc(empty)+'</div>'
}
function renderSongTags(){const box=$('songTags');box.innerHTML=state.categories.map(category=>'<button class="chip tag-chip '+(state.libraryFilter==='category:'+category.id?'active':'')+'" data-library-filter="category:'+esc(category.id)+'">'+icon('tag')+esc(category.name)+'</button>').join('')}
export function renderYourMusic(){
 const list=filteredTracks();renderSongTags();renderTrackList('localTrackList',list,state.tracks.length?'No songs in this view yet.':'Import music to see your songs.');
 document.querySelectorAll('[data-library-filter]').forEach(button=>{const active=button.dataset.libraryFilter===state.libraryFilter;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active))});
 document.querySelectorAll('[data-library-source]').forEach(button=>{const active=button.dataset.librarySource===state.librarySource;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active))})
}
export function renderLibraryArtists(){
 const names=artistNames(),list=$('artistList'),detail=$('artistDetail');list.hidden=!!state.selectedArtistName;detail.hidden=!state.selectedArtistName;
 if(state.selectedArtistName){const artist=state.selectedArtistName,tracks=sortTracks(state.tracks.filter(track=>(track.artist||'Unknown artist')===artist),state.prefs.librarySort||'recent');$('artistDetailTitle').textContent=artist;renderTrackList('artistTracks',tracks,'No songs by this artist.');return}
 list.innerHTML=names.length?names.map(name=>{const ids=state.tracks.filter(track=>(track.artist||'Unknown artist')===name).map(track=>track.id);return '<button class="artist-result" data-open-artist="'+esc(name)+'"><span class="artist-result-icon">'+icon('artist')+'</span><span class="listinfo"><b>'+esc(name)+'</b><small>'+ids.length+' '+(ids.length===1?'song':'songs')+'</small></span>'+icon('chevron-right')+'</button>'}).join(''):'<div class="search-empty">Artist names from your music files appear here.</div>'
}
export function renderLibraryAlbums(){
 const albums=albumNames(),list=$('albumList'),detail=$('albumDetail');list.hidden=!!state.selectedAlbumName;detail.hidden=!state.selectedAlbumName;
 if(state.selectedAlbumName){const album=state.selectedAlbumName,tracks=sortTracks(state.tracks.filter(track=>track.album===album),state.prefs.librarySort||'recent'),track=tracks[0];$('albumDetailTitle').textContent=album;$('albumDetailArtist').textContent=track?.artist||'';renderTrackList('albumTracks',tracks,'No songs in this album.');return}
 list.innerHTML=albums.length?albums.map(album=>{const tracks=state.tracks.filter(track=>track.album===album),first=tracks[0],url=artworkUrl(first),art='<span class="card-art art '+artworkClass(first)+'">'+(url?'<img src="'+esc(url)+'" alt="">':'')+'<span class="card-play">'+icon('play')+'</span></span>';return '<div class="album-card"><button class="album-open" data-open-album="'+esc(album)+'">'+art+'<span class="card-title">'+esc(album)+'</span><span class="card-subtitle">'+esc(first?.artist||'Unknown artist')+' · '+tracks.length+' songs</span></button><button class="icon-button album-menu" data-album-menu="'+esc(album)+'" aria-label="More actions for '+esc(album)+'" aria-haspopup="dialog">'+icon('more')+'</button></div>'}).join(''):'<div class="search-empty">Album details appear when included in your music files.</div>'
}
export function renderLiked(){renderTrackList('likedTrackList',sortTracks(state.tracks.filter(track=>!!track.liked),state.prefs.librarySort||'recent'),'Songs you like will appear here.')}
function renderUnorganized(){renderTrackList('unorganizedTrackList',sortTracks(state.tracks.filter(track=>!(track.categories||[]).length),state.prefs.librarySort||'recent'),'Every song has a tag.')}
export function renderLibrary(){
 renderOverview();const overview=state.librarySection==='overview';$('libraryOverview').hidden=!overview;$('libraryContents').hidden=overview;
 if(overview)return;
 const titleMap={songs:'Songs',recent:'Recently Played',playlists:'Playlists',artists:'Artists',albums:'Albums',liked:'Liked Songs',unorganized:'Unorganized'};
 $('librarySectionTitle').textContent=titleMap[state.librarySection]||'Library';
 document.querySelectorAll('.library-view').forEach(section=>{section.hidden=section.id!=='library'+state.librarySection.charAt(0).toUpperCase()+state.librarySection.slice(1)});
 if(state.librarySection==='songs')renderYourMusic();
 if(state.librarySection==='recent')renderTrackList('recentTrackList',uniqueRecent(),'Play a few songs and your recent listening will show here.');
 if(state.librarySection==='artists')renderLibraryArtists();
 if(state.librarySection==='albums')renderLibraryAlbums();
 if(state.librarySection==='liked')renderLiked();
 if(state.librarySection==='unorganized')renderUnorganized();
 const sort=$('librarySort');if(sort)sort.value=state.prefs.librarySort||'recent'
}
export function setLibraryFilter(filter){state.libraryFilter=filter||'all';renderYourMusic()}
export function setLibrarySource(source){state.librarySource=['local','stream'].includes(source)?source:'all';renderYourMusic()}
export function setLibrarySection(section){const allowed=['overview','songs','recent','playlists','artists','albums','liked','unorganized'];state.selectedArtistName=null;state.selectedAlbumName=null;state.librarySection=allowed.includes(section)?section:'overview';renderLibrary()}
export function showLiked(){setLibrarySection('liked');window.show('library')}
export function showRecent(){setLibrarySection('recent');window.show('library')}
export function showArtists(){setLibrarySection('artists');window.show('library')}
export function openArtist(name){state.selectedArtistName=name;state.selectedAlbumName=null;state.librarySection='artists';renderLibrary();$('artistDetail').scrollIntoView({behavior:'smooth',block:'start'})}
export function openAlbum(name){state.selectedAlbumName=name;state.selectedArtistName=null;state.librarySection='albums';renderLibrary();$('albumDetail').scrollIntoView({behavior:'smooth',block:'start'})}
export async function setLibrarySort(mode){const allowed=['recent','az','artist'];state.prefs.librarySort=allowed.includes(mode)?mode:'recent';try{await put('settings',{key:'preferences',value:state.prefs});renderLibrary()}catch(error){toast('Could not save sort preference')}}
export async function createCategory(name){
 if(typeof name!=='string'){window.showDialog('New tag','<label class="library-count" for="newCategoryName">Tag name</label><input id="newCategoryName" class="dialog-field" maxlength="40" placeholder="For example, Evening listening"><p class="library-hint">Tags group songs without setting their playback order.</p><div class="dialog-footer"><button class="button button-quiet" onclick="closeAction()">Cancel</button><button class="button button-primary" data-action="save-category">Create tag</button></div>');$('newCategoryName').focus();return}
 const value=name.trim();if(!value){$('newCategoryName')?.focus();toast('Enter a tag name');return}
 const category={id:makeId(),name:value.slice(0,40),createdAt:Date.now()};
 try{await put('categories',category);state.categories.push(category);state.refreshAll();toast('Tag created');window.closeAction()}catch(error){toast('Could not save this tag')}
}
export async function importAudioFiles(files){
 if(!files||!files.length)return;let addedCount=0,skipped=0;
 try{
  const known=new Set(state.tracks.map(track=>track.signature).filter(Boolean));
  for(const file of Array.from(files)){
   if(!file.type?.startsWith('audio/')&&!/\.(mp3|m4a|aac|wav|ogg|flac|opus)$/i.test(file.name)){skipped++;continue}
   const signature=file.name+'|'+file.size+'|'+file.lastModified;if(known.has(signature)){skipped++;continue}
   const metadata=await parseAudioMetadata(file),track={id:makeId(),title:metadata.title,artist:metadata.artist,album:metadata.album||'',genre:metadata.genre||'',name:file.name,type:file.type||metadata.artworkType||'audio/*',artwork:metadata.artwork||null,artworkType:metadata.artworkType||'',blob:file,source:'local',added:Date.now()+addedCount,signature,size:file.size,lastModified:file.lastModified,categories:[],liked:false,lyrics:metadata.lyrics||''};
   await put('tracks',track);state.tracks.push(track);known.add(signature);addedCount++
  }
  state.tracks=sortTracks(state.tracks,'recent').reverse();state.refreshAll();status(addedCount+' song(s) added to your library');toast(addedCount?addedCount+' song(s) imported':skipped?'Those files are already in your library':'No supported audio files were selected');
 }catch(error){status('Could not save music: '+error.message);toast('Import failed. Check available browser storage')}
 finally{['audioImport','folderImport'].forEach(id=>{const input=$(id);if(input)input.value=''})}
}


