import {state,$,esc,highlight,trackRow,playlistTrackIds,artworkUrl,icon,byId,formatDuration} from '../core.js';
import {put} from '../storage.js';
import {searchSource} from '../sources/index.js';

let timer=null,searchActive=false,remoteController=null,requestId=0,remotePage={};
function searchTracks(query){return state.tracks.map(item=>byId(item.id)||item).filter(track=>((track.title||track.name||'')+' '+(track.artist||'')+' '+(track.album||'')+' '+(track.genre||'')).toLowerCase().includes(query))}
function matchesByType(query,type){if(type==='artists')return Array.from(new Set(state.tracks.map(item=>(byId(item.id)||item).artist||'Unknown artist'))).filter(value=>value.toLowerCase().includes(query)).sort();if(type==='albums')return Array.from(new Set(state.tracks.map(item=>(byId(item.id)||item).album).filter(Boolean))).filter(value=>value.toLowerCase().includes(query)).sort();return []}
function cardArt(track){const url=artworkUrl(track);return url?'<span class="search-result-art"><img src="'+esc(url)+'" alt=""></span>':'<span class="search-result-art">'+icon('music')+'</span>'}
function renderBeforeSearch(box){
 const recent=Array.isArray(state.prefs.recentSearches)?state.prefs.recentSearches:[],genres=state.searchScope==='library'?Array.from(new Set(state.tracks.map(item=>(byId(item.id)||item).genre).filter(Boolean))).slice(0,8):[];let html='';
 if(recent.length)html+='<section class="search-group"><div class="section-heading"><h2>Recent Searches</h2><button class="text-button" data-clear-search-history>Clear</button></div>'+recent.map(value=>'<button class="artist-result" data-recent-search="'+esc(value)+'">'+icon('history')+'<span class="listinfo"><b>'+esc(value)+'</b></span>'+icon('search')+'</button>').join('')+'</section>';
 if(genres.length)html+='<section class="search-group"><div class="section-heading"><h2>Browse by Genre</h2></div><div class="browse-grid">'+genres.map(genre=>'<button class="browse-tile" data-search-query="'+esc(genre)+'">'+esc(genre)+'</button>').join('')+'</div></section>';
 if(!html)html='<div class="search-empty">'+(state.searchScope==='library'?'Search songs, artists, albums, and playlists in your library.':'Search '+esc(state.searchScope)+' music.')+'</div>';
 box.innerHTML=html
}
function trackResult(track,query,collectionIds){
 const source=track.source==='youtube'?' · YouTube':track.source==='jamendo'?' · Jamendo':track.source==='audius'?' · Audius':'',duration=track.source==='youtube'&&Number(track.duration)>0?' · '+formatDuration(track.duration):'';
 return '<section class="search-group"><h2>Top Result</h2><div class="search-result-card">'+cardArt(track)+'<div class="listinfo"><b>'+highlight(track.title||track.name,query)+'</b><small>'+highlight(track.artist||'Unknown artist',query)+(track.album?' · '+highlight(track.album,query):'')+source+duration+'</small></div><button class="icon-button" data-play-track="'+esc(track.id)+'" data-play-collection="'+esc(collectionIds.join(','))+'" aria-label="Play top result">'+icon('play')+'</button><button class="icon-button" data-track-menu="'+esc(track.id)+'" aria-label="More actions for '+esc(track.title||track.name)+'" aria-haspopup="dialog">'+icon('more')+'</button></div></section>'
}
function renderArtists(query){const values=matchesByType(query,'artists');return values.length?values.map(name=>{const count=state.tracks.filter(item=>(byId(item.id)||item).artist===name).length;return '<button class="artist-result" data-open-artist="'+esc(name)+'">'+icon('artist')+'<span class="listinfo"><b>'+highlight(name,query)+'</b><small>'+count+' '+(count===1?'song':'songs')+'</small></span>'+icon('chevron-right')+'</button>'}).join(''):'<div class="search-empty">No matching artists.</div>'}
function renderAlbums(query){const values=matchesByType(query,'albums');return values.length?values.map(name=>{const tracks=state.tracks.map(item=>byId(item.id)||item).filter(track=>track.album===name),first=tracks[0];return '<button class="artist-result" data-open-album="'+esc(name)+'">'+cardArt(first)+'<span class="listinfo"><b>'+highlight(name,query)+'</b><small>'+highlight(first?.artist||'Unknown artist',query)+' · '+tracks.length+' songs</small></span>'+icon('chevron-right')+'</button>'}).join(''):'<div class="search-empty">No matching albums.</div>'}
function renderPlaylists(query){const values=state.playlists.filter(item=>String(item.name||'').toLowerCase().includes(query));return values.length?values.map(playlist=>'<button class="artist-result" data-open-playlist="'+esc(playlist.id)+'">'+icon('playlist')+'<span class="listinfo"><b>'+highlight(playlist.name,query)+'</b><small>'+playlistTrackIds(playlist).length+' songs</small></span>'+icon('chevron-right')+'</button>').join(''):'<div class="search-empty">No matching playlists.</div>'}
function updateSearchScope(){
 const input=$('searchInput'),remote=state.searchScope!=='library';document.querySelectorAll('[data-search-scope]').forEach(button=>{const active=button.dataset.searchScope===state.searchScope;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active))});
 document.querySelector('.search-filters').hidden=remote;if($('youtubeSearchNotice'))$('youtubeSearchNotice').hidden=state.searchScope!=='youtube';const labels={library:'Search your library',audius:'Search Audius',youtube:'Search YouTube videos',jamendo:'Search Jamendo music'};input.placeholder=labels[state.searchScope]||labels.library;input.setAttribute('aria-label',labels[state.searchScope]||labels.library)
}
function loadingMarkup(){return '<div class="source-loading" role="status" aria-label="Searching music"><i class="skeleton"></i><i class="skeleton"></i><i class="skeleton"></i></div>'}
function remoteError(error,scope){
 const message=!navigator.onLine?'You are offline. Connect and retry.':error?.message||scope+' search is unavailable right now.';
 return '<div class="search-empty" role="status">'+esc(message)+' <button class="text-button" data-search-retry type="button">Try again</button>'+(scope==='youtube'?' <button class="text-button" data-open-youtube-settings type="button">Open Settings</button>':'')+'</div>'
}
async function renderRemoteSearch(query,box,id,signal,opts={}){
 if(!opts.append)box.innerHTML=loadingMarkup();
 try{
  const pageOpts={signal};if(state.searchScope==='jamendo')pageOpts.offset=opts.offset||0;if(state.searchScope==='youtube')pageOpts.pageToken=opts.pageToken||'';
  const result=await searchSource(state.searchScope,query,pageOpts);if(id!==requestId)return;
  const tracks=Array.isArray(result)?result:result.tracks||[],combined=opts.append?(remotePage.tracks||[]).concat(tracks):tracks;remotePage={query,scope:state.searchScope,tracks:combined,nextOffset:result.nextOffset,nextPageToken:result.nextPageToken};
  if(!combined.length){box.innerHTML='<div class="search-empty" role="status">No '+esc(state.searchScope)+' results for “'+esc(query)+'”. Try a shorter query or another spelling.</div>';return}
  const ids=combined.map(track=>track.id),top=combined[0],rows=combined.map(track=>trackRow(track,{query,collectionIds:ids})).join('');
  let more='';if(state.searchScope==='jamendo'&&result.hasMore)more='<button class="button button-secondary source-more" data-source-more="jamendo">Load more Jamendo tracks</button>';if(state.searchScope==='youtube'&&result.nextPageToken)more='<button class="button button-secondary source-more" data-source-more="youtube">Load more videos</button>';
  const html=trackResult(top,query,ids)+'<section class="search-group"><div class="section-heading"><h2>'+esc(state.searchScope==='youtube'?'Videos':'Songs')+' · '+combined.length+'</h2></div><div class="track-list">'+rows+'</div>'+more+'</section>';
  if(opts.append){const old=box.querySelector('.search-group:last-child');if(old)old.outerHTML=html.slice(html.indexOf('<section class="search-group"'),html.length);else box.innerHTML=html}else box.innerHTML=html
 }catch(error){if(error?.name==='AbortError'||id!==requestId)return;box.innerHTML=remoteError(error,state.searchScope)}
}
export function renderSearch(){
 const input=$('searchInput'),box=$('searchResults'),query=input.value.trim(),normalized=query.toLowerCase(),clear=$('clearSearch'),cancel=$('searchCancel');clear.hidden=!input.value;cancel.hidden=!searchActive;updateSearchScope();requestId++;if(remoteController)remoteController.abort();remoteController=null;remotePage={};
 if(!normalized){renderBeforeSearch(box);return}
 if(state.searchScope==='youtube'&&normalized.length<2){box.innerHTML='<div class="search-empty">Enter at least two characters to search YouTube.</div>';return}
 if(state.searchScope!=='library'){remoteController=new AbortController();renderRemoteSearch(query,box,requestId,remoteController.signal);return}
 const filter=state.searchFilter,matches=searchTracks(normalized),sorted=matches.slice().sort((a,b)=>{const at=(a.title||a.name||'').toLowerCase(),bt=(b.title||b.name||'').toLowerCase();return (at===normalized||at.startsWith(normalized)?-1:0)-(bt===normalized||bt.startsWith(normalized)?-1:0)});
 const top=sorted[0];let html='';if(filter==='all'&&top)html+=trackResult(top,query,sorted.map(track=>track.id));
 if(filter==='all'||filter==='songs')html+='<section class="search-group"><h2>Songs</h2><div class="track-list">'+(matches.length?matches.map(track=>trackRow(track,{query,collectionIds:matches.map(item=>item.id)})).join(''):'<div class="search-empty">No matching songs.</div>')+'</div></section>';
 if(filter==='all'||filter==='artists')html+='<section class="search-group"><h2>Artists</h2>'+renderArtists(normalized)+'</section>';
 if(filter==='all'||filter==='albums')html+='<section class="search-group"><h2>Albums</h2>'+renderAlbums(normalized)+'</section>';
 if(filter==='all'||filter==='playlists')html+='<section class="search-group"><h2>Playlists</h2>'+renderPlaylists(normalized)+'</section>';
 box.innerHTML=html
}
export function setSearchFilter(filter){const allowed=['all','songs','artists','albums','playlists'];state.searchFilter=allowed.includes(filter)?filter:'all';document.querySelectorAll('[data-search-filter]').forEach(button=>{const active=button.dataset.searchFilter===state.searchFilter;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active))});renderSearch()}
export function setSearchScope(scope){state.searchScope=['audius','youtube','jamendo'].includes(scope)?scope:'library';renderSearch()}
async function rememberSearch(value){const clean=value.trim();if(!clean)return;state.prefs.recentSearches=[clean,...(state.prefs.recentSearches||[]).filter(item=>item.toLowerCase()!==clean.toLowerCase())].slice(0,8);try{await put('settings',{key:'preferences',value:state.prefs})}catch(error){}}
function moreResults(){if(!remotePage.query||remotePage.scope!==state.searchScope)return;const opts={append:true};if(state.searchScope==='jamendo')opts.offset=remotePage.nextOffset;if(state.searchScope==='youtube')opts.pageToken=remotePage.nextPageToken;remoteController=new AbortController();renderRemoteSearch(remotePage.query,$('searchResults'),requestId,remoteController.signal,opts)}
export function initSearch(){
 const input=$('searchInput');input.addEventListener('input',()=>{clearTimeout(timer);const delay=state.searchScope==='youtube'?400:state.searchScope==='jamendo'?300:200;timer=setTimeout(renderSearch,delay)});
 input.addEventListener('focus',()=>{searchActive=true;renderSearch()});input.addEventListener('keydown',event=>{if(event.key==='Enter')rememberSearch(input.value);if(event.key==='Escape')$('searchCancel').click()});
 $('clearSearch').addEventListener('click',()=>{input.value='';renderSearch();input.focus()});$('searchCancel').addEventListener('click',()=>{if(input.value)rememberSearch(input.value);input.value='';searchActive=false;renderSearch();input.blur()});
 document.addEventListener('click',event=>{const recent=event.target.closest('[data-recent-search]'),genre=event.target.closest('[data-search-query]'),clearHistory=event.target.closest('[data-clear-search-history]'),retry=event.target.closest('[data-search-retry]'),more=event.target.closest('[data-source-more]');if(recent){input.value=recent.dataset.recentSearch;renderSearch()}else if(genre){input.value=genre.dataset.searchQuery;renderSearch()}else if(clearHistory){state.prefs.recentSearches=[];put('settings',{key:'preferences',value:state.prefs}).catch(()=>{});renderSearch()}else if(retry)renderSearch();else if(more)moreResults()})
}
export function setSearchQuery(value){$('searchInput').value=value;renderSearch()}
