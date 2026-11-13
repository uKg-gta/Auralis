import {state,$,makeId,esc,toast,byId,icon,artMarkup,releaseArtwork} from '../core.js';
import {put,remove} from '../storage.js';
import {createCategory} from './library.js';
import {playNext,addToQueue,playCollection,stopCurrent} from './player.js';
import {exportLibraryBackup} from './backup.js';
import {saveSourceTrack} from '../sources/index.js';
import {searchRecordings,getRecordingDetails} from '../sources/musicbrainz.js';
import {pauseYouTubePlayback} from '../sources/youtube.js';

let lastDialogTrigger=null,metadataCandidates=[];
function openDialog(title,content){
 const dialog=$('actionDialog'),wasOpen=dialog.open;if(byId(state.currentTrackId)?.source==='youtube')pauseYouTubePlayback();if(!wasOpen)lastDialogTrigger=document.activeElement;
 $('dialogContent').innerHTML='<div class="dialog-top"><h2 id="dialogTitle">'+esc(title)+'</h2><button class="icon-button" data-close-action aria-label="Close actions">'+icon('close')+'</button></div>'+content;
 if(!wasOpen)dialog.showModal();setTimeout(()=>dialog.querySelector('button,input,textarea')?.focus(),0)
}
export function showDialog(title,content){openDialog(title,content)}
export function closeAction(){const dialog=$('actionDialog');if(dialog.open)dialog.close();const trigger=lastDialogTrigger;lastDialogTrigger=null;if(trigger?.isConnected)requestAnimationFrame(()=>trigger.focus({preventScroll:true}))}
export function openAddMenu(){
 openDialog('Create','<div class="dialog-options"><button data-action="new-playlist">'+icon('playlist')+' New playlist</button><button data-action="new-tag">'+icon('tag')+' New tag</button></div>')
}
export function openCurrentMenu(){if(state.currentTrackId)trackMenu(state.currentTrackId)}
export function toggleCurrentLike(){if(state.currentTrackId)toggleLike(state.currentTrackId)}
function trackHeader(track){return '<div class="dialog-track">'+artMarkup(track,'thumb')+'<span><b>'+esc(track.title||track.name||'Track')+'</b><span>'+esc(track.artist||'Unknown artist')+'</span></span></div>'}
export function trackMenu(trackId){
 const track=byId(trackId);if(!track)return;state.dialogTrackId=trackId;
 const saved=state.tracks.some(item=>item.id===trackId),catalogOnly=['audius','youtube','jamendo'].includes(track.source)&&!saved;
 let options='<button data-action="play-next">'+icon('next')+' Play Next</button><button data-action="add-queue">'+icon('queue')+' Add to Queue</button>';
 if(catalogOnly)options+='<button data-action="save-stream">'+icon('plus')+' Add to Library</button>';
 options+='<button data-action="add-playlist">'+icon('playlist')+' Add to Playlist</button><button data-action="toggle-like">'+icon(track.liked?'heart-filled':'heart')+' '+(track.liked?'Remove from Liked Songs':'Like Song')+'</button><button data-action="go-artist">'+icon('artist')+(track.source==='audius'?' Open Artist on Audius':track.source==='jamendo'?' Open Artist on Jamendo':' Go to Artist')+'</button>';
 
 options+='<button data-action="find-elsewhere">'+icon('search')+' Find elsewhere on YouTube</button>';
 if(saved&&track.source!=='youtube'&&track.source!=='jamendo')options+='<button data-action="edit-track">'+icon('edit')+' Edit Details</button><button data-action="edit-lyrics">'+icon('lyrics')+' Add or Edit Lyrics</button><button data-action="categories">'+icon('tag')+' Organize with Tags</button>';
 if(saved)options+='<button class="danger" data-action="remove-track">'+icon('trash')+' Remove from Library</button>';
 options+='<button data-action="share-track">'+icon('upload')+' '+(track.source==='youtube'?'Open on YouTube':['audius','jamendo'].includes(track.source)?'Open source':'Share')+'</button>';
 openDialog('Song actions',trackHeader(track)+'<div class="dialog-options">'+options+'</div>')
}
export function entityMenu(type,id){
 state.dialogEntity={type,id};
 if(type==='album'){
  state.dialogAlbum=id;const tracks=state.tracks.filter(track=>track.album===id),ids=tracks.map(track=>track.id);
  openDialog('Album actions','<div class="dialog-track">'+artMarkup(tracks[0],'thumb')+'<span><b>'+esc(id)+'</b><span>'+esc(tracks[0]?.artist||'Unknown artist')+' · '+tracks.length+' songs</span></span></div><div class="dialog-options"><button data-action="play-entity">'+icon('play')+' Play Album</button><button data-action="play-next-entity">'+icon('next')+' Play Next</button><button data-action="queue-entity">'+icon('queue')+' Add Album to Queue</button><button data-action="go-album-artist">'+icon('artist')+' Go to Artist</button><button data-action="share-entity">'+icon('upload')+' Share Album</button><button class="danger" data-action="remove-entity">'+icon('trash')+' Remove Album from Library</button></div>');
  state.dialogEntity.ids=ids;return
 }
 if(type==='playlist'){
  const playlist=state.playlists.find(item=>item.id===id);if(!playlist)return;state.dialogEntity.ids=playlist.trackIds||[];
  openDialog('Playlist actions','<div class="dialog-track">'+icon('playlist')+'<span><b>'+esc(playlist.name)+'</b><span>'+state.dialogEntity.ids.length+' songs</span></span></div><div class="dialog-options"><button data-action="play-entity">'+icon('play')+' Play Playlist</button><button data-action="play-next-entity">'+icon('next')+' Play Next</button><button data-action="queue-entity">'+icon('queue')+' Add Playlist to Queue</button><button data-action="share-entity">'+icon('upload')+' Share Playlist</button><button data-action="rename-entity">'+icon('edit')+' Rename Playlist</button><button class="danger" data-action="delete-entity">'+icon('trash')+' Delete Playlist</button></div>')
 }
}
export async function toggleLike(trackId){
 let track=byId(trackId);if(!track)return;
 if(['audius','youtube','jamendo'].includes(track.source)&&!state.tracks.some(item=>item.id===trackId)){try{await saveSourceTrack(trackId)}catch(error){toast('Could not save this streamed song');return}}
 if(!track)return;const reference=state.tracks.find(item=>item.id===trackId);track.liked=!track.liked;
 try{if(reference){reference.liked=track.liked;await put('tracks',reference)}else await put('tracks',track);state.refreshAll();state.renderCurrent();toast(track.liked?'Added to Liked Songs':'Removed from Liked Songs')}catch(error){track.liked=!track.liked;if(reference)reference.liked=track.liked;toast('Could not update Liked Songs')}
}
function openAddPlaylist(){
 const options=state.playlists.length?state.playlists.map(playlist=>'<button data-pick-playlist="'+esc(playlist.id)+'">'+icon('playlist')+' '+esc(playlist.name)+' · '+(playlist.trackIds||[]).length+' songs</button>').join(''):'<div class="search-empty">Create a playlist first, then add this song.</div>';
 openDialog('Add to Playlist','<div class="dialog-options">'+options+'</div><div class="add-playlist-form"><label for="dialogPlaylistName">Or create a playlist</label><input id="dialogPlaylistName" class="dialog-field" maxlength="60" placeholder="New playlist name"><button class="button button-primary" data-action="create-dialog-playlist">Create and add song</button></div>')
}
function openCategories(){
 const track=byId(state.dialogTrackId);if(!track)return;const options=state.categories.length?state.categories.map(category=>{const included=(track.categories||[]).includes(category.id);return '<button data-toggle-category="'+esc(category.id)+'">'+icon(included?'check':'tag')+' '+esc(category.name)+(included?' · Added':'')+'</button>'}).join(''):'<div class="search-empty">Create a tag to organize this song.</div>';
 openDialog('Organize with Tags','<div class="dialog-options">'+options+'</div><button class="button button-secondary" style="width:100%;margin-top:10px" onclick="closeAction();createCategory()">'+icon('plus')+' New Tag</button>')
}
async function saveTrackMetadata(){
 const track=byId(state.dialogTrackId);if(!track)return;track.title=$('editTitle').value.trim()||'Untitled track';track.artist=$('editArtist').value.trim()||'Unknown artist';track.album=$('editAlbum').value.trim();track.genre=$('editGenre').value.trim();
 try{await put('tracks',track);state.refreshAll();state.renderCurrent();toast('Song details saved');closeAction()}catch(error){toast('Could not save song details')}
}
async function saveLyrics(){
 const track=byId(state.dialogTrackId);if(!track)return;track.lyrics=$('editLyrics').value;
 try{await put('tracks',track);state.renderCurrent();toast('Lyrics saved on this device');closeAction()}catch(error){toast('Could not save lyrics')}
}
async function removeTrack(trackId){
 const track=byId(trackId);if(!track)return;const message=['audius','youtube','jamendo'].includes(track.source)?'Remove “'+(track.title||track.name)+'” from your Auralis library? The source stays available from its provider.':'Remove “'+(track.title||track.name)+'” from this device? This removes its imported audio from this browser.';if(!confirm(message))return;
 try{await remove('tracks',trackId);state.tracks=state.tracks.filter(item=>item.id!==trackId);state.playlists.forEach(playlist=>{playlist.trackIds=(playlist.trackIds||[]).filter(item=>item!==trackId)});await Promise.all(state.playlists.map(playlist=>put('playlists',playlist)));releaseArtwork(trackId);stopCurrent(trackId);state.queueIds=state.queueIds.filter(item=>item!==trackId);state.queueBaseIds=state.queueIds.slice();state.queueIndex=state.queueIds.indexOf(state.currentTrackId);state.refreshAll();closeAction();toast('Song removed from your library')}catch(error){toast('Could not remove this song')}
}
async function createFromDialog(){
 const field=$('dialogPlaylistName'),name=field.value.trim();if(!name){field.focus();return}
 try{await saveSourceTrack(state.dialogTrackId)}catch(error){toast('Could not save this streamed song');return}
 const playlist={id:makeId(),name,trackIds:[state.dialogTrackId],createdAt:Date.now()};
 put('playlists',playlist).then(()=>{state.playlists.push(playlist);state.refreshAll();closeAction();toast('Playlist created and song added')}).catch(()=>toast('Could not create playlist'))
}
function toggleTrackCategory(categoryId){
 const track=byId(state.dialogTrackId),category=state.categories.find(item=>item.id===categoryId);if(!track||!category)return;
 const list=track.categories||[];track.categories=list.includes(categoryId)?list.filter(value=>value!==categoryId):list.concat(categoryId);
 put('tracks',track).then(()=>{state.refreshAll();openCategories()}).catch(()=>toast('Could not update tag'))
}
async function choosePlaylist(playlistId){
 const playlist=state.playlists.find(item=>item.id===playlistId);if(!playlist)return;playlist.trackIds=playlist.trackIds||[];
 try{await saveSourceTrack(state.dialogTrackId)}catch(error){toast('Could not save this streamed song');return}
 if(!playlist.trackIds.includes(state.dialogTrackId))playlist.trackIds.push(state.dialogTrackId);
 put('playlists',playlist).then(()=>{state.refreshAll();closeAction();toast('Added to '+playlist.name)}).catch(()=>toast('Could not add song'))
}
async function shareTrack(){
 const track=byId(state.dialogTrackId);if(!track)return;const text=(track.title||track.name)+' — '+(track.artist||'Unknown artist');
 try{if(['audius','youtube','jamendo'].includes(track.source)&&track.sourceUrl){window.open(track.sourceUrl,'_blank','noopener,noreferrer');return}if(navigator.share)await navigator.share({title:track.title||track.name,text});else if(navigator.clipboard){await navigator.clipboard.writeText(text);toast('Song details copied')}else toast(text)}catch(error){if(error.name!=='AbortError')toast('Could not share this song')}
}
async function findMetadata(){
 const track=byId(state.dialogTrackId);if(!track)return;const query=[track.title||track.name,track.artist].filter(Boolean).join(' ');metadataCandidates=[];
 openDialog('MusicBrainz suggestions','<p class="search-empty" role="status">Searching MusicBrainz…</p>');
 try{
  metadataCandidates=await searchRecordings(query,{limit:8});
  if(!metadataCandidates.length){openDialog('MusicBrainz suggestions','<p class="search-empty">No recording matches were found. Try editing the song title or artist first.</p><div class="dialog-footer"><button class="button button-quiet" data-close-action>Close</button><button class="button button-secondary" data-action="find-metadata">Try again</button></div>');return}
  const options=metadataCandidates.map((item,index)=>'<button data-metadata-pick="'+index+'">'+icon('music')+'<span class="listinfo"><b>'+esc(item.title)+'</b><small>'+esc(item.artist||'Unknown artist')+(item.releases?.[0]?' · '+esc(item.releases[0].title):'')+'</small></span></button>').join('');
  openDialog('Choose a metadata match','<p class="import-guidance">Review the MusicBrainz match. Auralis asks before saving any changes.</p><div class="dialog-options">'+options+'</div>')
 }catch(error){openDialog('MusicBrainz unavailable','<p class="search-empty" role="alert">'+esc(error.message||'Could not search MusicBrainz.')+'</p><div class="dialog-footer"><button class="button button-quiet" data-close-action>Close</button><button class="button button-secondary" data-action="find-metadata">Try again</button></div>')}
}
async function applyMetadataSuggestion(index){
 const track=byId(state.dialogTrackId),candidate=metadataCandidates[index];if(!track||!candidate)return;
 if(candidate.id&&!candidate.releases?.length){openDialog('Loading metadata','<p class="search-empty" role="status">Checking MusicBrainz release details…</p>');try{const details=await getRecordingDetails(candidate.id);candidate.releases=details.releases}catch(error){openDialog('MusicBrainz unavailable','<p class="search-empty" role="alert">'+esc(error.message||'Could not load release details.')+'</p><div class="dialog-footer"><button class="button button-quiet" data-close-action>Close</button><button class="button button-secondary" data-metadata-pick="'+index+'">Try again</button></div>');return}}
 const suggested={title:candidate.title||'',artist:candidate.artist||'',album:candidate.releases?.[0]?.title||''},changes=[];
 for(const field of ['title','artist','album'])if(suggested[field]&&suggested[field]!==String(track[field]||''))changes.push({field,before:String(track[field]||''),after:suggested[field]});
 if(!changes.length){toast('These details already match');return}
 const summary=changes.map(change=>change.field[0].toUpperCase()+change.field.slice(1)+': “'+(change.before||'empty')+'” → “'+change.after+'”').join('\n');
 if(!confirm('Apply these MusicBrainz suggestions to this song?\n\n'+summary))return;
 changes.forEach(change=>{track[change.field]=change.after});
 try{await put('tracks',track);state.refreshAll();state.renderCurrent();closeAction();toast('Song details updated')}catch(error){changes.forEach(change=>{track[change.field]=change.before});toast('Could not save song details')}
}
function findElsewhere(){
 const track=byId(state.dialogTrackId);if(!track)return;const query=[track.title||track.name,track.artist].filter(Boolean).join(' '),url='https://www.youtube.com/results?search_query='+encodeURIComponent(query);
 window.open(url,'_blank','noopener,noreferrer');closeAction()
}
async function shareEntity(){
 const entity=state.dialogEntity;if(!entity)return;const playlist=entity.type==='playlist'?state.playlists.find(item=>item.id===entity.id):null,title=playlist?.name||state.dialogAlbum||'Music collection',tracks=(entity.ids||[]).map(byId).filter(Boolean),text=title+(tracks.length?' · '+tracks.map(track=>(track.title||track.name)+' — '+(track.artist||'Unknown artist')).join('\n'):'');
 try{if(navigator.share)await navigator.share({title,text});else if(navigator.clipboard){await navigator.clipboard.writeText(text);toast('Collection details copied')}else toast('Could not share this collection')}catch(error){if(error.name!=='AbortError')toast('Could not share this collection')}
}
async function removeAlbum(){
 const ids=Array.from(new Set(state.dialogEntity?.ids||[])).filter(id=>byId(id));if(!ids.length)return;
 if(!confirm('Remove album “'+state.dialogAlbum+'” and its '+ids.length+' songs from this device?'))return;
 try{
  const removed=ids.map(byId).filter(Boolean);await Promise.all(ids.map(id=>remove('tracks',id)));
  state.tracks=state.tracks.filter(track=>!ids.includes(track.id));removed.forEach(track=>{releaseArtwork(track.id);stopCurrent(track.id)});
  state.playlists.forEach(playlist=>{playlist.trackIds=(playlist.trackIds||[]).filter(id=>!ids.includes(id))});await Promise.all(state.playlists.map(playlist=>put('playlists',playlist)));
  state.queueIds=state.queueIds.filter(id=>!ids.includes(id));state.queueBaseIds=state.queueIds.slice();state.queueIndex=state.queueIds.indexOf(state.currentTrackId);state.refreshAll();closeAction();toast('Album removed from your library')
 }catch(error){toast('Could not remove this album')}
}
function handleDialogClick(event){
 const button=event.target.closest('[data-action],[data-pick-playlist],[data-toggle-category],[data-export-library],[data-import-backup],[data-close-action],[data-metadata-pick]');if(!button)return;
 if(button.hasAttribute('data-close-action')){closeAction();return}
 if(button.hasAttribute('data-export-library')){exportLibraryBackup();return}
 if(button.hasAttribute('data-import-backup')){closeAction();$('backupImport').click();return}
 if(button.dataset.pickPlaylist){choosePlaylist(button.dataset.pickPlaylist);return}
 if(button.dataset.toggleCategory){toggleTrackCategory(button.dataset.toggleCategory);return}
 if(button.dataset.metadataPick!==undefined){applyMetadataSuggestion(Number(button.dataset.metadataPick));return}
 const action=button.dataset.action;
 if(action==='open-backup-import'){$('backupImport').click();closeAction()}
 else if(action==='new-playlist'){closeAction();window.newPlaylist()}
 else if(action==='new-tag'){closeAction();createCategory()}
 else if(action==='toggle-like')toggleLike(state.dialogTrackId).then(closeAction);
 else if(action==='save-stream')saveSourceTrack(state.dialogTrackId).then(track=>{if(!track)throw new Error('Track is unavailable');state.refreshAll();closeAction();toast('Added to your library')}).catch(()=>toast('Could not add this track to your library'));
 else if(action==='play-next'){playNext(state.dialogTrackId);closeAction()}
 else if(action==='add-queue'){addToQueue(state.dialogTrackId);closeAction()}
 else if(action==='add-playlist')saveSourceTrack(state.dialogTrackId).then(()=>{state.refreshAll();openAddPlaylist()}).catch(()=>toast('Could not add this track to a playlist'));
 else if(action==='categories')openCategories();
 else if(action==='go-artist'){const track=byId(state.dialogTrackId);closeAction();if(track?.artistUrl&&['audius','youtube','jamendo'].includes(track.source))window.open(track.artistUrl,'_blank','noopener,noreferrer');else if(track?.artist)window.openArtist(track.artist)}
 else if(action==='find-elsewhere')findElsewhere();
 else if(action==='find-metadata')findMetadata();
 else if(action==='edit-track'){const track=byId(state.dialogTrackId);openDialog('Edit Details','<label for="editTitle">Title</label><input id="editTitle" class="dialog-field" maxlength="120" value="'+esc(track.title||track.name)+'"><label for="editArtist">Artist</label><input id="editArtist" class="dialog-field" maxlength="120" value="'+esc(track.artist||'')+'"><label for="editAlbum">Album</label><input id="editAlbum" class="dialog-field" maxlength="120" value="'+esc(track.album||'')+'"><label for="editGenre">Genre</label><input id="editGenre" class="dialog-field" maxlength="80" value="'+esc(track.genre||'')+'"><div class="dialog-footer"><button class="button button-quiet" onclick="closeAction()">Cancel</button><button class="button button-primary" data-action="save-metadata">Save</button></div>')}
 else if(action==='save-metadata')saveTrackMetadata();
 else if(action==='edit-lyrics'){const track=byId(state.dialogTrackId);openDialog('Lyrics for '+(track.title||'song'),'<textarea id="editLyrics" class="dialog-field" rows="9" placeholder="Add plain text or timestamped LRC lyrics">'+esc(track.lyrics||'')+'</textarea><div class="dialog-footer"><button class="button button-quiet" onclick="closeAction()">Cancel</button><button class="button button-primary" data-action="save-lyrics">Save Lyrics</button></div>')}
 else if(action==='save-lyrics')saveLyrics();
 else if(action==='remove-track')removeTrack(state.dialogTrackId);
 else if(action==='create-dialog-playlist')createFromDialog();
 else if(action==='save-category')createCategory($('newCategoryName').value);
 else if(action==='share-track')shareTrack();
 else if(action==='share-entity')shareEntity();
 else if(action==='remove-entity')removeAlbum();
 else if(action==='play-entity'){const ids=state.dialogEntity?.ids||[];closeAction();if(ids.length)playCollection(ids)}
 else if(action==='play-next-entity'){const ids=state.dialogEntity?.ids||[];closeAction();ids.slice().reverse().forEach(id=>playNext(id))}
 else if(action==='queue-entity'){const ids=state.dialogEntity?.ids||[];closeAction();ids.forEach(id=>window.addToQueue(id))}
 else if(action==='go-album-artist'){const track=state.tracks.find(item=>item.album===state.dialogAlbum);closeAction();if(track?.artist)window.openArtist(track.artist)}
 else if(action==='rename-entity'){state.selectedPlaylistId=state.dialogEntity.id;closeAction();window.renameSelectedPlaylist()}
 else if(action==='delete-entity'){state.selectedPlaylistId=state.dialogEntity.id;closeAction();window.deleteSelectedPlaylist()}
 else if(action==='save-rename'){const playlist=state.playlists.find(item=>item.id===state.selectedPlaylistId);if(playlist){playlist.name=$('renamePlaylist').value.trim()||playlist.name;put('playlists',playlist).then(()=>{state.refreshAll();closeAction();toast('Playlist renamed')}).catch(()=>toast('Could not rename playlist'))}}
}
export function initActions(){
 document.addEventListener('click',handleDialogClick);
 window.showDialog=showDialog;window.closeAction=closeAction;window.trackMenu=trackMenu;window.toggleLike=toggleLike;window.entityMenu=entityMenu;
}

