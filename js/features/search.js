import {state,$,esc,highlight,trackRow,playlistTrackIds,artworkUrl,icon} from '../core.js';
import {put} from '../storage.js';
let timer=null;
let searchActive=false;
function searchTracks(query){return state.tracks.filter(track=>((track.title||track.name||'')+' '+(track.artist||'')+' '+(track.album||'')+' '+(track.genre||'')).toLowerCase().includes(query))}
function matchesByType(query,type){if(type==='artists')return Array.from(new Set(state.tracks.map(track=>track.artist||'Unknown artist'))).filter(value=>value.toLowerCase().includes(query)).sort();if(type==='albums')return Array.from(new Set(state.tracks.map(track=>track.album).filter(Boolean))).filter(value=>value.toLowerCase().includes(query)).sort();return []}
function cardArt(track){const url=artworkUrl(track);return url?'<span class="search-result-art"><img src="'+esc(url)+'" alt=""></span>':'<span class="search-result-art">'+icon('music')+'</span>'}
function renderBeforeSearch(box){
 const recent=Array.isArray(state.prefs.recentSearches)?state.prefs.recentSearches:[];
 const genres=Array.from(new Set(state.tracks.map(track=>track.genre).filter(Boolean))).slice(0,8);
 let html='';
 if(recent.length)html+='<section class="search-group"><div class="section-heading"><h2>Recent Searches</h2><button class="text-button" data-clear-search-history>Clear</button></div>'+recent.map(value=>'<button class="artist-result" data-recent-search="'+esc(value)+'">'+icon('history')+'<span class="listinfo"><b>'+esc(value)+'</b></span>'+icon('search')+'</button>').join('')+'</section>';
 if(genres.length)html+='<section class="search-group"><div class="section-heading"><h2>Browse by Genre</h2></div><div class="browse-grid">'+genres.map(genre=>'<button class="browse-tile" data-search-query="'+esc(genre)+'">'+esc(genre)+'</button>').join('')+'</div></section>';
 if(!html)html='<div class="search-empty">Search songs, artists, albums, and playlists in your uploads.</div>';
 box.innerHTML=html
}
function trackResult(track,query){return '<section class="search-group"><h2>Top Result</h2><div class="search-result-card">'+cardArt(track)+'<div class="listinfo"><b>'+highlight(track.title||track.name,query)+'</b><small>'+highlight(track.artist||'Unknown artist',query)+(track.album?' · '+highlight(track.album,query):'')+'</small></div><button class="icon-button" data-play-track="'+esc(track.id)+'" aria-label="Play top result">'+icon('play')+'</button><button class="icon-button" data-track-menu="'+esc(track.id)+'" aria-label="More actions for '+esc(track.title||track.name)+'" aria-haspopup="dialog">'+icon('more')+'</button></div></section>'}
function renderArtists(query){const values=matchesByType(query,'artists');return values.length?values.map(name=>{const count=state.tracks.filter(track=>(track.artist||'Unknown artist')===name).length;return '<button class="artist-result" data-open-artist="'+esc(name)+'">'+icon('artist')+'<span class="listinfo"><b>'+highlight(name,query)+'</b><small>'+count+' '+(count===1?'song':'songs')+'</small></span>'+icon('chevron-right')+'</button>'}).join(''):'<div class="search-empty">No matching artists.</div>'}
function renderAlbums(query){const values=matchesByType(query,'albums');return values.length?values.map(name=>{const tracks=state.tracks.filter(track=>track.album===name),first=tracks[0];return '<button class="artist-result" data-open-album="'+esc(name)+'">'+cardArt(first)+'<span class="listinfo"><b>'+highlight(name,query)+'</b><small>'+highlight(first?.artist||'Unknown artist',query)+' · '+tracks.length+' songs</small></span>'+icon('chevron-right')+'</button>'}).join(''):'<div class="search-empty">No matching albums.</div>'}
function renderPlaylists(query){const values=state.playlists.filter(item=>String(item.name||'').toLowerCase().includes(query));return values.length?values.map(playlist=>'<button class="artist-result" data-open-playlist="'+esc(playlist.id)+'">'+icon('playlist')+'<span class="listinfo"><b>'+highlight(playlist.name,query)+'</b><small>'+playlistTrackIds(playlist).length+' songs</small></span>'+icon('chevron-right')+'</button>').join(''):'<div class="search-empty">No matching playlists.</div>'}
export function renderSearch(){
 const input=$('searchInput'),box=$('searchResults'),query=input.value.trim().toLowerCase(),clear=$('clearSearch'),cancel=$('searchCancel');
 clear.hidden=!input.value;cancel.hidden=!searchActive;
 if(!query){renderBeforeSearch(box);return}
 const filter=state.searchFilter,matches=searchTracks(query),sorted=matches.slice().sort((a,b)=>{const at=(a.title||a.name||'').toLowerCase(),bt=(b.title||b.name||'').toLowerCase();return (at===query?-1:at.startsWith(query)?-1:0)-(bt===query?-1:bt.startsWith(query)?-1:0)});
 const top=sorted[0];let html='';
 if(filter==='all'&&top)html+=trackResult(top,query);
 if(filter==='all'||filter==='songs')html+='<section class="search-group"><h2>Songs</h2><div class="track-list">'+(matches.length?matches.map(track=>trackRow(track,{query})).join(''):'<div class="search-empty">No matching songs.</div>')+'</div></section>';
 if(filter==='all'||filter==='artists')html+='<section class="search-group"><h2>Artists</h2>'+renderArtists(query)+'</section>';
 if(filter==='all'||filter==='albums')html+='<section class="search-group"><h2>Albums</h2>'+renderAlbums(query)+'</section>';
 if(filter==='all'||filter==='playlists')html+='<section class="search-group"><h2>Playlists</h2>'+renderPlaylists(query)+'</section>';
 box.innerHTML=html
}
export function setSearchFilter(filter){const allowed=['all','songs','artists','albums','playlists'];state.searchFilter=allowed.includes(filter)?filter:'all';document.querySelectorAll('[data-search-filter]').forEach(button=>{const active=button.dataset.searchFilter===state.searchFilter;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active))});renderSearch()}
async function rememberSearch(value){const clean=value.trim();if(!clean)return;state.prefs.recentSearches=[clean,...(state.prefs.recentSearches||[]).filter(item=>item.toLowerCase()!==clean.toLowerCase())].slice(0,8);try{await put('settings',{key:'preferences',value:state.prefs})}catch(error){}}
export function initSearch(){
 const input=$('searchInput');
 input.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(renderSearch,200)});
 input.addEventListener('focus',()=>{searchActive=true;renderSearch()});
 input.addEventListener('keydown',event=>{if(event.key==='Enter')rememberSearch(input.value);if(event.key==='Escape'){$('searchCancel').click()}});
 $('clearSearch').addEventListener('click',()=>{input.value='';renderSearch();input.focus()});
 $('searchCancel').addEventListener('click',()=>{if(input.value)rememberSearch(input.value);input.value='';searchActive=false;renderSearch();input.blur()});
 document.addEventListener('click',event=>{const recent=event.target.closest('[data-recent-search]'),genre=event.target.closest('[data-search-query]'),clearHistory=event.target.closest('[data-clear-search-history]');if(recent){input.value=recent.dataset.recentSearch;renderSearch()}else if(genre){input.value=genre.dataset.searchQuery;renderSearch()}else if(clearHistory){state.prefs.recentSearches=[];put('settings',{key:'preferences',value:state.prefs}).catch(()=>{});renderSearch()}})
}
export function setSearchQuery(value){$('searchInput').value=value;renderSearch()}

