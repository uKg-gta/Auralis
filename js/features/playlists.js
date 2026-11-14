import {state,$,makeId,esc,toast,byId,playlistTrackIds,trackRow,icon} from '../core.js';
import {put,remove} from '../storage.js';
import {playCollection} from './player.js';
import {setLibrarySection} from './library.js';

export function renderPlaylists(){
 const box=$('playlistGrid'),saved=state.playlists.map(playlist=>{const count=playlistTrackIds(playlist).length;return '<article class="playlist-card"><button class="album-open" data-open-playlist="'+esc(playlist.id)+'" aria-label="Open playlist '+esc(playlist.name)+'"><span class="card-art playlist-art">'+icon('playlist','playlist-mark')+'<span class="card-play">'+icon('chevron-right')+'</span></span><span class="card-title">'+esc(playlist.name)+'</span><span class="card-subtitle">'+count+' '+(count===1?'song':'songs')+'</span></button><button class="icon-button album-menu" data-playlist-menu="'+esc(playlist.id)+'" aria-label="More actions for '+esc(playlist.name)+'" aria-haspopup="dialog">'+icon('more')+'</button></article>'}).join('');
 box.innerHTML=saved||'<div class="search-empty">Your playlists will appear here. Create one to collect songs.</div>';
 if(state.selectedPlaylistId)renderPlaylistDetail()
}
export function renderPlaylistDetail(){
 const playlist=state.playlists.find(item=>item.id===state.selectedPlaylistId);if(!playlist){$('playlistDetail').hidden=true;state.selectedPlaylistId=null;return}
 const ids=playlistTrackIds(playlist),rows=ids.map((trackId,index)=>{const track=byId(trackId);return track?trackRow(track,{playlist:true,playlistIndex:index,playlistCount:ids.length}):''}).join('');
 $('playlistDetail').hidden=false;$('playlistDetailTitle').textContent=playlist.name;$('playlistDetailCount').textContent=ids.length+' '+(ids.length===1?'song':'songs');$('playlistTracks').innerHTML=rows||'<div class="search-empty">This playlist is empty. Add songs from a track menu.</div>'
}
export async function createPlaylist(){
 const field=$('playlistName'),name=field.value.trim();if(!name){toast('Give your playlist a name');field.focus();return}
 const playlist={id:makeId(),name,trackIds:[],createdAt:Date.now()};
 try{await put('playlists',playlist);state.playlists.push(playlist);field.value='';$('playlistForm').hidden=true;state.refreshAll();state.librarySection='playlists';openPlaylist(playlist.id);toast('Playlist created')}catch(error){toast('Could not save this playlist')}
}
export function newPlaylist(){state.selectedPlaylistId=null;$('playlistDetail').hidden=true;setLibrarySection('playlists');window.show('library');const form=$('playlistForm');form.hidden=false;$('playlistName').focus();form.scrollIntoView({behavior:'smooth',block:'center'})}
export function openPlaylist(playlistId){state.selectedPlaylistId=playlistId;state.librarySection='playlists';window.show('library');renderPlaylists();renderPlaylistDetail();$('playlistDetail').scrollIntoView({behavior:'smooth',block:'start'})}
export function closePlaylistDetail(){$('playlistDetail').hidden=true;state.selectedPlaylistId=null}
export function playSelectedPlaylist(){const playlist=state.playlists.find(item=>item.id===state.selectedPlaylistId);if(playlist)playCollection(playlistTrackIds(playlist))}
export function renameSelectedPlaylist(){const playlist=state.playlists.find(item=>item.id===state.selectedPlaylistId);if(!playlist)return;window.showDialog('Rename playlist','<label for="renamePlaylist" class="library-count">Playlist name</label><input id="renamePlaylist" class="dialog-field" maxlength="60" value="'+esc(playlist.name)+'"><div class="dialog-footer"><button class="button button-quiet" data-close-action>Cancel</button><button class="button button-primary" data-action="save-rename">Save</button></div>')}
export function deleteSelectedPlaylist(){
 const playlist=state.playlists.find(item=>item.id===state.selectedPlaylistId);if(!playlist)return;
 window.showDialog('Delete playlist?','<p>Delete “'+esc(playlist.name)+'”? The songs will remain in your library.</p><div class="dialog-footer"><button class="button button-quiet" data-close-action>Cancel</button><button class="button button-destructive" data-action="confirm-delete-playlist">Delete playlist</button></div>')
}
export async function confirmDeleteSelectedPlaylist(){
 const playlist=state.playlists.find(item=>item.id===state.selectedPlaylistId);if(!playlist)return;
 const snapshot={...playlist,trackIds:[...(playlist.trackIds||[])]};state.playlists=state.playlists.filter(item=>item.id!==playlist.id);state.selectedPlaylistId=null;state.refreshAll();window.closeAction();
 let undone=false;const timer=setTimeout(async()=>{if(undone)return;try{await remove('playlists',snapshot.id)}catch(error){state.playlists.push(snapshot);await put('playlists',snapshot).catch(()=>{});state.refreshAll();toast('Could not delete playlist')}} ,6500);
 toast('Playlist deleted',{label:'Undo',run:async()=>{undone=true;clearTimeout(timer);state.playlists.push(snapshot);state.playlists.sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));await put('playlists',snapshot);state.refreshAll();toast('Playlist restored')}})
}
export async function removeFromPlaylist(trackId){
 const playlist=state.playlists.find(item=>item.id===state.selectedPlaylistId);if(!playlist)return;const previous=[...(playlist.trackIds||[])];playlist.trackIds=previous.filter(id=>id!==trackId);
 try{await put('playlists',playlist);renderPlaylistDetail();renderPlaylists();toast('Removed from playlist',{label:'Undo',run:async()=>{playlist.trackIds=previous;await put('playlists',playlist);renderPlaylistDetail();renderPlaylists();toast('Song restored to playlist')}})}catch(error){playlist.trackIds=previous;toast('Could not update playlist')}
}
export async function moveInPlaylist(trackId,direction){
 const playlist=state.playlists.find(item=>item.id===state.selectedPlaylistId);if(!playlist)return;const list=playlist.trackIds||[],index=list.indexOf(trackId),target=Math.max(0,Math.min(list.length-1,index+direction));if(index<0||index===target)return;const moved=list.splice(index,1)[0];list.splice(target,0,moved);playlist.trackIds=list;
 try{await put('playlists',playlist);renderPlaylistDetail()}catch(error){toast('Could not reorder playlist')}
}

