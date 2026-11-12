import {state,$,makeId,esc,toast,status,formatDuration,byId,uniqueRecent,artworkClass,trackRow,sortTracks,icon} from '../core.js';
import {put} from '../storage.js';
import {weeklySeconds} from './profile.js';

function displayName(track){return track.title||track.name||'Unknown track'}
function artistNames(){return Array.from(new Set(state.tracks.map(track=>track.artist||'Unknown artist'))).sort((a,b)=>a.localeCompare(b))}
export function renderHome(){
 const recent=uniqueRecent(),latest=sortTracks(state.tracks).slice().reverse(),continueTrack=byId(state.currentTrackId)||recent[0]||latest[0]||null;
 $('homeImportCard').hidden=state.tracks.length>0;
 $('homeHeroTitle').textContent=state.tracks.length?'Your listening space':'Import music';
 $('homeHeroText').textContent=state.tracks.length?state.tracks.length+' local '+(state.tracks.length===1?'track is':'tracks are')+' ready on this device.':'Use the + button to choose audio files or a folder, or drop audio files here.';
 $('homeContinueSection').hidden=!continueTrack;
 $('homeContinueTrack').innerHTML=continueTrack?trackRow(continueTrack):'';
 const recentTracks=recent.slice(0,6);
 $('homeRecentSection').hidden=!recentTracks.length;
 $('homeRecent').innerHTML=recentTracks.map(track=>'<div class="song"><div class="art '+artworkClass(track)+'"><button class="play" data-play-track="'+esc(track.id)+'" aria-label="Play '+esc(displayName(track))+'">'+icon('play')+'</button></div><b>'+esc(displayName(track))+'</b><span>'+esc(track.artist||'Unknown artist')+'</span></div>').join('');
 const week=weeklySeconds(),hasListening=state.history.length>0||!!state.sessionRecord;
 $('homeStatsSection').hidden=!hasListening;
 $('homeListeningTime').textContent=formatDuration(week.total);
 $('homeWeekBars').innerHTML=week.days.map(day=>'<div class="week-bar"><i style="height:'+day.height+'px"></i>'+esc(day.label)+'</div>').join('');
}
export function renderLibrary(){
 const liked=state.tracks.filter(track=>!!track.liked),recent=uniqueRecent(),artists=artistNames();
 $('likedCount').textContent=String(liked.length);
 if($('recentCount'))$('recentCount').textContent=String(recent.length);
 $('playlistCount').textContent=String(state.playlists.length);
 $('artistCount').textContent=String(artists.length);
 $('librarySummary').textContent=state.tracks.length+' local '+(state.tracks.length===1?'track':'tracks');
 document.querySelectorAll('[data-library-section]').forEach(button=>{const active=button.dataset.librarySection===state.librarySection;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active))});
 document.querySelectorAll('.library-view').forEach(section=>{section.hidden=section.id!=='library'+state.librarySection.charAt(0).toUpperCase()+state.librarySection.slice(1)});
 renderYourMusic();renderLibraryArtists();renderLiked();
}
function filteredTracks(){if(state.libraryFilter==='liked')return state.tracks.filter(track=>!!track.liked).slice().reverse();if(state.libraryFilter==='recent')return uniqueRecent();if(state.libraryFilter==='unorganized')return state.tracks.filter(track=>!(track.categories||[]).length).slice().reverse();if(state.libraryFilter.indexOf('category:')===0){const categoryId=state.libraryFilter.slice(9);return state.tracks.filter(track=>(track.categories||[]).includes(categoryId)).slice().reverse()}return state.tracks.slice().reverse()}
export function renderCategories(){const counts={};state.tracks.forEach(track=>(track.categories||[]).forEach(categoryId=>{counts[categoryId]=(counts[categoryId]||0)+1}));const box=$('categoryList');box.innerHTML=state.categories.map(category=>{const active=state.libraryFilter==='category:'+category.id;return '<button class="'+(active?'active':'')+'" data-library-filter="category:'+esc(category.id)+'" aria-pressed="'+(active?'true':'false')+'">'+icon('tag')+' '+esc(category.name)+' <span class="count">'+(counts[category.id]||0)+'</span></button>'}).join('');box.hidden=!state.categories.length}
export function renderYourMusic(){renderCategories();$('trackCount')&&($('trackCount').textContent=state.tracks.length+' '+(state.tracks.length===1?'track':'tracks'));const list=filteredTracks();$('localTrackList').innerHTML=list.length?list.map(track=>trackRow(track)).join(''):'<div class="empty-state">'+(state.tracks.length?'No songs in this view yet.':'Your songs will appear here after you import music.')+'</div>';document.querySelectorAll('[data-library-filter]').forEach(button=>{const active=button.dataset.libraryFilter===state.libraryFilter;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active))});$('unorganizedCount')&&($('unorganizedCount').textContent=String(state.tracks.filter(track=>!(track.categories||[]).length).length))}
export function renderLibraryArtists(){const names=artistNames();$('artistList').innerHTML=names.length?names.map(name=>{const ids=state.tracks.filter(track=>(track.artist||'Unknown artist')===name).map(track=>track.id);return '<button class="panel artist-result" data-play-collection="'+esc(ids.join(','))+'" aria-label="Play songs by '+esc(name)+'"><span class="artist-result-icon">'+icon('artist')+'</span><span class="listinfo"><b>'+esc(name)+'</b><span>'+ids.length+' local '+(ids.length===1?'song':'songs')+'</span></span>'+icon('play')+'</button>'}).join(''):'<div class="empty-state">Artists from your imported songs will appear here.</div>'}
export function renderLiked(){const tracks=state.tracks.filter(track=>!!track.liked).slice().reverse();$('likedTrackList').innerHTML=tracks.length?tracks.map(track=>trackRow(track)).join(''):'<div class="empty-state">Songs you like will appear here.</div>'}
export function setLibraryFilter(filter){state.libraryFilter=filter||'all';renderYourMusic()}
export function setLibrarySection(section){const allowed=['songs','playlists','artists','liked'];state.librarySection=allowed.includes(section)?section:'songs';renderLibrary()}
export function showLiked(){state.librarySection='liked';window.show('library');renderLibrary()}
export function showRecent(){state.librarySection='songs';state.libraryFilter='recent';window.show('library');renderLibrary()}
export function showArtists(){state.librarySection='artists';window.show('library');renderLibrary()}
export async function createCategory(name){if(typeof name!=='string'){window.showDialog('Create tag','<label class="library-count" for="newCategoryName">Tag name</label><input id="newCategoryName" class="dialog-field" maxlength="40" placeholder="For example, Evening listening"><p class="library-hint">Tags group songs without setting their play order.</p><div class="dialog-footer"><button class="action" onclick="closeAction()">Cancel</button><button class="action save" data-action="save-category">Create tag</button></div>');$('newCategoryName').focus();return}const value=name.trim();if(!value){$('newCategoryName').focus();toast('Enter a tag name');return}const category={id:makeId(),name:value.slice(0,40),createdAt:Date.now()};try{await put('categories',category);state.categories.push(category);state.refreshAll();toast('Tag created');if(window.closeAction)window.closeAction()}catch(error){toast('Could not save this tag')}}
function safeName(file){return file.name.replace(/\.[^.]+$/,'')}
function parseName(file){const parts=safeName(file).split(' - ');return parts.length>1?{title:parts.slice(1).join(' - '),artist:parts[0]}:{title:safeName(file),artist:'Unknown artist'}}
export async function importAudioFiles(files){if(!files||!files.length)return;let addedCount=0,skipped=0;try{const known=new Set(state.tracks.map(track=>track.signature).filter(Boolean));for(const file of Array.from(files)){if(!file.type?.startsWith('audio/')&&!/\.(mp3|m4a|aac|wav|ogg|flac|opus)$/i.test(file.name)){skipped++;continue}const signature=file.name+'|'+file.size+'|'+file.lastModified;if(known.has(signature)){skipped++;continue}const meta=parseName(file),track={id:makeId(),title:meta.title,artist:meta.artist,name:file.name,type:file.type||'audio/*',blob:file,added:Date.now()+addedCount,signature,size:file.size,lastModified:file.lastModified,categories:[],liked:false,lyrics:''};await put('tracks',track);state.tracks.push(track);known.add(signature);addedCount++}state.tracks=sortTracks(state.tracks);state.refreshAll();status(addedCount+' track(s) added to your library');toast(addedCount?addedCount+' track(s) imported':skipped?'These files are already in your library':'No supported audio files were selected')}catch(error){status('Could not save music: '+error.message);toast('Import failed. Check available browser storage')}finally{['audioImport','folderImport'].forEach(id=>{const input=$(id);if(input)input.value=''})}}
