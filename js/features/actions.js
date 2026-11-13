import {state,$,makeId,esc,toast,byId,icon,artMarkup,releaseArtwork} from '../core.js';
import {put,remove} from '../storage.js';
import {createCategory} from './library.js';
import {playNext,addToQueue,playCollection,stopCurrent} from './player.js';
import {exportLibraryBackup} from './backup.js';
import {saveStreamTrack} from './catalog.js';
import {recordDiscoverySignal} from './discovery.js';

let lastDialogTrigger=null;
function openDialog(title,content){
 const dialog=$('actionDialog'),wasOpen=dialog.open;if(!wasOpen)lastDialogTrigger=document.activeElement;
 $('dialogContent').innerHTML='<div class="dialog-top"><h2>'+esc(title)+'</h2><button class="icon-button" data-close-action aria-label="Close actions">'+icon('close')+'</button></div>'+content;
 if(!wasOpen)dialog.showModal();setTimeout(()=>dialog.querySelector('button,input,textarea')?.focus(),0)
}
export function showDialog(title,content){openDialog(title,content)}
export function closeAction(){const dialog=$('actionDialog');if(dialog.open)dialog.close();const trigger=lastDialogTrigger;lastDialogTrigger=null;if(trigger?.isConnected)requestAnimationFrame(()=>trigger.focus({preventScroll:true}))}
export function openImportDialog(){
 openDialog('Add your music','<div class="import-guidance"><p>Audio stays in this browser on this device. Export a backup before clearing site data or moving browsers.</p><p><b>Formats:</b> MP3, M4A, AAC, WAV, OGG, FLAC and OPUS. Choose multiple files, select a folder, or drop files into Auralis.</p></div><div class="dialog-options"><button data-import-files>'+icon('music')+' Import audio files</button><button data-import-folder>'+icon('folder')+' Choose a music folder</button><button data-action="open-backup-import">'+icon('download')+' Restore a library backup</button></div>')
}
export function openAddMenu(){
 openDialog('Add to your library','<div class="dialog-options"><button data-action="open-import">'+icon('upload')+' Import music</button><button data-action="new-playlist">'+icon('playlist')+' New playlist</button><button data-action="new-tag">'+icon('tag')+' New tag</button><button data-action="open-backup-import">'+icon('download')+' Import backup</button></div>')
}
export function openCurrentMenu(){if(state.currentTrackId)trackMenu(state.currentTrackId)}
export function toggleCurrentLike(){if(state.currentTrackId)toggleLike(state.currentTrackId)}
function trackHeader(track){return '<div class="dialog-track">'+artMarkup(track,'thumb')+'<span><b>'+esc(track.title||track.name||'Track')+'</b><span>'+esc(track.artist||'Unknown artist')+'</span></span></div>'}
export function trackMenu(trackId){
 const track=byId(trackId);if(!track)return;state.dialogTrackId=trackId;
 const saved=state.tracks.some(item=>item.id===trackId),catalogOnly=track.source==='stream'&&!saved;
 let options='<button data-action="play-next">'+icon('next')+' Play Next</button><button data-action="add-queue">'+icon('queue')+' Add to Queue</button>';
 if(catalogOnly)options+='<button data-action="save-stream">'+icon('plus')+' Add to Library</button>';
 options+='<button data-action="add-playlist">'+icon('playlist')+' Add to Playlist</button><button data-action="toggle-like">'+icon(track.liked?'heart-filled':'heart')+' '+(track.liked?'Remove from Liked Songs':'Like Song')+'</button><button data-action="go-artist">'+icon('artist')+(track.source==='stream'?' Open Artist on Audius':' Go to Artist')+'</button>';
 if(saved)options+='<button data-action="edit-track">'+icon('edit')+' Edit Details</button><button data-action="edit-lyrics">'+icon('lyrics')+' Add or Edit Lyrics</button><button data-action="categories">'+icon('tag')+' Organize with Tags</button><button class="danger" data-action="remove-track">'+icon('trash')+' Remove from Library</button>';
 options+='<button data-action="share-track">'+icon('upload')+' '+(track.source==='stream'?'Open Track on Audius':'Share')+'</button>';
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
 if(track.source==='stream'&&!state.tracks.some(item=>item.id===trackId)){try{track=await saveStreamTrack(trackId)}catch(error){toast('Could not save this streamed song');return}}
 if(!track)return;track.liked=!track.liked;if(track.liked)recordDiscoverySignal('track_liked',track);
 try{await put('tracks',track);state.refreshAll();state.renderCurrent();toast(track.liked?'Added to Liked Songs':'Removed from Liked Songs')}catch(error){track.liked=!track.liked;toast('Could not update Liked Songs')}
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
 const track=byId(trackId);if(!track)return;const message=track.source==='stream'?'Remove “'+(track.title||track.name)+'” from your Auralis library? Its stream stays on Audius.':'Remove “'+(track.title||track.name)+'” from this device? This removes its imported audio from this browser.';if(!confirm(message))return;
 try{await remove('tracks',trackId);state.tracks=state.tracks.filter(item=>item.id!==trackId);state.playlists.forEach(playlist=>{playlist.trackIds=(playlist.trackIds||[]).filter(item=>item!==trackId)});await Promise.all(state.playlists.map(playlist=>put('playlists',playlist)));releaseArtwork(trackId);stopCurrent(trackId);state.queueIds=state.queueIds.filter(item=>item!==trackId);state.queueBaseIds=state.queueIds.slice();state.queueIndex=state.queueIds.indexOf(state.currentTrackId);state.refreshAll();closeAction();toast('Song removed from your library')}catch(error){toast('Could not remove this song')}
}
async function createFromDialog(){
 const field=$('dialogPlaylistName'),name=field.value.trim();if(!name){field.focus();return}
 try{await saveStreamTrack(state.dialogTrackId)}catch(error){toast('Could not save this streamed song');return}
 const playlist={id:makeId(),name,trackIds:[state.dialogTrackId],createdAt:Date.now()};const addedTrack=byId(state.dialogTrackId);if(addedTrack)recordDiscoverySignal('playlist_added',addedTrack,{playlistId:playlist.id})
 put('playlists',playlist).then(()=>{state.playlists.push(playlist);state.refreshAll();closeAction();toast('Playlist created and song added')}).catch(()=>toast('Could not create playlist'))
}
function toggleTrackCategory(categoryId){
 const track=byId(state.dialogTrackId),category=state.categories.find(item=>item.id===categoryId);if(!track||!category)return;
 const list=track.categories||[];track.categories=list.includes(categoryId)?list.filter(value=>value!==categoryId):list.concat(categoryId);
 put('tracks',track).then(()=>{state.refreshAll();openCategories()}).catch(()=>toast('Could not update tag'))
}
async function choosePlaylist(playlistId){
 const playlist=state.playlists.find(item=>item.id===playlistId);if(!playlist)return;playlist.trackIds=playlist.trackIds||[];
 try{await saveStreamTrack(state.dialogTrackId)}catch(error){toast('Could not save this streamed song');return}
 if(!playlist.trackIds.includes(state.dialogTrackId)){playlist.trackIds.push(state.dialogTrackId);const addedTrack=byId(state.dialogTrackId);if(addedTrack)recordDiscoverySignal('playlist_added',addedTrack,{playlistId:playlist.id})}
 put('playlists',playlist).then(()=>{state.refreshAll();closeAction();toast('Added to '+playlist.name)}).catch(()=>toast('Could not add song'))
}
async function shareTrack(){
 const track=byId(state.dialogTrackId);if(!track)return;const text=(track.title||track.name)+' — '+(track.artist||'Unknown artist');
 try{if(track.source==='stream'&&track.providerUrl){window.open(track.providerUrl,'_blank','noopener,noreferrer');return}if(navigator.share)await navigator.share({title:track.title||track.name,text});else if(navigator.clipboard){await navigator.clipboard.writeText(text);toast('Song details copied')}else toast(text)}catch(error){if(error.name!=='AbortError')toast('Could not share this song')}
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
 const button=event.target.closest('[data-action],[data-pick-playlist],[data-toggle-category],[data-import-files],[data-import-folder],[data-export-library],[data-import-backup],[data-close-action]');if(!button)return;
 if(button.hasAttribute('data-close-action')){closeAction();return}
 if(button.dataset.importFiles!==undefined){closeAction();$('audioImport').click();return}
 if(button.dataset.importFolder!==undefined){closeAction();$('folderImport').click();return}
 if(button.hasAttribute('data-export-library')){exportLibraryBackup();return}
 if(button.hasAttribute('data-import-backup')){closeAction();$('backupImport').click();return}
 if(button.dataset.pickPlaylist){choosePlaylist(button.dataset.pickPlaylist);return}
 if(button.dataset.toggleCategory){toggleTrackCategory(button.dataset.toggleCategory);return}
 const action=button.dataset.action;
 if(action==='open-import')openImportDialog();
 else if(action==='open-backup-import'){$('backupImport').click();closeAction()}
 else if(action==='new-playlist'){closeAction();window.newPlaylist()}
 else if(action==='new-tag'){closeAction();createCategory()}
 else if(action==='toggle-like')toggleLike(state.dialogTrackId).then(closeAction);
 else if(action==='save-stream')saveStreamTrack(state.dialogTrackId).then(track=>{if(!track)throw new Error('Track is unavailable');state.refreshAll();closeAction();toast('Added to your Streamed library')}).catch(()=>toast('Could not add this track to your library'));
 else if(action==='play-next'){playNext(state.dialogTrackId);closeAction()}
 else if(action==='add-queue'){addToQueue(state.dialogTrackId);closeAction()}
 else if(action==='add-playlist')saveStreamTrack(state.dialogTrackId).then(()=>{state.refreshAll();openAddPlaylist()}).catch(()=>toast('Could not add this track to a playlist'));
 else if(action==='categories')openCategories();
 else if(action==='go-artist'){const track=byId(state.dialogTrackId);closeAction();if(track?.source==='stream'&&track.artistUrl)window.open(track.artistUrl,'_blank','noopener,noreferrer');else if(track?.artist)window.openArtist(track.artist)}
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

